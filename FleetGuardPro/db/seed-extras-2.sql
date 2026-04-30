-- ============================================================
-- FleetGuardPro — Phase 2A seed extras (part 2)
-- insurance_policies, documents, alerts, billing, reports
-- All company-scoped. Depends on seed.sql (companies).
-- ============================================================

BEGIN;

WITH
co AS (
  SELECT id FROM companies WHERE name = 'ABC Towing LLC'
),

ins_insurance AS (
  INSERT INTO insurance_policies (
    company_id, carrier, policy_number, type, premium, deductible,
    effective_date, expiry_date, coverage_limit, status, notes, created_by
  )
  VALUES
    ((SELECT id FROM co), 'Progressive Commercial', 'PC-44218903', 'Commercial Auto Liability', 28400, 2500, DATE '2024-05-11', DATE '2025-05-11', 1000000, 'Active', 'Renewal in progress — multi-broker quote.', NULL),
    ((SELECT id FROM co), 'Progressive Commercial', 'PC-44218904', 'Physical Damage',           18200, 1000, DATE '2024-05-11', DATE '2025-05-11',  750000, 'Active', '',                                          NULL),
    ((SELECT id FROM co), 'Travelers',              'TR-89302145', 'General Liability',          4800,  500, DATE '2024-08-01', DATE '2025-08-01', 1000000, 'Active', '',                                          NULL),
    ((SELECT id FROM co), 'The Hartford',           'HF-7732891',  'Workers Compensation',      12300,    0, DATE '2024-07-15', DATE '2025-07-15',  500000, 'Active', '',                                          NULL)
  RETURNING 1
),

ins_documents AS (
  INSERT INTO documents (
    company_id, name, category, file_size, uploaded_date, uploaded_by, created_by
  )
  VALUES
    ((SELECT id FROM co), 'Operating Authority — Federal.pdf', 'Compliance', 540000, DATE '2024-11-20', 'John Smith',      NULL),
    ((SELECT id FROM co), 'Insurance Certificate 2024.pdf',    'Insurance',  220000, DATE '2024-05-15', 'John Smith',      NULL),
    ((SELECT id FROM co), 'Driver Handbook v3.docx',           'HR',         480000, DATE '2024-01-08', 'John Smith',      NULL),
    ((SELECT id FROM co), 'IFTA Q1 2025.pdf',                  'Compliance', 180000, DATE '2025-04-15', 'FleetGuard Team', NULL),
    ((SELECT id FROM co), 'Vehicle Lease — T-106.pdf',         'Fleet',      920000, DATE '2023-04-22', 'John Smith',      NULL),
    ((SELECT id FROM co), 'Tow Hook Rigging Procedures.pdf',   'Safety',     310000, DATE '2024-06-04', 'FleetGuard Team', NULL)
  RETURNING 1
),

ins_alerts AS (
  INSERT INTO alerts (
    company_id, type, severity, title, message, date, "read",
    related_type, related_id, auto, auto_key, created_by
  )
  VALUES
    ((SELECT id FROM co), 'maintenance', 'high',   'PM Overdue: T-101',                                          'Oil change is overdue by 340 miles. Schedule service immediately.', (CURRENT_DATE + (0  || ' days')::interval)::date, FALSE, 'truck',     NULL, TRUE,  'maintenance:pm_overdue:T-101',                NULL),
    ((SELECT id FROM co), 'safety',      'medium', 'Driver Safety Flag: Devon Carter',                           '2 speeding events in the last 7 days. Coaching session recommended.', (CURRENT_DATE + (-1 || ' days')::interval)::date, FALSE, 'driver',    NULL, TRUE,  'safety:driver_flag:Devon Carter',             NULL),
    ((SELECT id FROM co), 'compliance',  'medium', 'CDL Renewal Approaching: Devon Carter',                      'CDL expires Dec 1, 2025 (216 days). Begin renewal process.',          (CURRENT_DATE + (-2 || ' days')::interval)::date, FALSE, 'driver',    NULL, TRUE,  'compliance:cdl_expiring:Devon Carter',        NULL),
    ((SELECT id FROM co), 'insurance',   'low',    'Insurance Renewal Process Started',                          'Progressive renewal due May 11. Multi-broker quote initiated.',       (CURRENT_DATE + (-3 || ' days')::interval)::date, TRUE,  'insurance', NULL, FALSE, NULL,                                          NULL),
    ((SELECT id FROM co), 'compliance',  'medium', 'Med Card Expiring: Brandon Kim',                             'Medical card expires Aug 5, 2025. Schedule DOT physical.',            (CURRENT_DATE + (-5 || ' days')::interval)::date, TRUE,  'driver',    NULL, TRUE,  'compliance:med_card_expiring:Brandon Kim',    NULL),
    ((SELECT id FROM co), 'parts',       'low',    'Parts Reorder: Air Filter / Hydraulic Hose / Wiper Blade',  '3 SKUs at or below reorder point.',                                   (CURRENT_DATE + (-1 || ' days')::interval)::date, FALSE, NULL,        NULL, TRUE,  'parts:reorder_threshold',                     NULL)
  RETURNING 1
),

