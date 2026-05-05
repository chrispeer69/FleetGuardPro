-- ============================================================
-- Migration: Phase B admin approval workflow
-- Apply against an existing FleetGuard Pro database. Fresh
-- builds via schema.sql/rls.sql/functions.sql already include
-- this; this file exists so live databases can pick up the
-- change without re-running the full apply chain.
--
-- After running, in the same SQL editor:
--   notify pgrst, 'reload schema';
--
-- Then bootstrap your admin user (replace email if different):
--   update public.users set is_admin = true
--   where email = 'chris@bluecollarai.online';
-- ============================================================

begin;

-- New columns ------------------------------------------------
alter table public.users
  add column if not exists is_admin boolean not null default false;

alter table public.companies
  add column if not exists trial_ends_at timestamptz;

alter table public.companies
  add column if not exists access_type text not null default 'paid'
    check (access_type in ('free_trial','paid'));

alter table public.access_requests
  add column if not exists approval_metadata jsonb;

-- Privilege locks --------------------------------------------
-- Tenant users have UPDATE on their own row (users_update_self) and
-- on their company row (companies_update_own). Without these column
-- locks they could escalate themselves to admin or extend their own
-- trial. service_role bypasses column-level privileges and writes
-- these columns from the admin-approve-request Edge Function.
revoke update (is_admin)                    on public.users     from authenticated;
revoke update (access_type, trial_ends_at)  on public.companies from authenticated;

-- Admin policies on access_requests --------------------------
-- access_requests was service-role-only in Phase A. The admin
-- review surface (panels/admin.js) now reads + updates rows with
-- the caller's JWT, gated by is_admin. Approval still flows
-- through admin-approve-request (service_role) so it can also
-- create the auth.users invite; decline goes direct via these
-- policies.
grant select, update on public.access_requests to authenticated;

drop policy if exists access_requests_admin_select on public.access_requests;
create policy access_requests_admin_select on public.access_requests
  for select to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
  );

drop policy if exists access_requests_admin_update on public.access_requests;
create policy access_requests_admin_update on public.access_requests
  for update to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
  );

commit;

-- Run this in the same editor session before testing:
--   notify pgrst, 'reload schema';
