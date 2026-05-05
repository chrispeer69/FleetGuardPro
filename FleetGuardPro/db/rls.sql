-- ============================================================
-- FleetGuard Pro — Row Level Security
-- Tenant isolation: every authenticated query is scoped to the
-- caller's company_id via auth_company_id().
-- ============================================================

-- ------------------------------------------------------------
-- Helper: auth_company_id()
-- Resolves the caller's tenant from public.users. SECURITY DEFINER
-- so it can read public.users even when the caller's own RLS would
-- restrict the view; STABLE so PostgREST can cache within a request.
-- ------------------------------------------------------------
create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where id = auth.uid();
$$;

revoke all on function public.auth_company_id() from public;
grant execute on function public.auth_company_id() to authenticated;

-- ------------------------------------------------------------
-- Enable + force RLS on all 16 tables.
-- FORCE prevents the owning role (e.g., supabase_admin during
-- migrations) from silently bypassing policies.
-- ------------------------------------------------------------
alter table public.companies            enable row level security;
alter table public.users                enable row level security;
alter table public.drivers              enable row level security;
alter table public.trucks               enable row level security;
alter table public.garage_shops         enable row level security;
alter table public.maintenance          enable row level security;
alter table public.repairs              enable row level security;
alter table public.parts                enable row level security;
alter table public.dot_files            enable row level security;
alter table public.safety_incidents     enable row level security;
alter table public.insurance_policies   enable row level security;
alter table public.documents            enable row level security;
alter table public.alerts               enable row level security;
alter table public.billing              enable row level security;
alter table public.reports              enable row level security;
alter table public.audit_log            enable row level security;
alter table public.access_requests      enable row level security;

alter table public.companies            force row level security;
alter table public.users                force row level security;
alter table public.drivers              force row level security;
alter table public.trucks               force row level security;
alter table public.garage_shops         force row level security;
alter table public.maintenance          force row level security;
alter table public.repairs              force row level security;
alter table public.parts                force row level security;
alter table public.dot_files            force row level security;
alter table public.safety_incidents     force row level security;
alter table public.insurance_policies   force row level security;
alter table public.documents            force row level security;
alter table public.alerts               force row level security;
alter table public.billing              force row level security;
alter table public.reports              force row level security;
alter table public.audit_log            force row level security;
alter table public.access_requests      force row level security;

-- ============================================================
-- companies — read + update self only.
-- INSERT/DELETE belong to service role (signup, tenant closure).
-- ============================================================
create policy companies_select_own on public.companies
  for select to authenticated
  using (id = public.auth_company_id());

create policy companies_update_own on public.companies
  for update to authenticated
  using (id = public.auth_company_id())
  with check (id = public.auth_company_id());

-- ============================================================
-- users — see all teammates in tenant; only update own row.
-- INSERT/DELETE belong to service role (signup trigger, deprovisioning).
-- ============================================================
create policy users_select_tenant on public.users
  for select to authenticated
  using (company_id = public.auth_company_id());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.auth_company_id());

-- ============================================================
-- Standard tenant tables — full CRUD scoped to company_id.
-- 13 tables × 4 policies = 52 policies.
-- ============================================================

-- drivers ----------------------------------------------------
create policy drivers_select on public.drivers
  for select to authenticated using (company_id = public.auth_company_id());
create policy drivers_insert on public.drivers
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy drivers_update on public.drivers
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy drivers_delete on public.drivers
  for delete to authenticated using (company_id = public.auth_company_id());

-- trucks -----------------------------------------------------
create policy trucks_select on public.trucks
  for select to authenticated using (company_id = public.auth_company_id());
create policy trucks_insert on public.trucks
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy trucks_update on public.trucks
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy trucks_delete on public.trucks
  for delete to authenticated using (company_id = public.auth_company_id());

-- garage_shops -----------------------------------------------
create policy garage_shops_select on public.garage_shops
  for select to authenticated using (company_id = public.auth_company_id());
create policy garage_shops_insert on public.garage_shops
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy garage_shops_update on public.garage_shops
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy garage_shops_delete on public.garage_shops
  for delete to authenticated using (company_id = public.auth_company_id());

