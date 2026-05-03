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

  // ── [WEDGE-DIAG] diagnostic instrumentation (Phase 2C bug hunt) ──
  // Fire-and-forget: never awaits, never blocks the real operation.
  // Remove this block + every "[WEDGE-DIAG]" call once the wedge is fixed.
  const _ts = () => new Date().toISOString().slice(11, 23);
  const _diagLocks = (label) => {
    if (!(navigator.locks && navigator.locks.query)) {
      console.log(`[WEDGE-DIAG] ${_ts()} ${label} | navigator.locks unavailable`);
      return;
    }
    const stamp = _ts();
    navigator.locks.query().then(({ held, pending }) => {
      const fmt = (arr) => arr.length ? arr.map(l => `${l.name}(${l.mode})`).join(',') : '(none)';
      console.log(`[WEDGE-DIAG] ${stamp} ${label} | held=${fmt(held)} pending=${fmt(pending)}`);
    }).catch(e => console.log(`[WEDGE-DIAG] ${stamp} ${label} | locks query failed:`, e));
  };
  // ─────────────────────────────────────────────────────────────────

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
      FG.supabase.auth.onAuthStateChange(async (event) => {
        console.log(`[WEDGE-DIAG] ${_ts()} auth.onAuthStateChange ENTRY event=${event} _booted=${_booted} _companyId=${_companyId}`);
        _diagLocks(`auth listener entry (${event})`);
        if (!_booted) {
          console.log(`[WEDGE-DIAG] ${_ts()} auth.onAuthStateChange EXIT (not booted) event=${event}`);
          return;  // initial resolve handles bootstrap
        }
        if (event === 'SIGNED_IN')  _companyId = await _resolveCompanyId();
        if (event === 'SIGNED_OUT') _companyId = null;
        // TOKEN_REFRESHED: same uid → same company, no-op.
        console.log(`[WEDGE-DIAG] ${_ts()} auth.onAuthStateChange EXIT event=${event} _companyId=${_companyId}`);
        _diagLocks(`auth listener exit (${event})`);
      });
      console.log(`[WEDGE-DIAG] ${_ts()} init: about to resolve company_id`);
      _diagLocks('init pre-resolve');
      _companyId = await _resolveCompanyId();
      _booted = true;
      console.log(`[WEDGE-DIAG] ${_ts()} init: booted, _companyId=${_companyId}`);
      _diagLocks('init post-resolve');
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
    console.log(`[WEDGE-DIAG] ${_ts()} list('${table}') ENTRY _booted=${_booted} _companyId=${_companyId}`);
    _diagLocks(`list('${table}') entry`);
    let q = FG.supabase.from(table).select('*');
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending !== false });
    const { data, error } = await q;
    console.log(`[WEDGE-DIAG] ${_ts()} list('${table}') EXIT rows=${data ? data.length : 'null'} error=${error ? error.code : 'none'}`);
    if (error) throw _wrap(error);
    return data || [];
  };

  const get = async (table, id) => {
    console.log(`[WEDGE-DIAG] ${_ts()} get('${table}', ${id}) ENTRY`);
    _diagLocks(`get('${table}') entry`);
    const { data, error } = await FG.supabase.from(table).select('*').eq('id', id).maybeSingle();
    console.log(`[WEDGE-DIAG] ${_ts()} get('${table}', ${id}) EXIT found=${!!data} error=${error ? error.code : 'none'}`);
    if (error) throw _wrap(error);
    return data || null;
  };

  const create = async (table, data) => {
    console.log(`[WEDGE-DIAG] ${_ts()} create('${table}') ENTRY _booted=${_booted} _companyId=${_companyId}`);
    _diagLocks(`create('${table}') entry`);
    if (!_companyId) {
      console.log(`[WEDGE-DIAG] ${_ts()} create('${table}') BLOCKED: no _companyId`);
      // Loud failure: silent inserts would die at RLS with a less obvious trail.
      throw new Error(`FG.db.create(${table}): company_id not resolved. Call FG.db.init() after sign-in.`);
    }
    const payload = { company_id: _companyId, ..._coerceEmpty(data) };
    // created_by is filled by the set_created_by trigger (db/functions.sql).
    const { data: row, error } = await FG.supabase.from(table).insert(payload).select().single();
    console.log(`[WEDGE-DIAG] ${_ts()} create('${table}') EXIT id=${row ? row.id : 'null'} error=${error ? error.code : 'none'}`);
    if (error) throw _wrap(error);
    return row;
  };

  const update = async (table, id, patch) => {
    console.log(`[WEDGE-DIAG] ${_ts()} update('${table}', ${id}) ENTRY`);
    _diagLocks(`update('${table}') entry`);
    // company_id already on the row; RLS enforces tenant on UPDATE.
    const { data: row, error } = await FG.supabase.from(table).update(_coerceEmpty(patch)).eq('id', id).select().single();
    console.log(`[WEDGE-DIAG] ${_ts()} update('${table}', ${id}) EXIT error=${error ? error.code : 'none'}`);
    if (error) throw _wrap(error);
    return row;
  };

  const remove = async (table, id) => {
    console.log(`[WEDGE-DIAG] ${_ts()} remove('${table}', ${id}) ENTRY`);
    _diagLocks(`remove('${table}') entry`);
    const { error } = await FG.supabase.from(table).delete().eq('id', id);
    console.log(`[WEDGE-DIAG] ${_ts()} remove('${table}', ${id}) EXIT error=${error ? error.code : 'none'}`);
    if (error) throw _wrap(error);
  };

  return { init, companyId, list, get, create, update, remove };
})();
