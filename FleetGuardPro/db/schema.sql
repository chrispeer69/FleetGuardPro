-- ============================================================
-- FleetGuard Pro — Schema
-- Source of truth for column names: FleetGuardPro/js/seed.js
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  dot_number      text,
  mc_number       text,
  puco_number     text,
  fleet_type      text,
  address         text,
  phone           text,
  email           citext,
  website         text,
  contact_name    text,
  contact_title   text,
  contact_email   citext,
  contact_phone   text,
  plan            text not null default 'all-access'
                  check (plan in ('a-la-carte','all-access')),
  services        text[] not null default '{}',
  member_since    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- users — mirrors auth.users 1:1
-- UNIQUE(company_id) enforces single-user-per-company in Phase 2.
-- ------------------------------------------------------------
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  company_id      uuid not null unique
                  references public.companies(id) on delete cascade,
  email           citext not null,
  full_name       text,
  role            text not null default 'owner'
                  check (role in ('owner','admin','member','viewer')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- drivers (declared before trucks so assigned_driver_id FK resolves)
-- ------------------------------------------------------------
create table public.drivers (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  name                  text not null,
  cdl_number            text,
  cdl_class             text check (cdl_class in ('Class A','Class B','Class C')),
  cdl_expiry            date,
  medical_card_expiry   date,
  hire_date             date,
  status                text not null default 'Active'
                        check (status in ('Active','On Leave','Flagged','Inactive','Terminated')),
  safety_score          integer check (safety_score between 0 and 100),
  phone                 text,
  email                 citext,
  address               text,
  dob                   date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.users(id) on delete set null
);

create index drivers_company_id_idx       on public.drivers(company_id);
create index drivers_created_by_idx       on public.drivers(created_by);
create index drivers_company_created_idx  on public.drivers(company_id, created_at desc);

-- ------------------------------------------------------------
-- trucks
-- assigned_driver_id replaces seed.js string field "assigned_driver".
-- ------------------------------------------------------------
create table public.trucks (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  unit_number           text not null,
  year                  integer check (year between 1980 and 2100),
  make                  text,
  model                 text,
  vin                   text,
  plate                 text,
  type                  text check (type in ('Tow Truck','Box Truck','Pickup','Other')),
  status                text not null default 'Active'
                        check (status in ('Active','PM Overdue','Flagged','In Shop','Out of Service','Sold')),
  mileage               integer check (mileage >= 0),
  next_pm_miles         integer check (next_pm_miles >= 0),
  next_pm_date          date,
  safety_score          integer check (safety_score between 0 and 100),
  gvwr                  integer check (gvwr >= 0),
  color                 text,
  assigned_driver_id    uuid references public.drivers(id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.users(id) on delete set null,
  unique (company_id, unit_number)
);

create index trucks_company_id_idx          on public.trucks(company_id);
create index trucks_assigned_driver_id_idx  on public.trucks(assigned_driver_id);
create index trucks_created_by_idx          on public.trucks(created_by);
create index trucks_company_created_idx     on public.trucks(company_id, created_at desc);

-- ------------------------------------------------------------
-- garage_shops (declared before repairs so shop_id FK resolves)
-- ------------------------------------------------------------
create table public.garage_shops (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  tier            text check (tier in ('Partner','Preferred','Standard')),
  specialties     text,
  address         text,
  phone           text,
  contact         text,
  rating          numeric(3,1) check (rating between 0 and 5),
  discount_pct    numeric(5,2) check (discount_pct between 0 and 100),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  unique (company_id, name)
);

create index garage_shops_company_id_idx       on public.garage_shops(company_id);
create index garage_shops_created_by_idx       on public.garage_shops(created_by);
create index garage_shops_company_created_idx  on public.garage_shops(company_id, created_at desc);

-- ------------------------------------------------------------
-- maintenance
-- ------------------------------------------------------------
create table public.maintenance (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  truck_id        uuid not null references public.trucks(id) on delete cascade,
  type            text not null,
  due_date        date,
  due_miles       integer check (due_miles >= 0),
  status          text not null default 'Scheduled'
                  check (status in ('Scheduled','In Progress','Completed','Overdue','Cancelled')),
  notes           text,
  completed_date  date,
  cost            numeric(12,2) check (cost >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index maintenance_company_id_idx       on public.maintenance(company_id);
create index maintenance_truck_id_idx         on public.maintenance(truck_id);
create index maintenance_created_by_idx       on public.maintenance(created_by);
create index maintenance_company_created_idx  on public.maintenance(company_id, created_at desc);

-- ------------------------------------------------------------
-- repairs
-- shop_id replaces seed.js string field "shop" (held a shop name).
-- ------------------------------------------------------------
create table public.repairs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  truck_id        uuid not null references public.trucks(id) on delete cascade,
  shop_id         uuid references public.garage_shops(id) on delete set null,
  issue           text not null,
  priority        text not null default 'Medium'
                  check (priority in ('Low','Medium','High','Critical')),
  status          text not null default 'Open'
                  check (status in ('Open','In Progress','Closed','Cancelled')),
  est_cost        numeric(12,2) check (est_cost >= 0),
  opened_date     date not null default current_date,
  closed_date     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index repairs_company_id_idx       on public.repairs(company_id);
create index repairs_truck_id_idx         on public.repairs(truck_id);
create index repairs_shop_id_idx          on public.repairs(shop_id);
create index repairs_created_by_idx       on public.repairs(created_by);
create index repairs_company_created_idx  on public.repairs(company_id, created_at desc);

-- ------------------------------------------------------------
-- parts
-- ------------------------------------------------------------
create table public.parts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  sku             text,
  category        text,
  vendor          text,
  qty_on_hand     integer not null default 0 check (qty_on_hand >= 0),
  reorder_point   integer not null default 0 check (reorder_point >= 0),
  unit_cost       numeric(12,2) check (unit_cost >= 0),
  location        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  unique (company_id, sku)
);

create index parts_company_id_idx       on public.parts(company_id);
create index parts_created_by_idx       on public.parts(created_by);
create index parts_company_created_idx  on public.parts(company_id, created_at desc);

-- ------------------------------------------------------------
-- dot_files
-- driver_id and truck_id both nullable: company-scope docs (IFTA, PUCO).
-- ------------------------------------------------------------
create table public.dot_files (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  type            text not null,
  driver_id       uuid references public.drivers(id) on delete cascade,
  truck_id        uuid references public.trucks(id) on delete set null,
  name            text not null,
  file_size       bigint check (file_size >= 0),
  storage_path    text,
  uploaded_date   date,
  expires_date    date,
  status          text not null default 'Active'
                  check (status in ('Active','Expiring','Expired','Archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index dot_files_company_id_idx       on public.dot_files(company_id);
create index dot_files_driver_id_idx        on public.dot_files(driver_id);
create index dot_files_truck_id_idx         on public.dot_files(truck_id);
create index dot_files_created_by_idx       on public.dot_files(created_by);
create index dot_files_company_created_idx  on public.dot_files(company_id, created_at desc);

-- ------------------------------------------------------------
-- safety_incidents
-- ------------------------------------------------------------
create table public.safety_incidents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  driver_id       uuid references public.drivers(id) on delete cascade,
  truck_id        uuid references public.trucks(id) on delete set null,
  type            text not null,
  severity        text not null default 'Low'
                  check (severity in ('Low','Medium','High','Critical')),
  date            date not null default current_date,
  description     text,
  status          text not null default 'Open'
                  check (status in ('Open','Reviewed','Closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index safety_incidents_company_id_idx       on public.safety_incidents(company_id);
create index safety_incidents_driver_id_idx        on public.safety_incidents(driver_id);
create index safety_incidents_truck_id_idx         on public.safety_incidents(truck_id);
create index safety_incidents_created_by_idx       on public.safety_incidents(created_by);
create index safety_incidents_company_created_idx  on public.safety_incidents(company_id, created_at desc);

-- ------------------------------------------------------------
-- insurance_policies
-- ------------------------------------------------------------
create table public.insurance_policies (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  carrier         text not null,
  policy_number   text not null,
  type            text not null,
  premium         numeric(12,2) check (premium >= 0),
  deductible      numeric(12,2) check (deductible >= 0),
  effective_date  date,
  expiry_date     date,
  coverage_limit  numeric(14,2) check (coverage_limit >= 0),
  status          text not null default 'Active'
                  check (status in ('Active','Expiring','Expired','Cancelled','Pending')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  unique (company_id, policy_number)
);

create index insurance_policies_company_id_idx       on public.insurance_policies(company_id);
create index insurance_policies_created_by_idx       on public.insurance_policies(created_by);
create index insurance_policies_company_created_idx  on public.insurance_policies(company_id, created_at desc);

-- ------------------------------------------------------------
-- documents
-- ------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  category        text,
  file_size       bigint check (file_size >= 0),
  storage_path    text,
  uploaded_date   date,
  uploaded_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index documents_company_id_idx       on public.documents(company_id);
create index documents_created_by_idx       on public.documents(created_by);
create index documents_company_created_idx  on public.documents(company_id, created_at desc);

-- ------------------------------------------------------------
-- alerts
-- related_type / related_id: polymorphic pointer; no FK.
-- auto + auto_key: dedupe key for auto-generated alerts.
-- ------------------------------------------------------------
create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  type            text not null
                  check (type in ('maintenance','safety','compliance','insurance','parts','billing','system')),
  severity        text not null default 'medium'
                  check (severity in ('low','medium','high')),
  title           text not null,
  message         text,
  date            date not null default current_date,
  read            boolean not null default false,
  related_type    text,
  related_id      uuid,
  auto            boolean not null default false,
  auto_key        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  unique (company_id, auto_key)
);

create index alerts_company_id_idx       on public.alerts(company_id);
create index alerts_related_id_idx       on public.alerts(related_id);
create index alerts_created_by_idx       on public.alerts(created_by);
create index alerts_company_created_idx  on public.alerts(company_id, created_at desc);

-- ------------------------------------------------------------
-- billing
-- ------------------------------------------------------------
create table public.billing (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  invoice_number      text not null,
  plan                text,
  amount              numeric(12,2) not null check (amount >= 0),
  period_start        date,
  period_end          date,
  status              text not null default 'Pending'
                      check (status in ('Draft','Pending','Paid','Failed','Refunded','Void')),
  issued_date         date,
  paid_date           date,
  stripe_invoice_id   text,
  stripe_charge_id    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.users(id) on delete set null,
  unique (company_id, invoice_number)
);

create index billing_company_id_idx       on public.billing(company_id);
create index billing_created_by_idx       on public.billing(created_by);
create index billing_company_created_idx  on public.billing(company_id, created_at desc);

-- ------------------------------------------------------------
-- reports
-- ------------------------------------------------------------
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  type            text not null
                  check (type in ('safety','maintenance','compliance','insurance','financial','custom')),
  name            text not null,
  period          text,
  generated_date  timestamptz not null default now(),
  summary         text,
  payload         jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null
);

create index reports_company_id_idx       on public.reports(company_id);
create index reports_created_by_idx       on public.reports(created_by);
create index reports_company_created_idx  on public.reports(company_id, created_at desc);

-- ------------------------------------------------------------
-- audit_log — append-only; no created_by, no updated_at.
-- entity_id nullable for statement-level events (resets, signups).
-- ------------------------------------------------------------
create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  actor_id        uuid references public.users(id) on delete set null,
  action          text not null check (action in ('insert','update','delete','select','system')),
  entity_type     text not null,
  entity_id       uuid,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_company_id_idx       on public.audit_log(company_id);
create index audit_log_actor_id_idx         on public.audit_log(actor_id);
create index audit_log_entity_idx           on public.audit_log(entity_type, entity_id);
create index audit_log_company_created_idx  on public.audit_log(company_id, created_at desc);
