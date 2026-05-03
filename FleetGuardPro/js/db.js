// ============================================================
// DB — Supabase-backed CRUD repository (Phase 2C)
// ============================================================
// Mirrors FG.state's surface (list/get/create/update/remove) but async.
// Tenant scoping (company_id) is injected here on insert so no panel
// has to think about it. Reads/updates/deletes rely on RLS — see
// db/rls.sql.
//
// Boot: app.js calls FG.db.init() once after auth confirms a session.
// init() resolves company_id via the auth_company_id() RPC and
// subscribes to onAuthStateChange to refresh on SIGNED_IN, clear on
// SIGNED_OUT. Listener is registered before the initial resolve so
// the auto-fire INITIAL_SESSION at registration is ignored via the
// _booted gate (Option A).
window.FG = window.FG || {};

FG.db = (function () {

  let _companyId = null;
  let _booted = false;
  let _initPromise = null;

  const _resolveCompanyId = async () => {
    if (!FG.supabase) throw new Error('FG.db: Supabase client not initialized.');
    const { data, error } = await FG.supabase.rpc('auth_company_id');
    if (error) throw error;
    return data || null;
  };

  // Idempotent. Re-calls return the in-flight promise so nothing stacks
  // listeners or re-resolves.
  const init = () => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      // Register listener first; auto-fire at registration is gated by _booted.
      // CRITICAL: this listener MUST return synchronously and MUST NOT call
      // any Supabase function (rpc / .from() / .auth.*) inline. Supabase
      // invokes the listener while holding the auth lock; any nested
      // Supabase call re-enters that lock and deadlocks the entire client
      // — every subsequent PostgREST request hangs as Promise<pending>
      // forever. Defer such work via setTimeout(0) so it runs after the
      // lock is released. queueMicrotask is NOT safe here — microtasks
      // run before Supabase's lock-release task.
      // https://supabase.com/docs/reference/javascript/auth-onauthstatechange
      FG.supabase.auth.onAuthStateChange((event) => {
        if (!_booted) return;  // initial resolve handles bootstrap
        if (event === 'SIGNED_OUT') {
          _companyId = null;  // pure local state, safe inline
        } else if (event === 'SIGNED_IN') {
          // Defer rpc OUTSIDE the lock.
          setTimeout(async () => {
            try {
              _companyId = await _resolveCompanyId();
            } catch (e) {
              console.error('FG.db: failed to refresh company_id after SIGNED_IN', e);
            }
          }, 0);
        }
        // TOKEN_REFRESHED: same uid → same company, no-op.
      });
      _companyId = await _resolveCompanyId();
      _booted = true;
    })();
    return _initPromise;
  };

  const companyId = () => _companyId;

  const _wrap = (error) => {
    const translated = FG.dbErrors.translate(error);
    const e = new Error(translated.message);
    e.code = translated.code;
    e.field = translated.field;
    e.raw = translated.raw;
    return e;
  };

  // Empty-string → null for write payloads. The form builder produces "" for
  // any cleared text/select/date/uuid input, but Postgres rejects "" for
  // typed columns (uuid, date, numeric) with 22P02 invalid_text_representation.
  // Treating "" as "no value" matches the form builder's intent and prevents
  // this bug class across every panel.
  // (Numeric and checkbox inputs are already coerced upstream in modals.js.)
  const _coerceEmpty = (obj) => Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])
  );

  // ── CRUD ────────────────────────────────────────────────────
  // RLS scopes reads to the caller's tenant; we don't filter here.
  const list = async (table, opts = {}) => {
    let q = FG.supabase.from(table).select('*');
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending !== false });
    const { data, error } = await q;
    if (error) throw _wrap(error);
    return data || [];
  };

  const get = async (table, id) => {
    const { data, error } = await FG.supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw _wrap(error);
    return data || null;
  };

  const create = async (table, data) => {
    if (!_companyId) {
      // Loud failure: silent inserts would die at RLS with a less obvious trail.
      throw new Error(`FG.db.create(${table}): company_id not resolved. Call FG.db.init() after sign-in.`);
    }
    const payload = { company_id: _companyId, ..._coerceEmpty(data) };
    // created_by is filled by the set_created_by trigger (db/functions.sql).
    const { data: row, error } = await FG.supabase.from(table).insert(payload).select().single();
    if (error) throw _wrap(error);
    return row;
  };

  const update = async (table, id, patch) => {
    // company_id already on the row; RLS enforces tenant on UPDATE.
    const { data: row, error } = await FG.supabase.from(table).update(_coerceEmpty(patch)).eq('id', id).select().single();
    if (error) throw _wrap(error);
    return row;
  };

  const remove = async (table, id) => {
    const { error } = await FG.supabase.from(table).delete().eq('id', id);
    if (error) throw _wrap(error);
  };

  return { init, companyId, list, get, create, update, remove };
})();
