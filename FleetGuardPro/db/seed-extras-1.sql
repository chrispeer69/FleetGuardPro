-- ============================================================
-- FleetGuardPro — Phase 2A seed extras (part 1)
-- maintenance, repairs, parts, dot_files, safety_incidents
-- Depends on seed.sql (companies, drivers, trucks, garage_shops)
-- ============================================================

BEGIN;

WITH
co AS (
  SELECT id FROM companies WHERE name = 'ABC Towing LLC'
),
truck_101 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-101'),
truck_102 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-102'),
truck_103 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-103'),
truck_104 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-104'),
truck_105 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-105'),
truck_107 AS (SELECT id FROM trucks WHERE company_id = (SELECT id FROM co) AND unit_number = 'T-107'),
driver_marcus  AS (SELECT id FROM drivers WHERE company_id = (SELECT id FROM co) AND name = 'Marcus Johnson'),
driver_tasha   AS (SELECT id FROM drivers WHERE company_id = (SELECT id FROM co) AND name = 'Tasha Williams'),
driver_devon   AS (SELECT id FROM drivers WHERE company_id = (SELECT id FROM co) AND name = 'Devon Carter'),
driver_alicia  AS (SELECT id FROM drivers WHERE company_id = (SELECT id FROM co) AND name = 'Alicia Romero'),
driver_brandon AS (SELECT id FROM drivers WHERE company_id = (SELECT id FROM co) AND name = 'Brandon Kim'),
shop_diesel   AS (SELECT id FROM garage_shops WHERE company_id = (SELECT id FROM co) AND name = 'Diesel Dynamics'),
shop_smith    AS (SELECT id FROM garage_shops WHERE company_id = (SELECT id FROM co) AND name = 'Smith Auto Body'),
shop_columbus AS (SELECT id FROM garage_shops WHERE company_id = (SELECT id FROM co) AND name = 'Columbus Truck Service'),

ins_maintenance AS (
  INSERT INTO maintenance (
    company_id, truck_id, type, due_date, due_miles, status, notes, completed_date, cost, created_by
  )
  VALUES
    ((SELECT id FROM co), (SELECT id FROM truck_101), 'Oil & Filter Change',   (CURRENT_DATE + (-4   || ' days')::interval)::date, 188000, 'Overdue',     'Use 15W-40 synthetic blend.', NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_102), 'Brake Inspection',      (CURRENT_DATE + (18   || ' days')::interval)::date,  95000, 'Scheduled',   'Front pads measured at 4mm.', NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_103), 'DOT Annual Inspection', (CURRENT_DATE + (4    || ' days')::interval)::date, 137500, 'Scheduled',   'Required by April 30.',       NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_104), 'Tire Rotation',         (CURRENT_DATE + (33   || ' days')::interval)::date,  60000, 'Scheduled',   '',                            NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_105), 'Annual Inspection',     (CURRENT_DATE + (9    || ' days')::interval)::date, 215000, 'Scheduled',   'Cert uploaded yesterday.',    NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_107), 'Transmission Service',  (CURRENT_DATE + (-2   || ' days')::interval)::date, 120000, 'In Progress', 'At Diesel Dynamics.',         NULL,                                                  NULL,   NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_102), 'Oil & Filter Change',   (CURRENT_DATE + (-45  || ' days')::interval)::date,  90000, 'Completed',   '',                            (CURRENT_DATE + (-45  || ' days')::interval)::date, 184.50, NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_104), 'Annual Inspection',     (CURRENT_DATE + (-120 || ' days')::interval)::date,  50000, 'Completed',   'Passed.',                     (CURRENT_DATE + (-120 || ' days')::interval)::date, 240.00, NULL)
  RETURNING 1
),

