// ============================================================
// admin-approve-request — Phase B admin approval Edge Function
// ============================================================
// Authenticated, admin-only endpoint. Approves a pending
// access_requests row, invites the prospect via Supabase Auth,
// then patches the bootstrapped companies row with the granted
// plan / services / trial.
//
// Body (JSON):
//   {
//     request_id:  uuid,
//     access_type: 'free_trial' | 'paid',
//     trial_days?: number,             // required when access_type='free_trial'
//     services:    string[] | 'all'    // service codes from SERVICES_TO_PANELS in app.js,
//                                      // or the literal 'all' for all-access
//   }
//
// Auth model:
//   The caller's JWT is verified via a per-request supabase-js
//   client created with the Authorization header. We read the
//   caller's row from public.users with that client (RLS-scoped)
//   and require is_admin=true. All privileged writes — auth.admin
//   invite, companies patch, access_requests patch — go through
//   a separate service_role client.
//
// Side effects:
//   1. supabase.auth.admin.inviteUserByEmail sends the prospect an
//      invite email (Supabase Auth template) with a redirect to
//      <SITE_URL>/complete-signup.html.
//   2. The on_auth_user_created trigger fires synchronously,
//      creating public.companies + public.users rows for the new
//      auth.users row. The trigger uses raw_user_meta_data.company_name,
//      which we pass via inviteUserByEmail's `data` option.
//   3. We then patch the new companies row with plan / services /
//      access_type / trial_ends_at.
//   4. We update access_requests: status='approved', reviewed_by=
//      caller, reviewed_at=now(), approval_metadata=summary.
//
// Required secrets (auto-provided by the Supabase runtime unless
// noted):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   SITE_URL  — origin used for the invite redirect target.
//               Defaults to https://fleetguardpro.online.
// ============================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://fleetguardpro.online').replace(/\/+$/, '')
const COMPLETE_SIGNUP_PATH = '/complete-signup.html'

