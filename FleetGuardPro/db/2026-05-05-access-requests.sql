-- ============================================================
-- Migration: access_requests (Phase A)
-- Apply against an existing FleetGuard Pro database. Fresh
-- builds via schema.sql/rls.sql/functions.sql already include
-- this; this file exists so live databases can pick up the
-- change without re-running the full apply chain.
--
-- After running, in the same SQL editor:
--   notify pgrst, 'reload schema';
-- ============================================================

begin;

-- Table -------------------------------------------------------
create table if not exists public.access_requests (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null,
  contact_name    text not null,
  email           citext not null,
  phone           text not null,
  fleet_size      text,
  referral_source text,
  notes           text,
  source          text not null default 'access-form'
                  check (source in ('access-form','contact-form')),
  status          text not null default 'pending'
                  check (status in ('pending','approved','declined')),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists access_requests_status_idx
  on public.access_requests(status);
create index if not exists access_requests_created_idx
  on public.access_requests(created_at desc);
create index if not exists access_requests_email_idx
  on public.access_requests(email);

-- updated_at trigger reuses the existing touch_updated_at()
-- helper from functions.sql.
drop trigger if exists access_requests_touch_updated_at on public.access_requests;
create trigger access_requests_touch_updated_at
  before update on public.access_requests
  for each row execute function public.touch_updated_at();

-- RLS ---------------------------------------------------------
alter table public.access_requests enable row level security;
alter table public.access_requests force row level security;

-- No policies. service_role bypasses RLS on its own; anon and
-- authenticated have nothing. Belt-and-suspenders: revoke table
-- privileges in case a future policy is added in error.
revoke select, insert, update, delete on public.access_requests from anon, authenticated;

commit;

-- Run this in the same editor session before testing inserts:
--   notify pgrst, 'reload schema';
