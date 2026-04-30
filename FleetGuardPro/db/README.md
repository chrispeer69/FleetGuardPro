# FleetGuardPro — Database

This directory holds the Postgres/Supabase definition for FleetGuardPro: schema (tables, indexes), RLS policies, helper functions, and seed data for the ABC Towing LLC demo tenant. Everything here is plain SQL meant to run against a Supabase project's `public` schema. Frontend connection settings go in `.env.local` (see `.env.example`).

## Apply order

Run these files in order. Each one assumes the previous has succeeded.

1. `schema.sql` — tables, columns, indexes, FKs
2. `rls.sql` — Row Level Security policies (company-scoped)
3. `functions.sql` — triggers, helper functions
4. `seed.sql` — core entities (1 company, 5 drivers, 7 trucks, 6 garage shops)
5. `seed-extras-1.sql` — maintenance, repairs, parts, dot_files, safety_incidents
6. `seed-extras-2.sql` — insurance_policies, documents, alerts, billing, reports

## How to apply

1. Open Supabase Studio → **SQL Editor**
2. Paste the contents of the next file in the apply order above
3. Click **Run**
4. Verify no errors in the result panel before moving to the next file
5. Repeat for each file

If a file fails partway, fix the underlying issue and re-run from the failed file. Each seed file is wrapped in `BEGIN; ... COMMIT;` so a failure rolls back cleanly.

## Linking your auth user to the demo company

After seeding, your Supabase signup user has no `company_id` and won't see any data through RLS. Link it once from the SQL Editor:

```sql
UPDATE public.users
SET company_id = (SELECT id FROM companies WHERE name = 'ABC Towing LLC')
WHERE id = '<your auth.uid>';
```

Find your `auth.uid` in Studio → **Authentication → Users** (or run `SELECT auth.uid();` while logged in via the API).

## Resetting dev

To wipe and start clean:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
```

Then re-run the apply order from the top. Don't do this on anything but a dev project.

## Frontend connection

Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase Studio → **Settings → API**. The `service_role` key is server-side only — it bypasses RLS and must never ship to the browser.
