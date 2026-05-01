// ============================================================
// DB — thin wrapper over FG.supabase for table CRUD.
// Always returns { data, error } — matches Supabase native shape.
// Success: { data: result, error: null }. Failure: { data: null, error }.
// ============================================================
window.FG = window.FG || {};

FG.db = (function () {
  let _companyId = null;

  const logErr = (where, error) => console.error(`[FG.db.${where}]`, error);

  async function companyId() {
    if (_companyId) return { data: _companyId, error: null };
    const { data: { user }, error: authErr } = await FG.supabase.auth.getUser();
    if (authErr) { logErr('companyId:auth', authErr); return { data: null, error: authErr }; }
    if (!user) {
      const error = new Error('no auth user');
      logErr('companyId', error);
      return { data: null, error };
    }
    const { data, error } = await FG.supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (error) { logErr('companyId', error); return { data: null, error }; }
    _companyId = data.company_id;
    return { data: _companyId, error: null };
  }

  function setCompanyId(id) {
    _companyId = id;
  }

  async function list(table, opts = {}) {
    let q = FG.supabase.from(table).select('*');
    if (opts.order) {
      const { column, ascending = true } = opts.order;
      q = q.order(column, { ascending });
    }
    if (opts.range) {
      const [from, to] = opts.range;
      q = q.range(from, to);
    }
    const { data, error } = await q;
    if (error) { logErr(`list:${table}`, error); return { data: null, error }; }
    return { data, error: null };
  }

  async function get(table, id) {
    const { data, error } = await FG.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) { logErr(`get:${table}`, error); return { data: null, error }; }
    return { data, error: null };
  }

  async function create(table, row) {
    const { data: cid } = await companyId();
    const payload = cid ? { ...row, company_id: cid } : { ...row };
    const { data, error } = await FG.supabase
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) { logErr(`create:${table}`, error); return { data: null, error }; }
    return { data, error: null };
  }

  async function update(table, id, patch) {
    const { data, error } = await FG.supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) { logErr(`update:${table}`, error); return { data: null, error }; }
    return { data, error: null };
  }

  async function remove(table, id) {
    const { data, error } = await FG.supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (error) { logErr(`remove:${table}`, error); return { data: null, error }; }
    return { data, error: null };
  }

  return { list, get, create, update, remove, companyId, setCompanyId };
})();