ins_repairs AS (
  INSERT INTO repairs (
    company_id, truck_id, issue, priority, status, shop_id, est_cost, opened_date, closed_date, notes, created_by
  )
  VALUES
    ((SELECT id FROM co), (SELECT id FROM truck_107), 'Transmission slipping in 3rd gear', 'High',   'In Progress', (SELECT id FROM shop_diesel),   4200, (CURRENT_DATE + (-3  || ' days')::interval)::date, NULL,                                              'Customer authorized rebuild.',     NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_103), 'Check engine light — DPF code',     'Medium', 'Open',        NULL,                            850, (CURRENT_DATE + (-1  || ' days')::interval)::date, NULL,                                              'Awaiting shop assignment.',        NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_101), 'Boom hydraulic leak',               'High',   'Open',        NULL,                           1500, (CURRENT_DATE + (0   || ' days')::interval)::date, NULL,                                              'Reported by driver this morning.', NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_105), 'Replace driver seat cushion',       'Low',    'Closed',      (SELECT id FROM shop_smith),     320, (CURRENT_DATE + (-25 || ' days')::interval)::date, (CURRENT_DATE + (-18 || ' days')::interval)::date, 'Completed under budget.',          NULL),
    ((SELECT id FROM co), (SELECT id FROM truck_104), 'AC not cooling properly',           'Medium', 'Closed',      (SELECT id FROM shop_columbus),  680, (CURRENT_DATE + (-60 || ' days')::interval)::date, (CURRENT_DATE + (-54 || ' days')::interval)::date, 'Recharged + leak repair.',         NULL)
  RETURNING 1
),

ins_parts AS (
  INSERT INTO parts (
    company_id, name, sku, category, vendor, qty_on_hand, reorder_point, unit_cost, location, created_by
  )
  VALUES
    ((SELECT id FROM co), 'Oil Filter — Detroit DD13',   'A4721800009', 'Filters',       'FleetPride',   8,  4,  24.50, 'Bin A-12',   NULL),
    ((SELECT id FROM co), 'Air Filter — International',  'AF26431',     'Filters',       'NAPA',         3,  4,  38.75, 'Bin A-14',   NULL),
    ((SELECT id FROM co), 'Brake Pads — Front (F-450)',  'BR-F450-FP',  'Brakes',        'AutoZone Pro', 6,  2,  89.99, 'Bin C-03',   NULL),
    ((SELECT id FROM co), 'Hydraulic Hose — 1/2" x 36"', 'HH-50-36',    'Hydraulics',    'Parker Store', 2,  3,  64.00, 'Bin D-08',   NULL),
    ((SELECT id FROM co), 'DEF Fluid — 2.5 gal',         'DEF-25',      'Fluids',        'FleetPride',  14,  6,  18.99, 'Shelf B-01', NULL),
    ((SELECT id FROM co), 'Wiper Blade — 22"',           'WB-22',       'Accessories',   'NAPA',         0,  4,  14.50, 'Bin E-02',   NULL),
    ((SELECT id FROM co), 'Tow Strap — 4" x 30ft',       'TS-4-30',     'Recovery Gear', 'Mile Marker',  5,  2, 142.00, 'Cabinet F',  NULL),
    ((SELECT id FROM co), 'LED Light Bar — 50W',         'LED-50-AMB',  'Electrical',    'Whelen',       3,  2, 218.00, 'Bin G-04',   NULL),
    ((SELECT id FROM co), 'Coolant — Heavy Duty 1 gal',  'CL-HD-1',     'Fluids',        'NAPA',        12,  6,  22.00, 'Shelf B-02', NULL)
  RETURNING 1
),

