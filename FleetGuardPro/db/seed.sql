-- ============================================================
-- FleetGuardPro — Phase 2A seed: core entities
-- Companies, drivers, trucks, garage shops
-- ============================================================

BEGIN;

WITH
inserted_company AS (
  INSERT INTO companies (
    name, dot_number, mc_number, puco_number, fleet_type,
    address, phone, email, website,
    contact_name, contact_title, contact_email, contact_phone,
    plan, services, member_since, created_by
  )
  VALUES (
    'ABC Towing LLC', 'US-3284917', 'MC-892431', 'PUCO-441293', 'Mixed (Tow + Box)',
    '4521 Industrial Pkwy, Columbus, OH 43215', '(614) 555-0190', 'ops@abctowing.com', 'www.abctowing.com',
    'John Smith', 'Owner / Operator', 'john@abctowing.com', '(614) 555-0100',
    'all-access', ARRAY['safety','compliance','maintenance','insurance'], DATE '2023-08-14', NULL
  )
  RETURNING id
),
inserted_drivers AS (
  INSERT INTO drivers (
    name, cdl_number, cdl_class, cdl_expiry, medical_card_expiry,
    hire_date, status, safety_score, phone, email, address, dob, notes, created_by
  )
  VALUES
    ('Marcus Johnson',  'OH-CD893421', 'Class B', DATE '2026-09-12', DATE '2025-11-30', DATE '2020-03-15', 'Active',   91, '(614) 555-0211', 'marcus@abctowing.com',  '1820 Oakridge Dr, Columbus OH',  DATE '1985-06-22', 'Senior driver. Trains new hires.',          NULL),
    ('Tasha Williams',  'OH-CD712890', 'Class B', DATE '2027-04-05', DATE '2026-02-15', DATE '2021-07-08', 'Active',   96, '(614) 555-0223', 'tasha@abctowing.com',   '733 Maple St, Reynoldsburg OH',  DATE '1990-11-04', 'Top safety score in fleet.',                NULL),
    ('Devon Carter',    'OH-CD445112', 'Class A', DATE '2025-12-01', DATE '2025-06-15', DATE '2019-11-22', 'Flagged',  68, '(614) 555-0244', 'devon@abctowing.com',   '92 Lincoln Ave, Whitehall OH',   DATE '1988-02-14', 'Coaching session scheduled — speeding flags.', NULL),
    ('Alicia Romero',   'OH-CD998023', 'Class B', DATE '2026-06-30', DATE '2025-12-20', DATE '2022-01-10', 'Active',   89, '(614) 555-0258', 'alicia@abctowing.com',  '1455 Cedar Lane, Dublin OH',     DATE '1992-09-17', 'Box truck specialist.',                     NULL),
    ('Brandon Kim',     'OH-CD220391', 'Class B', DATE '2026-01-18', DATE '2025-08-05', DATE '2023-05-19', 'On Leave', 87, '(614) 555-0271', 'brandon@abctowing.com', '4 Pinecrest Rd, Westerville OH', DATE '1995-03-28', 'Returning from medical leave June 1.',      NULL)
  RETURNING id, name
),
truck_data (unit_number, year, make, model, vin, plate, type, status, mileage, next_pm_miles, next_pm_offset_days, safety_score, gvwr, color, driver_name, notes) AS (
  VALUES
    ('T-101', 2019, 'Kenworth',     'T270',      '1NKBLP0X8KR123456', 'OH-TRK1019', 'Tow Truck', 'PM Overdue', 187420, 188000,  -4, 88, 26000, 'White',  'Marcus Johnson'::text, 'Oil change overdue. Recovery boom unit.'),
    ('T-102', 2021, 'Ford',         'F-450',     '1FDUF4HT6MED12345', 'OH-TRK1024', 'Tow Truck', 'Active',      92110,  95000,  18, 95, 14000, 'Black',  'Tasha Williams'::text, 'Light-duty wrecker.'),
    ('T-103', 2020, 'International','MV607',     '1HTKHPVK7LH567890', 'OH-TRK1031', 'Tow Truck', 'Flagged',    134890, 137500,   4, 71, 33000, 'Orange', 'Devon Carter'::text,   '2 speeding events flagged this week.'),
    ('T-104', 2022, 'Freightliner', 'M2 106',    '1FVACWDT4NHAA1234', 'OH-TRK1042', 'Box Truck', 'Active',      56230,  60000,  33, 92, 26000, 'White',  'Alicia Romero'::text,  '24ft box with liftgate.'),
    ('T-105', 2018, 'Ford',         'F-550',     '1FDUF5HT8JEA98765', 'OH-TRK1053', 'Tow Truck', 'Active',     211480, 215000,   9, 89, 19500, 'Red',    'Brandon Kim'::text,    'Annual inspection cert uploaded.'),
    ('T-106', 2023, 'RAM',          '3500',      '3C7WRTCJ4PG123987', 'OH-TRK1067', 'Box Truck', 'Active',      28900,  35000,  71, 97, 12000, 'White',  NULL::text,             'Newest unit. 14ft cargo.'),
    ('T-107', 2021, 'Mack',         'LR Series', '1M2GR4GC4MM123456', 'OH-TRK1071', 'Box Truck', 'In Shop',    119840, 125000,  22, 84, 33000, 'Yellow', NULL::text,             'Currently at Diesel Dynamics — transmission service.')
),
inserted_trucks AS (
  INSERT INTO trucks (
    unit_number, year, make, model, vin, plate, type, status,
    mileage, next_pm_miles, next_pm_date, safety_score, gvwr, color,
    assigned_driver_id, notes, created_by
  )
  SELECT
    t.unit_number, t.year, t.make, t.model, t.vin, t.plate, t.type, t.status,
    t.mileage, t.next_pm_miles, (CURRENT_DATE + (t.next_pm_offset_days || ' days')::interval)::date,
    t.safety_score, t.gvwr, t.color,
    d.id, t.notes, NULL
  FROM truck_data t
  LEFT JOIN inserted_drivers d ON d.name = t.driver_name
  RETURNING id
),
inserted_shops AS (
  INSERT INTO garage_shops (
    name, tier, specialties, address, phone, contact, rating, discount_pct, notes, created_by
  )
  VALUES
    ('Diesel Dynamics',         'Partner',   'Heavy diesel, transmission, DPF', '2840 Lockbourne Rd, Columbus OH', '(614) 555-0301', 'Frank Russo',   4.8, 12, 'Currently servicing T-107.', NULL),
    ('Columbus Truck Service',  'Partner',   'General repair, AC, brakes',      '901 Harmon Ave, Columbus OH',     '(614) 555-0322', 'Lisa Park',     4.6, 10, '24-hr towing partner.',      NULL),
    ('Smith Auto Body',         'Preferred', 'Body work, paint, glass',         '4112 Cleveland Ave, Columbus OH', '(614) 555-0345', 'Doug Smith',    4.5,  8, '',                           NULL),
    ('Midwest Hydraulics',      'Preferred', 'Hydraulic systems, boom service', '15 Williams Rd, Groveport OH',    '(614) 555-0367', 'Renee Cole',    4.7, 10, 'Tow boom specialists.',      NULL),
    ('Buckeye Tire Center',     'Standard',  'Tires, alignment',                '2299 Morse Rd, Columbus OH',      '(614) 555-0389', 'Mike T.',       4.2,  5, '',                           NULL),
    ('Express Lube Plus',       'Standard',  'Quick PM, oil, filters',          '720 Hamilton Rd, Gahanna OH',     '(614) 555-0404', 'Front Counter', 4.0,  5, '',                           NULL)
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM inserted_company) AS companies_inserted,
  (SELECT COUNT(*) FROM inserted_drivers) AS drivers_inserted,
  (SELECT COUNT(*) FROM inserted_trucks)  AS trucks_inserted,
  (SELECT COUNT(*) FROM inserted_shops)   AS shops_inserted;

COMMIT;