// Mirrors the SERVICES_TO_PANELS map in FleetGuardPro/js/app.js. The
// service codes match the existing seed.sql convention. Keep these
// two in sync — both reference the access_requests.approval_metadata
// payload an admin sees in the UI.
const ALL_SERVICE_CODES = ['safety', 'compliance', 'maintenance', 'insurance'] as const
type ServiceCode = (typeof ALL_SERVICE_CODES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

interface Input {
  request_id:  string
  access_type: 'free_trial' | 'paid'
  trial_days?: number
  services:    ServiceCode[] | 'all'
}

type ValidationResult =
  | { ok: true;  data: Input }
  | { ok: false; field: string; message: string }

function validate(body: any): ValidationResult {
  if (!body || typeof body !== 'object') return { ok: false, field: '_', message: 'Invalid JSON body.' }
  const request_id = typeof body.request_id === 'string' ? body.request_id.trim() : ''
  if (!request_id) return { ok: false, field: 'request_id', message: 'request_id is required.' }

  const access_type = body.access_type
  if (access_type !== 'free_trial' && access_type !== 'paid') {
    return { ok: false, field: 'access_type', message: 'access_type must be free_trial or paid.' }
  }

  let trial_days: number | undefined
  if (access_type === 'free_trial') {
    const n = Number(body.trial_days)
    if (!Number.isFinite(n) || n <= 0 || n > 365) {
      return { ok: false, field: 'trial_days', message: 'trial_days must be 1–365 when access_type=free_trial.' }
    }
    trial_days = Math.floor(n)
  }

  let services: ServiceCode[] | 'all'
  if (body.services === 'all') {
    services = 'all'
  } else if (Array.isArray(body.services)) {
    const cleaned: ServiceCode[] = []
    for (const s of body.services) {
      if (typeof s !== 'string') {
        return { ok: false, field: 'services', message: 'services entries must be strings.' }
      }
      if (!ALL_SERVICE_CODES.includes(s as ServiceCode)) {
        return { ok: false, field: 'services', message: `Unknown service code "${s}".` }
      }
      if (!cleaned.includes(s as ServiceCode)) cleaned.push(s as ServiceCode)
    }
    if (cleaned.length === 0) {
      return { ok: false, field: 'services', message: 'At least one service must be granted.' }
    }
    services = cleaned
  } else {
    return { ok: false, field: 'services', message: 'services is required (array of codes or "all").' }
  }

  return { ok: true, data: { request_id, access_type, trial_days, services } }
}

async function requireAdmin(authHeader: string | null): Promise<
  { ok: true; userId: string; client: SupabaseClient } | { ok: false; status: number; error: string }
> {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return { ok: false, status: 401, error: 'Missing Authorization header.' }
  }
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return { ok: false, status: 500, error: 'Server misconfiguration (SUPABASE_URL/ANON_KEY).' }

  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResp, error: userErr } = await client.auth.getUser()
  if (userErr || !userResp?.user) return { ok: false, status: 401, error: 'Invalid or expired session.' }
  const userId = userResp.user.id

  // Reads through the caller's RLS context. users_select_tenant lets a
  // user read their own row, so this works regardless of admin status.
  // We then enforce is_admin in code.
  const { data: row, error: rowErr } = await client
    .from('users')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (rowErr) return { ok: false, status: 500, error: 'Failed to verify admin status.' }
  if (!row || !row.is_admin) return { ok: false, status: 403, error: 'Admin privileges required.' }

  return { ok: true, userId, client }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed.' }, 405)

  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }

  const v = validate(body)
  if (!v.ok) return json({ error: v.message, field: v.field }, 400)

  const admin = await requireAdmin(req.headers.get('Authorization'))
  if (!admin.ok) return json({ error: admin.error }, admin.status)
  const adminUserId = admin.userId

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.error('admin-approve-request: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server misconfiguration.' }, 500)
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Load the access_requests row.
  const { data: reqRow, error: reqErr } = await sb
    .from('access_requests')
    .select('id, company_name, contact_name, email, status')
    .eq('id', v.data.request_id)
    .maybeSingle()

  if (reqErr) {
    console.error('admin-approve-request: failed to read access_requests', reqErr)
    return json({ error: 'Could not read access request.' }, 500)
  }
  if (!reqRow) return json({ error: 'Access request not found.' }, 404)
  if (reqRow.status !== 'pending') {
    return json({ error: `Access request is already ${reqRow.status}.` }, 409)
  }

  // 2. Compute the grant.
  const services: ServiceCode[] = v.data.services === 'all'
    ? [...ALL_SERVICE_CODES]
    : v.data.services
  const plan: 'all-access' | 'a-la-carte' = (services.length === ALL_SERVICE_CODES.length)
    ? 'all-access'
    : 'a-la-carte'
  const trial_ends_at: string | null = v.data.access_type === 'free_trial'
    ? new Date(Date.now() + (v.data.trial_days! * 24 * 60 * 60 * 1000)).toISOString()
    : null

  // 3. Invite the prospect via Supabase Auth. The on_auth_user_created
  //    trigger fires inside this call and bootstraps companies + users
  //    using raw_user_meta_data.company_name. If the user already
  //    exists in auth.users, this returns an error (e.g., email_exists)
  //    — that case is rare for new prospects but we surface it as 409.
  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(
    reqRow.email,
    {
      data: { company_name: reqRow.company_name },
      redirectTo: `${SITE_URL}${COMPLETE_SIGNUP_PATH}`,
    },
  )

  if (inviteErr || !invited?.user) {
    console.error('admin-approve-request: inviteUserByEmail failed', inviteErr)
    const msg = inviteErr?.message || 'Could not invite user.'
    const status = /already|exists|registered/i.test(msg) ? 409 : 500
    return json({ error: msg }, status)
  }

  const newUserId = invited.user.id

  // 4. Look up the company_id created by on_auth_user_created.
  const { data: userRow, error: userLookupErr } = await sb
    .from('users')
    .select('company_id')
    .eq('id', newUserId)
    .maybeSingle()

  if (userLookupErr || !userRow?.company_id) {
    console.error('admin-approve-request: failed to locate bootstrapped company_id', userLookupErr)
    return json({ error: 'User invited but tenant bootstrap failed. Investigate before retrying.' }, 500)
  }

  // 5. Patch the new companies row with the grant.
  const { error: companyErr } = await sb
    .from('companies')
    .update({
      plan,
      services,
      access_type:   v.data.access_type,
      trial_ends_at,
      member_since:  new Date().toISOString().slice(0, 10),
      contact_name:  reqRow.contact_name,
      contact_email: reqRow.email,
    })
    .eq('id', userRow.company_id)

  if (companyErr) {
    console.error('admin-approve-request: companies patch failed', companyErr)
    return json({ error: 'User invited but company grant failed. Investigate before retrying.' }, 500)
  }

  // 6. Mark the access request approved.
  const approval_metadata = {
    access_type: v.data.access_type,
    trial_days:  v.data.trial_days ?? null,
    services,
    plan,
    invited_user_id: newUserId,
    company_id:      userRow.company_id,
  }

  const { error: updateErr } = await sb
    .from('access_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      approval_metadata,
    })
    .eq('id', v.data.request_id)

  if (updateErr) {
    console.error('admin-approve-request: access_requests update failed', updateErr)
    return json({ error: 'User invited and company granted, but access_request status update failed. Update manually.' }, 500)
  }

  return json({
    ok: true,
    user_id:    newUserId,
    company_id: userRow.company_id,
    plan,
    services,
    access_type:   v.data.access_type,
    trial_ends_at,
  }, 200)
})