-- maintenance ------------------------------------------------
create policy maintenance_select on public.maintenance
  for select to authenticated using (company_id = public.auth_company_id());
create policy maintenance_insert on public.maintenance
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy maintenance_update on public.maintenance
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy maintenance_delete on public.maintenance
  for delete to authenticated using (company_id = public.auth_company_id());

-- repairs ----------------------------------------------------
create policy repairs_select on public.repairs
  for select to authenticated using (company_id = public.auth_company_id());
create policy repairs_insert on public.repairs
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy repairs_update on public.repairs
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy repairs_delete on public.repairs
  for delete to authenticated using (company_id = public.auth_company_id());

-- parts ------------------------------------------------------
create policy parts_select on public.parts
  for select to authenticated using (company_id = public.auth_company_id());
create policy parts_insert on public.parts
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy parts_update on public.parts
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy parts_delete on public.parts
  for delete to authenticated using (company_id = public.auth_company_id());

-- dot_files --------------------------------------------------
create policy dot_files_select on public.dot_files
  for select to authenticated using (company_id = public.auth_company_id());
create policy dot_files_insert on public.dot_files
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy dot_files_update on public.dot_files
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy dot_files_delete on public.dot_files
  for delete to authenticated using (company_id = public.auth_company_id());

-- safety_incidents -------------------------------------------
create policy safety_incidents_select on public.safety_incidents
  for select to authenticated using (company_id = public.auth_company_id());
create policy safety_incidents_insert on public.safety_incidents
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy safety_incidents_update on public.safety_incidents
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy safety_incidents_delete on public.safety_incidents
  for delete to authenticated using (company_id = public.auth_company_id());

-- insurance_policies -----------------------------------------
create policy insurance_policies_select on public.insurance_policies
  for select to authenticated using (company_id = public.auth_company_id());
create policy insurance_policies_insert on public.insurance_policies
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy insurance_policies_update on public.insurance_policies
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy insurance_policies_delete on public.insurance_policies
  for delete to authenticated using (company_id = public.auth_company_id());

-- documents --------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated using (company_id = public.auth_company_id());
create policy documents_insert on public.documents
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy documents_update on public.documents
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy documents_delete on public.documents
  for delete to authenticated using (company_id = public.auth_company_id());

-- alerts -----------------------------------------------------
create policy alerts_select on public.alerts
  for select to authenticated using (company_id = public.auth_company_id());
create policy alerts_insert on public.alerts
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy alerts_update on public.alerts
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy alerts_delete on public.alerts
  for delete to authenticated using (company_id = public.auth_company_id());

-- billing ----------------------------------------------------
-- TODO Phase 2E: remove tenant insert/update/delete here when Stripe
-- webhook flow lands. Soft door for current admin tooling only.
create policy billing_select on public.billing
  for select to authenticated using (company_id = public.auth_company_id());
create policy billing_insert on public.billing
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy billing_update on public.billing
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy billing_delete on public.billing
  for delete to authenticated using (company_id = public.auth_company_id());

-- reports ----------------------------------------------------
create policy reports_select on public.reports
  for select to authenticated using (company_id = public.auth_company_id());
create policy reports_insert on public.reports
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy reports_update on public.reports
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
create policy reports_delete on public.reports
  for delete to authenticated using (company_id = public.auth_company_id());

-- ============================================================
-- audit_log — read-only for tenant; writes only via log_audit()
-- SECURITY DEFINER trigger.
-- ============================================================
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (company_id = public.auth_company_id());

revoke insert, update, delete on public.audit_log from authenticated;

-- ============================================================
-- access_requests — service-role only.
-- Pre-tenant rows: no auth_company_id() to scope by, no public
-- read access (lead pipeline is internal). Writes go through the
-- access-request Edge Function with the service-role key, which
-- bypasses RLS. We still REVOKE table privileges from anon and
-- authenticated as belt-and-suspenders against an accidental
-- policy add — service_role retains its bypass regardless.
--
-- Phase B admin tooling will either keep using service-role
-- (recommended) or add an explicit `to authenticated` policy
-- gated on a future `is_fleetguard_staff()` predicate.
-- ============================================================
revoke select, insert, update, delete on public.access_requests from anon, authenticated;
