// ============================================================
// DB — thin wrapper over FG.supabase for table CRUD.
// Returns { data, error } on success; logs and returns null on error.
// ============================================================
window.FG = window.FG || {};

FG.db = (function () {
  let _companyId = null;

  const logErr = (where, error) => console.error(`[FG.db.${where}]`, error);

  async function companyId() {
    if (_companyId) return _companyId;
    const { data: { user }, error: authErr } = await FG.supabase.auth.getUser();
    if (authErr) { logErr('companyId:auth', authErr); return null; }
    if (!user) { logErr('companyId', 'no auth user'); return null; }
    const { data, error } = await FG.supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (error) { logErr('companyId', error); return null; }
    _companyId = data.company_id;
    return _companyId;
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
    if (error) { logErr(`list:${table}`, error); return null; }
    return { data, error: null };
  }

  async function get(table, id) {
    const { data, error } = await FG.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) { logErr(`get:${table}`, error); return null; }
    return { data, error: null };
  }

  async function create(table, row) {
    const cid = await companyId();
    if (!cid) return null;
    const { data, error } = await FG.supabase
      .from(table)
      .insert({ ...row, company_id: cid })
      .select()
      .single();
    if (error) { logErr(`create:${table}`, error); return null; }
    return { data, error: null };
  }

  async function update(table, id, patch) {
    const { data, error } = await FG.supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) { logErr(`update:${table}`, error); return null; }
    return { data, error: null };
  }

  async function remove(table, id) {
    const { data, error } = await FG.supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (error) { logErr(`remove:${table}`, error); return null; }
    return { data, error: null };
  }

  return { list, get, create, update, remove, companyId, setCompanyId };
})();