ins_billing AS (
  INSERT INTO billing (
    company_id, invoice_number, plan, amount, period_start, period_end,
    status, issued_date, paid_date, created_by
  )
  VALUES
    ((SELECT id FROM co), 'FG-2025-04', 'All-Access', 399.00, DATE '2025-04-01', DATE '2025-04-30', 'Paid',    DATE '2025-04-01', DATE '2025-04-02', NULL),
    ((SELECT id FROM co), 'FG-2025-03', 'All-Access', 399.00, DATE '2025-03-01', DATE '2025-03-31', 'Paid',    DATE '2025-03-01', DATE '2025-03-03', NULL),
    ((SELECT id FROM co), 'FG-2025-02', 'All-Access', 399.00, DATE '2025-02-01', DATE '2025-02-28', 'Paid',    DATE '2025-02-01', DATE '2025-02-02', NULL),
    ((SELECT id FROM co), 'FG-2025-01', 'All-Access', 399.00, DATE '2025-01-01', DATE '2025-01-31', 'Paid',    DATE '2025-01-01', DATE '2025-01-04', NULL),
    ((SELECT id FROM co), 'FG-2024-12', 'All-Access', 399.00, DATE '2024-12-01', DATE '2024-12-31', 'Paid',    DATE '2024-12-01', DATE '2024-12-02', NULL),
    ((SELECT id FROM co), 'FG-2025-05', 'All-Access', 399.00, DATE '2025-05-01', DATE '2025-05-31', 'Pending', DATE '2025-05-01', NULL,              NULL)
  RETURNING 1
),

ins_reports AS (
  INSERT INTO reports (
    company_id, type, name, period, generated_date, summary, created_by
  )
  VALUES
    ((SELECT id FROM co), 'safety',      'April 2025 Driver Safety Summary',    'April 2025', (CURRENT_DATE + (-2  || ' days')::interval)::date, '5 incidents, 2 high-severity. Devon Carter flagged.',      NULL),
    ((SELECT id FROM co), 'maintenance', 'Q1 2025 Maintenance Cost Report',     'Q1 2025',    (CURRENT_DATE + (-28 || ' days')::interval)::date, 'Total spend $14,820. Down 8% YoY.',                        NULL),
    ((SELECT id FROM co), 'compliance',  'DOT Audit Readiness — March 2025',    'March 2025', (CURRENT_DATE + (-55 || ' days')::interval)::date, '94% compliance score. 2 expiring docs flagged.',           NULL),
    ((SELECT id FROM co), 'insurance',   '2024 Loss Run Compilation',           'FY 2024',    (CURRENT_DATE + (-90 || ' days')::interval)::date, '1 minor incident, $2,300 paid out. Used for renewal quotes.', NULL)
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM ins_insurance)  AS insurance_inserted,
  (SELECT COUNT(*) FROM ins_documents)  AS documents_inserted,
  (SELECT COUNT(*) FROM ins_alerts)     AS alerts_inserted,
  (SELECT COUNT(*) FROM ins_billing)    AS billing_inserted,
  (SELECT COUNT(*) FROM ins_reports)    AS reports_inserted;

COMMIT;
