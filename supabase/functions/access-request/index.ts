// ============================================================
// access-request — Phase A lead capture Edge Function
// ============================================================
// Public, unauthenticated endpoint backing the marketing-site
// "Request Access" form and the "Talk to Our Team" contact modal.
//
// Flow:
//   1. Validate the JSON body (required fields, email/phone shape,
//      source ∈ access_requests.source CHECK set).
//   2. Insert into public.access_requests with the service-role
//      client (bypasses RLS — see db/rls.sql).
//   3. Best-effort email fan-out via Resend:
//        a. Notification → ADMIN_EMAIL (chris@bluecollarai.online)
//        b. Confirmation → the prospect's email
//      Email failures are logged but do not roll back the row;
//      the DB record is the source of truth for Phase B admin
//      tooling, and the prospect can always be contacted manually
//      from the saved row.
//
// Required secrets (supabase secrets set ...):
//   RESEND_API_KEY  — Resend API key. If unset, the function
//                     still inserts the row and returns 200, but
//                     skips both emails with a console.warn.
//   FROM_EMAIL      — Optional. Defaults to the placeholder below;
//                     must be a sender Resend has verified for the
//                     domain (or the onboarding@resend.dev sender
//                     for dev). Format: 'Display Name <addr@dom>'.
//   SUPABASE_URL              — auto-provided by the runtime.
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by the runtime.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ADMIN_EMAIL = 'chris@bluecollarai.online'
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'FleetGuard Pro <noreply@fleetguardpro.com>'

// Mirrors the access_requests.source CHECK constraint in db/schema.sql.
const ALLOWED_SOURCES = new Set(['access-form', 'contact-form'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// CORS — the marketing site is served from a different origin than the
// Edge Function host, so the browser will preflight on first POST.
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

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const cap  = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s)

interface ValidatedInput {
  company_name: string
  contact_name: string
  email: string
  phone: string
  fleet_size: string | null
  referral_source: string | null
  notes: string | null
  source: 'access-form' | 'contact-form'
}

type ValidationResult =
  | { ok: true;  data: ValidatedInput }
  | { ok: false; field: string; message: string }

function validate(body: any): ValidationResult {
  const company_name    = cap(trim(body?.company_name),    200)
  const contact_name    = cap(trim(body?.contact_name),    200)
  const email           = cap(trim(body?.email),           200).toLowerCase()
  const phone           = cap(trim(body?.phone),            50)
  const fleet_sizeIn    = cap(trim(body?.fleet_size),       50)
  const referral_srcIn  = cap(trim(body?.referral_source), 200)
  const notes           = cap(trim(body?.notes),          4000)
  const sourceRaw       = trim(body?.source) || 'access-form'

  if (!company_name) return { ok: false, field: 'company_name', message: 'Company name is required.' }
  if (!contact_name) return { ok: false, field: 'contact_name', message: 'Your name is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, field: 'email', message: 'Please enter a valid email address.' }
  const phoneDigits = phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, field: 'phone', message: 'Please enter a valid phone number (10+ digits).' }
  }
  if (!ALLOWED_SOURCES.has(sourceRaw)) {
    return { ok: false, field: 'source', message: 'Invalid source.' }
  }

  return {
    ok: true,
    data: {
      company_name, contact_name, email, phone,
      fleet_size:      fleet_sizeIn   || null,
      referral_source: referral_srcIn || null,
      notes:           notes          || null,
      source: sourceRaw as 'access-form' | 'contact-form',
    },
  }
}

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPE[c])

interface EmailParts { subject: string; html: string; text: string }

function adminEmail(input: ValidatedInput, requestId: string): EmailParts {
  const sourceLabel = input.source === 'contact-form' ? 'Contact Form' : 'Access Request Form'
  const subject = `New ${sourceLabel}: ${input.company_name}`

  const fields: [string, string][] = [
    ['Company',  input.company_name],
    ['Contact',  input.contact_name],
    ['Email',    input.email],
    ['Phone',    input.phone],
  ]
  if (input.fleet_size)      fields.push(['Fleet size',         input.fleet_size])
  if (input.referral_source) fields.push(['Heard about us via', input.referral_source])
  if (input.notes)           fields.push(['Notes',              input.notes])
  fields.push(['Source',     sourceLabel])
  fields.push(['Request ID', requestId])

  const html = `<table cellpadding="6" style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:14px;border-collapse:collapse">
${fields.map(([k, v]) =>
    `<tr><td valign="top" style="color:#666;padding-right:14px"><b>${escape(k)}</b></td>` +
    `<td style="white-space:pre-wrap">${escape(v)}</td></tr>`).join('\n')}
</table>`
  const text = fields.map(([k, v]) => `${k}: ${v}`).join('\n')
  return { subject, html, text }
}

function prospectEmail(input: ValidatedInput): EmailParts {
  const subject = 'We received your FleetGuard Pro request'
  const text =
`Hi ${input.contact_name},

Thanks for reaching out to FleetGuard Pro. We have received your request for ${input.company_name} and a member of our team will follow up within one business day.

If you need to add anything in the meantime, just reply to this email.

— The FleetGuard Pro team`
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.6;color:#222">
<p>Hi ${escape(input.contact_name)},</p>
<p>Thanks for reaching out to <b>FleetGuard Pro</b>. We have received your request for <b>${escape(input.company_name)}</b> and a member of our team will follow up within one business day.</p>
<p>If you need to add anything in the meantime, just reply to this email.</p>
<p>— The FleetGuard Pro team</p>
</div>`
  return { subject, html, text }
}

interface SendArgs { to: string; subject: string; html: string; text: string; replyTo?: string }

async function sendEmail(args: SendArgs): Promise<{ ok?: true; skipped?: true; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('access-request: RESEND_API_KEY not set, skipping email to', args.to)
    return { skipped: true }
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     FROM_EMAIL,
      to:       args.to,
      subject:  args.subject,
      html:     args.html,
      text:     args.text,
      reply_to: args.replyTo,
    }),
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    console.error('access-request: Resend send failed', resp.status, errText)
    return { error: `Resend ${resp.status}: ${errText}` }
  }
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const v = validate(body)
  if (!v.ok) return json({ error: v.message, field: v.field }, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('access-request: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server misconfiguration.' }, 500)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: row, error } = await sb
    .from('access_requests')
    .insert(v.data)
    .select('id')
    .single()

  if (error) {
    console.error('access-request: insert failed', error)
    return json({ error: 'Could not save request. Please try again.' }, 500)
  }

  const adm = adminEmail(v.data, row.id)
  const pro = prospectEmail(v.data)
  await Promise.allSettled([
    sendEmail({ to: ADMIN_EMAIL,   subject: adm.subject, html: adm.html, text: adm.text, replyTo: v.data.email }),
    sendEmail({ to: v.data.email,  subject: pro.subject, html: pro.html, text: pro.text }),
  ])

  return json({ ok: true, id: row.id }, 200)
})