ins_dot_files AS (
  INSERT INTO dot_files (
    company_id, type, driver_id, truck_id, name, file_size, uploaded_date, expires_date, status, created_by
  )
  VALUES
    ((SELECT id FROM co), 'Driver Qualification File', (SELECT id FROM driver_marcus),  NULL,                           'Marcus Johnson — DQ File 2024',  2400000, DATE '2024-03-15',                                  DATE '2026-09-12',                                   'Active',   NULL),
    ((SELECT id FROM co), 'Driver Qualification File', (SELECT id FROM driver_tasha),   NULL,                           'Tasha Williams — DQ File 2024',  2200000, DATE '2024-04-02',                                  DATE '2027-04-05',                                   'Active',   NULL),
    ((SELECT id FROM co), 'Driver Qualification File', (SELECT id FROM driver_devon),   NULL,                           'Devon Carter — DQ File 2024',    2100000, DATE '2024-02-20',                                  DATE '2025-12-01',                                   'Expiring', NULL),
    ((SELECT id FROM co), 'Annual Vehicle Inspection', NULL,                            (SELECT id FROM truck_105),     'T-105 — Annual Inspection Cert',  980000, (CURRENT_DATE + (-1  || ' days')::interval)::date,  (CURRENT_DATE + (364 || ' days')::interval)::date,   'Active',   NULL),
    ((SELECT id FROM co), 'Annual Vehicle Inspection', NULL,                            (SELECT id FROM truck_102),     'T-102 — Annual Inspection Cert', 1020000, DATE '2024-08-10',                                  DATE '2025-08-10',                                   'Active',   NULL),
    ((SELECT id FROM co), 'Medical Certificate',       (SELECT id FROM driver_brandon), NULL,                           'Brandon Kim — Med Card',          410000, DATE '2024-08-01',                                  DATE '2025-08-05',                                   'Expiring', NULL),
    ((SELECT id FROM co), 'IFTA Registration',         NULL,                            NULL,                           'Ohio IFTA Registration 2025',     320000, DATE '2025-01-04',                                  DATE '2025-12-31',                                   'Active',   NULL),
    ((SELECT id FROM co), 'PUCO Authority',            NULL,                            NULL,                           'PUCO Operating Authority',        540000, DATE '2024-11-20',                                  DATE '2026-11-20',                                   'Active',   NULL)
  RETURNING 1
),

ins_safety AS (
  INSERT INTO safety_incidents (
    company_id, driver_id, truck_id, type, severity, date, description, status, created_by
  )
  VALUES
    ((SELECT id FROM co), (SELECT id FROM driver_devon),  (SELECT id FROM truck_103), 'Speeding',           'High',   (CURRENT_DATE + (-1  || ' days')::interval)::date, '14 mph over posted limit on I-270.',  'Open',     NULL),
    ((SELECT id FROM co), (SELECT id FROM driver_devon),  (SELECT id FROM truck_103), 'Hard Braking',       'Medium', (CURRENT_DATE + (-2  || ' days')::interval)::date, 'Sudden deceleration event.',          'Open',     NULL),
    ((SELECT id FROM co), (SELECT id FROM driver_marcus), (SELECT id FROM truck_101), 'Distracted Driving', 'Low',    (CURRENT_DATE + (-7  || ' days')::interval)::date, 'Phone usage detected — 8 seconds.',   'Reviewed', NULL),
    ((SELECT id FROM co), (SELECT id FROM driver_alicia), (SELECT id FROM truck_104), 'Hard Cornering',     'Low',    (CURRENT_DATE + (-14 || ' days')::interval)::date, 'Aggressive cornering on city street.', 'Reviewed', NULL),
    ((SELECT id FROM co), (SELECT id FROM driver_tasha),  (SELECT id FROM truck_102), 'Speeding',           'Low',    (CURRENT_DATE + (-22 || ' days')::interval)::date, '6 mph over posted limit.',            'Closed',   NULL)
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM ins_maintenance) AS maintenance_inserted,
  (SELECT COUNT(*) FROM ins_repairs)     AS repairs_inserted,
  (SELECT COUNT(*) FROM ins_parts)       AS parts_inserted,
  (SELECT COUNT(*) FROM ins_dot_files)   AS dot_files_inserted,
  (SELECT COUNT(*) FROM ins_safety)      AS safety_inserted;

COMMIT;
