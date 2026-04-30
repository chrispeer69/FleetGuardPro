-- ============================================================
-- FleetGuard Pro — Trigger functions
-- ============================================================

-- ------------------------------------------------------------
-- touch_updated_at — bump updated_at on every row update.
-- Attached to all 15 entity tables (audit_log is immutable).
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

create trigger drivers_touch_updated_at
  before update on public.drivers
  for each row execute function public.touch_updated_at();

create trigger trucks_touch_updated_at
  before update on public.trucks
  for each row execute function public.touch_updated_at();

create trigger garage_shops_touch_updated_at
  before update on public.garage_shops
  for each row execute function public.touch_updated_at();

create trigger maintenance_touch_updated_at
  before update on public.maintenance
  for each row execute function public.touch_updated_at();

create trigger repairs_touch_updated_at
  before update on public.repairs
  for each row execute function public.touch_updated_at();

create trigger parts_touch_updated_at
  before update on public.parts
  for each row execute function public.touch_updated_at();

create trigger dot_files_touch_updated_at
  before update on public.dot_files
  for each row execute function public.touch_updated_at();

create trigger safety_incidents_touch_updated_at
  before update on public.safety_incidents
  for each row execute function public.touch_updated_at();

create trigger insurance_policies_touch_updated_at
  before update on public.insurance_policies
  for each row execute function public.touch_updated_at();

create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();

create trigger alerts_touch_updated_at
  before update on public.alerts
  for each row execute function public.touch_updated_at();

create trigger billing_touch_updated_at
  before update on public.billing
  for each row execute function public.touch_updated_at();

create trigger reports_touch_updated_at
  before update on public.reports
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- set_created_by — fill created_by from auth.uid() on insert
-- if the client didn't provide one. SECURITY INVOKER: runs as
-- the caller, so auth.uid() resolves to the real user.
-- Attached to 13 entity tables (not companies, users, audit_log).
-- ------------------------------------------------------------
create or replace function public.set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger drivers_set_created_by
  before insert on public.drivers
  for each row execute function public.set_created_by();

create trigger trucks_set_created_by
  before insert on public.trucks
  for each row execute function public.set_created_by();

create trigger garage_shops_set_created_by
  before insert on public.garage_shops
  for each row execute function public.set_created_by();

create trigger maintenance_set_created_by
  before insert on public.maintenance
  for each row execute function public.set_created_by();

create trigger repairs_set_created_by
  before insert on public.repairs
  for each row execute function public.set_created_by();

create trigger parts_set_created_by
  before insert on public.parts
  for each row execute function public.set_created_by();

create trigger dot_files_set_created_by
  before insert on public.dot_files
  for each row execute function public.set_created_by();

create trigger safety_incidents_set_created_by
  before insert on public.safety_incidents
  for each row execute function public.set_created_by();

create trigger insurance_policies_set_created_by
  before insert on public.insurance_policies
  for each row execute function public.set_created_by();

create trigger documents_set_created_by
  before insert on public.documents
  for each row execute function public.set_created_by();

create trigger alerts_set_created_by
  before insert on public.alerts
  for each row execute function public.set_created_by();

create trigger billing_set_created_by
  before insert on public.billing
  for each row execute function public.set_created_by();

create trigger reports_set_created_by
  before insert on public.reports
  for each row execute function public.set_created_by();

-- ------------------------------------------------------------
-- log_audit — write to audit_log on every entity write.
-- SECURITY DEFINER so the insert into audit_log bypasses the
-- caller's RLS (audit_log has no INSERT policy for authenticated).
-- ------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_entity_id  uuid;
  v_before     jsonb;
  v_after      jsonb;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_entity_id  := old.id;
    v_before     := row_to_json(old)::jsonb;
    v_after      := null;
  elsif tg_op = 'UPDATE' then
    v_company_id := new.company_id;
    v_entity_id  := new.id;
    v_before     := row_to_json(old)::jsonb;
    v_after      := row_to_json(new)::jsonb;
  else  -- INSERT
    v_company_id := new.company_id;
    v_entity_id  := new.id;
    v_before     := null;
    v_after      := row_to_json(new)::jsonb;
  end if;

  insert into public.audit_log (company_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_company_id, auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_before, v_after);

  return null;  -- AFTER trigger; return value is ignored
end;
$$;

revoke execute on function public.log_audit() from public;
grant execute on function public.log_audit() to authenticated;

create trigger drivers_log_audit
  after insert or update or delete on public.drivers
  for each row execute function public.log_audit();

create trigger trucks_log_audit
  after insert or update or delete on public.trucks
  for each row execute function public.log_audit();

create trigger garage_shops_log_audit
  after insert or update or delete on public.garage_shops
  for each row execute function public.log_audit();

create trigger maintenance_log_audit
  after insert or update or delete on public.maintenance
  for each row execute function public.log_audit();

create trigger repairs_log_audit
  after insert or update or delete on public.repairs
  for each row execute function public.log_audit();

create trigger parts_log_audit
  after insert or update or delete on public.parts
  for each row execute function public.log_audit();

create trigger dot_files_log_audit
  after insert or update or delete on public.dot_files
  for each row execute function public.log_audit();

create trigger safety_incidents_log_audit
  after insert or update or delete on public.safety_incidents
  for each row execute function public.log_audit();

create trigger insurance_policies_log_audit
  after insert or update or delete on public.insurance_policies
  for each row execute function public.log_audit();

create trigger documents_log_audit
  after insert or update or delete on public.documents
  for each row execute function public.log_audit();

create trigger alerts_log_audit
  after insert or update or delete on public.alerts
  for each row execute function public.log_audit();

create trigger billing_log_audit
  after insert or update or delete on public.billing
  for each row execute function public.log_audit();

create trigger reports_log_audit
  after insert or update or delete on public.reports
  for each row execute function public.log_audit();

-- ------------------------------------------------------------
-- on_auth_user_created — bootstrap a tenant + user row when a
-- new auth.users row is inserted (signup). SECURITY DEFINER so
-- it can write public.companies and public.users regardless of
-- the caller's RLS context.
-- ------------------------------------------------------------
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  insert into public.companies (name)
  values (coalesce(new.raw_user_meta_data->>'company_name', 'New Company'))
  returning id into v_company_id;

  insert into public.users (id, company_id, email, role)
  values (new.id, v_company_id, new.email, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();
