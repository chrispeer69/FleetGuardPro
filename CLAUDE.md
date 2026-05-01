# CLAUDE.md

Working notes for Claude sessions on FleetGuard Pro. Lessons that aren't obvious from the code or git history but matter for future waves.

---

## Supabase / PostgREST

### After any DDL migration, reload PostgREST's schema cache

After applying schema changes to the live Supabase project (CHECK constraint changes, FK behavior changes, column adds, table ALTERs), PostgREST keeps its old schema cache until explicitly told to refresh. Symptoms of a stale cache range from confusing 4xx errors to **silently hung requests** — writes never reach the server, the fetch promise stays `<pending>` forever, and the supabase-js client looks wedged for all subsequent calls.

**Run this in the Supabase SQL editor immediately after applying any DDL migration, before testing:**

```sql
notify pgrst, 'reload schema';
```

Discovered Wave 2 (2026-05-01): the `trucks_type_check` constraint extension and the `dot_files` / `safety_incidents` FK behavior changes left PostgREST silently dropping POSTs against the new shape. The bug presented as "modal froze on save with no console errors and no visible POST in network tab" — much harder to diagnose than the actual fix.

Always-do-this checklist when applying a Wave's prep migration:
1. Run the migration SQL in Supabase SQL editor.
2. Run the verification query (constraint names / FK definitions match expectations).
3. **Run `notify pgrst, 'reload schema';`**
4. Then test against the new shape.
