-- ============================================================
-- FleetGuard Pro — Demo seed (core entities)
-- Sourced from FleetGuardPro/js/seed.js. Single tenant: ABC Towing LLC.
-- This file covers: companies, drivers, trucks, garage_shops.
-- Dependent entities (maintenance, repairs, parts, ...) ship in
-- a follow-up file (seed-extras.sql).
-- ============================================================

begin;

with co as (
  insert into public.companies (
    name, dot_number, mc_number, puco_number, fleet_type,
    address, phone, email, website,
    contact_name, contact_title, contact_email, contact_phone,
    plan, services, member_since
  ) values (
    'ABC Towing LLC', 'US-3284917', 'MC-892431', 'PUCO-441293', 'Mixed (Tow + Box)',
    '4521 Industrial Pkwy, Columbus, OH 43215', '(614) 555-0190', 'ops@abctowing.com', 'www.abctowing.com',
    'John Smith', 'Owner / Operator', 'john@abctowing.com', '(614) 555-0100',
    'all-access', array['safety','compliance','maintenance','insurance'], '2023-08-14'
  )
  returning id
),

-- Drivers (5) -------------------------------------------------
d_marcus as (
  insert into public.drivers (
    company_id, name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  select id, 'Marcus Johnson', 'OH-CD893421', 'Class B', '2026-09-12', '2025-11-30',
         '2020-03-15', 'Active', 91, '(614) 555-0211', 'marcus@abctowing.com',
         '1820 Oakridge Dr, Columbus OH', '1985-06-22', 'Senior driver. Trains new hires.', null
  from co
  returning id
),
d_tasha as (
  insert into public.drivers (
    company_id, name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  select id, 'Tasha Williams', 'OH-CD712890', 'Class B', '2027-04-05', '2026-02-15',
         '2021-07-08', 'Active', 96, '(614) 555-0223', 'tasha@abctowing.com',
         '733 Maple St, Reynoldsburg OH', '1990-11-04', 'Top safety score in fleet.', null
  from co
  returning id
),
d_devon as (
  insert into public.drivers (
    company_id, name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  select id, 'Devon Carter', 'OH-CD445112', 'Class A', '2025-12-01', '2025-06-15',
         '2019-11-22', 'Flagged', 68, '(614) 555-0244', 'devon@abctowing.com',
         '92 Lincoln Ave, Whitehall OH', '1988-02-14',
         'Coaching session scheduled — speeding flags.', null
  from co
  returning id
),
d_alicia as (
  insert into public.drivers (
    company_id, name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  select id, 'Alicia Romero', 'OH-CD998023', 'Class B', '2026-06-30', '2025-12-20',
         '2022-01-10', 'Active', 89, '(614) 555-0258', 'alicia@abctowing.com',
         '1455 Cedar Lane, Dublin OH', '1992-09-17', 'Box truck specialist.', null
  from co
  returning id
),
d_brandon as (
  insert into public.drivers (
    company_id, name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  select id, 'Brandon Kim', 'OH-CD220391', 'Class B', '2026-01-18', '2025-08-05',
         '2023-05-19', 'On Leave', 87, '(614) 555-0271', 'brandon@abctowing.com',
         '4 Pinecrest Rd, Westerville OH', '1995-03-28',
         'Returning from medical leave June 1.', null
  from co
  returning id
),

-- Garage shops (6) — batch insert; not name-resolved in this file ----
shops as (
  insert into public.garage_shops (
    company_id, name, tier, specialties, address, phone, contact, rating, discount_pct, notes, created_by
  )
  select co.id, v.name, v.tier, v.specialties, v.address, v.phone, v.contact, v.rating, v.discount_pct, v.notes, null
  from co, (values
    ('Diesel Dynamics',        'Partner',   'Heavy diesel, transmission, DPF', '2840 Lockbourne Rd, Columbus OH', '(614) 555-0301', 'Frank Russo',    4.8::numeric, 12::numeric, 'Currently servicing T-107.'),
    ('Columbus Truck Service', 'Partner',   'General repair, AC, brakes',      '901 Harmon Ave, Columbus OH',     '(614) 555-0322', 'Lisa Park',      4.6::numeric, 10::numeric, '24-hr towing partner.'),
    ('Smith Auto Body',        'Preferred', 'Body work, paint, glass',         '4112 Cleveland Ave, Columbus OH', '(614) 555-0345', 'Doug Smith',     4.5::numeric,  8::numeric, ''),
    ('Midwest Hydraulics',     'Preferred', 'Hydraulic systems, boom service', '15 Williams Rd, Groveport OH',    '(614) 555-0367', 'Renee Cole',     4.7::numeric, 10::numeric, 'Tow boom specialists.'),
    ('Buckeye Tire Center',    'Standard',  'Tires, alignment',                '2299 Morse Rd, Columbus OH',      '(614) 555-0389', 'Mike T.',        4.2::numeric,  5::numeric, ''),
    ('Express Lube Plus',      'Standard',  'Quick PM, oil, filters',          '720 Hamilton Rd, Gahanna OH',     '(614) 555-0404', 'Front Counter',  4.0::numeric,  5::numeric, '')
  ) as v(name, tier, specialties, address, phone, contact, rating, discount_pct, notes)
  returning id
)

-- Trucks (7) — assigned_driver_id resolved from driver CTEs ----
insert into public.trucks (
  company_id, unit_number, year, make, model, vin, plate, type, status,
  mileage, next_pm_miles, next_pm_date, safety_score, gvwr, color,
  assigned_driver_id, notes, created_by
)
select
  (select id from co),
  v.unit_number, v.year, v.make, v.model, v.vin, v.plate, v.type, v.status,
  v.mileage, v.next_pm_miles, v.next_pm_date, v.safety_score, v.gvwr, v.color,
  v.driver_id, v.notes, null
from (values
  ('T-101', 2019, 'Kenworth',     'T270',      '1NKBLP0X8KR123456', 'OH-TRK1019', 'Tow Truck', 'PM Overdue', 187420, 188000, current_date -  4, 88, 26000, 'White',  (select id from d_marcus),  'Oil change overdue. Recovery boom unit.'),
  ('T-102', 2021, 'Ford',         'F-450',     '1FDUF4HT6MED12345', 'OH-TRK1024', 'Tow Truck', 'Active',      92110,  95000, current_date + 18, 95, 14000, 'Black',  (select id from d_tasha),   'Light-duty wrecker.'),
  ('T-103', 2020, 'International','MV607',     '1HTKHPVK7LH567890', 'OH-TRK1031', 'Tow Truck', 'Flagged',    134890, 137500, current_date +  4, 71, 33000, 'Orange', (select id from d_devon),   '2 speeding events flagged this week.'),
  ('T-104', 2022, 'Freightliner', 'M2 106',    '1FVACWDT4NHAA1234', 'OH-TRK1042', 'Box Truck', 'Active',      56230,  60000, current_date + 33, 92, 26000, 'White',  (select id from d_alicia),  '24ft box with liftgate.'),
  ('T-105', 2018, 'Ford',         'F-550',     '1FDUF5HT8JEA98765', 'OH-TRK1053', 'Tow Truck', 'Active',     211480, 215000, current_date +  9, 89, 19500, 'Red',    (select id from d_brandon), 'Annual inspection cert uploaded.'),
  ('T-106', 2023, 'RAM',          '3500',      '3C7WRTCJ4PG123987', 'OH-TRK1067', 'Box Truck', 'Active',      28900,  35000, current_date + 71, 97, 12000, 'White',  null::uuid,                 'Newest unit. 14ft cargo.'),
  ('T-107', 2021, 'Mack',         'LR Series', '1M2GR4GC4MM123456', 'OH-TRK1071', 'Box Truck', 'In Shop',    119840, 125000, current_date + 22, 84, 33000, 'Yellow', null::uuid,                 'Currently at Diesel Dynamics — transmission service.')
) as v(unit_number, year, make, model, vin, plate, type, status, mileage, next_pm_miles, next_pm_date, safety_score, gvwr, color, driver_id, notes);

commit;
