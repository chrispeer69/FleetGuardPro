// ============================================================
// DB — thin Supabase data-access layer
// Mirrors FG.state's surface (list/get/create/update/remove) so
// panels can swap their reads/writes one at a time without
// reshaping their internals.
//
// Tenant scoping is enforced by RLS, not by the client. The only
// place company_id lives in JS is the cached value from
// public.users used to populate inserts (which RLS then verifies
// in the WITH CHECK clause).
//
// Audit log writes are automatic — log_audit() trigger fires AFTER
// every insert/update/delete on the 13 tenant entity tables.
// ============================================================
window.FG = window.FG || {};

FG.db = (function () {

  // Whitelist guards every call site. If a typo'd table name slips
  // through, fail loudly here instead of letting PostgREST 404.
  const TENANT_TABLES = new Set([
    'trucks', 'drivers', 'garage_shops', 'maintenance', 'repairs',
    'parts', 'dot_files', 'safety_incidents', 'insurance_policies',
    'documents', 'alerts', 'billing', 'reports',
  ]);

  let _companyIdCache = null;
  let _companyIdPromise = null;

  // Clear the cache when the user signs out so a subsequent login
  // (different tenant) doesn't reuse the previous company_id.
  if (FG.supabase && FG.supabase.auth) {
    FG.supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        _companyIdCache = null;
        _companyIdPromise = null;
      }
    });
  }

  const assertTable = (table) => {
    if (!TENANT_TABLES.has(table)) {
      throw new Error(`FG.db: unknown table "${table}"`);
    }
  };

  // Map a PostgREST/Postgres error to a user-facing toast.
  // Returns nothing — callers decide what sentinel to return on failure.
  const reportError = (op, table, error) => {
    const code = error.code || '';
    let msg;
    if (code === '23505')      msg = `Duplicate ${table.replace(/_/g, ' ')} — that record already exists.`;
    else if (code === '23503') msg = `Can't ${op} — another record depends on this one.`;
    else if (code === '23514') msg = `Invalid value — check the form fields.`;
    else if (code === '42501' || code === 'PGRST301') msg = 'Not authorized.';
    else if (code === 'PGRST116') msg = `${table.replace(/_/g, ' ')} not found.`;
    else                       msg = `${op[0].toUpperCase() + op.slice(1)} failed: ${error.message || 'unknown error'}`;
    if (FG.toast) FG.toast(msg, 'error');
    // eslint-disable-next-line no-console
    console.error(`FG.db ${op} ${table}:`, error);
  };

  // ── companyId() ────────────────────────────────────────────
  // One-shot lookup of the caller's company_id from public.users.
  // Cached for the life of the session. Concurrent callers share
  // the in-flight promise so we don't fire N parallel selects on
  // first paint.
  const companyId = async () => {
    if (_companyIdCache) return _companyIdCache;
    if (_companyIdPromise) return _companyIdPromise;

    _companyIdPromise = (async () => {
      const { data: { user }, error: authError } = await FG.supabase.auth.getUser();
      if (authError || !user) {
        _companyIdPromise = null;
        return null;
      }
      const { data, error } = await FG.supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();
      if (error || !data) {
        _companyIdPromise = null;
        if (error) reportError('load', 'users', error);
        return null;
      }
      _companyIdCache = data.company_id;
      _companyIdPromise = null;
      return _companyIdCache;
    })();

    return _companyIdPromise;
  };

  // ── list ───────────────────────────────────────────────────
  // RLS injects the company_id filter; client passes nothing.
  const list = async (table, opts = {}) => {
    assertTable(table);
    const { orderBy = 'created_at', dir = 'desc' } = opts;
    const { data, error } = await FG.supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: dir === 'asc' });
    if (error) { reportError('load', table, error); return []; }
    return data || [];
  };

  const get = async (table, id) => {
    assertTable(table);
    const { data, error } = await FG.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) { reportError('load', table, error); return null; }
    return data;
  };

  // ── create ─────────────────────────────────────────────────
  // company_id is filled here (no DB trigger sets it); RLS
  // WITH CHECK rejects mismatches. created_by is set by the
  // set_created_by trigger — never send it from the client.
  const create = async (table, payload) => {
    assertTable(table);
    const cid = await companyId();
    if (!cid) { if (FG.toast) FG.toast('Not signed in.', 'error'); return null; }
    const { data, error } = await FG.supabase
      .from(table)
      .insert({ ...payload, company_id: cid })
      .select()
      .single();
    if (error) { reportError('save', table, error); return null; }
    return data;
  };

  const update = async (table, id, patch) => {
    assertTable(table);
    // Strip fields the DB owns so a stale client copy can't clobber them.
    const { id: _id, company_id, created_at, created_by, updated_at, ...clean } = patch;
    const { data, error } = await FG.supabase
      .from(table)
      .update(clean)
      .eq('id', id)
      .select()
      .single();
    if (error) { reportError('save', table, error); return null; }
    return data;
  };

  const remove = async (table, id) => {
    assertTable(table);
    const { error } = await FG.supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (error) { reportError('delete', table, error); return false; }
    return true;
  };

  // ── companies (special-cased: not in TENANT_TABLES) ────────
  const company = async () => {
    const cid = await companyId();
    if (!cid) return null;
    const { data, error } = await FG.supabase
      .from('companies')
      .select('*')
      .eq('id', cid)
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('FG.db company:', error);
      if (FG.toast) FG.toast('Couldn\'t load company profile.', 'error');
      return null;
    }
    return data;
  };

  const updateCompany = async (patch) => {
    const cid = await companyId();
    if (!cid) return null;
    const { id, created_at, updated_at, ...clean } = patch;
    const { data, error } = await FG.supabase
      .from('companies')
      .update(clean)
      .eq('id', cid)
      .select()
      .single();
    if (error) {
      if (FG.toast) FG.toast(`Save failed: ${error.message}`, 'error');
      return null;
    }
    return data;
  };

  return {
    companyId,
    list, get, create, update, remove,
    company, updateCompany,
    _resetCache: () => { _companyIdCache = null; _companyIdPromise = null; },
  };
})();
