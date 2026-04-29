// ============================================================
// SEED — initial demo data for ABC Towing LLC
// ============================================================
window.FG = window.FG || {};

FG.seed = (function () {

  const company = {
    name: 'ABC Towing LLC',
    dot_number: 'US-3284917',
    mc_number: 'MC-892431',
    puco_number: 'PUCO-441293',
    fleet_type: 'Mixed (Tow + Box)',
    address: '4521 Industrial Pkwy, Columbus, OH 43215',
    phone: '(614) 555-0190',
    email: 'ops@abctowing.com',
    website: 'www.abctowing.com',
    contact_name: 'John Smith',
    contact_title: 'Owner / Operator',
    contact_email: 'john@abctowing.com',
    contact_phone: '(614) 555-0100',
    plan: 'all-access',
    services: ['safety', 'compliance', 'maintenance', 'insurance'],
    member_since: '2023-08-14',
  };

  const trucks = [
    { id: 't_101', unit_number: 'T-101', year: 2019, make: 'Kenworth', model: 'T270', vin: '1NKBLP0X8KR123456', plate: 'OH-TRK1019', type: 'Tow Truck', status: 'PM Overdue', mileage: 187420, next_pm_miles: 188000, next_pm_date: FG.utils.addDays(new Date(), -4), safety_score: 88, gvwr: 26000, color: 'White', assigned_driver: 'd_001', notes: 'Oil change overdue. Recovery boom unit.' },
    { id: 't_102', unit_number: 'T-102', year: 2021, make: 'Ford', model: 'F-450', vin: '1FDUF4HT6MED12345', plate: 'OH-TRK1024', type: 'Tow Truck', status: 'Active', mileage: 92110, next_pm_miles: 95000, next_pm_date: FG.utils.addDays(new Date(), 18), safety_score: 95, gvwr: 14000, color: 'Black', assigned_driver: 'd_002', notes: 'Light-duty wrecker.' },
    { id: 't_103', unit_number: 'T-103', year: 2020, make: 'International', model: 'MV607', vin: '1HTKHPVK7LH567890', plate: 'OH-TRK1031', type: 'Tow Truck', status: 'Flagged', mileage: 134890, next_pm_miles: 137500, next_pm_date: FG.utils.addDays(new Date(), 4), safety_score: 71, gvwr: 33000, color: 'Orange', assigned_driver: 'd_003', notes: '2 speeding events flagged this week.' },
    { id: 't_104', unit_number: 'T-104', year: 2022, make: 'Freightliner', model: 'M2 106', vin: '1FVACWDT4NHAA1234', plate: 'OH-TRK1042', type: 'Box Truck', status: 'Active', mileage: 56230, next_pm_miles: 60000, next_pm_date: FG.utils.addDays(new Date(), 33), safety_score: 92, gvwr: 26000, color: 'White', assigned_driver: 'd_004', notes: '24ft box with liftgate.' },
    { id: 't_105', unit_number: 'T-105', year: 2018, make: 'Ford', model: 'F-550', vin: '1FDUF5HT8JEA98765', plate: 'OH-TRK1053', type: 'Tow Truck', status: 'Active', mileage: 211480, next_pm_miles: 215000, next_pm_date: FG.utils.addDays(new Date(), 9), safety_score: 89, gvwr: 19500, color: 'Red', assigned_driver: 'd_005', notes: 'Annual inspection cert uploaded.' },
    { id: 't_106', unit_number: 'T-106', year: 2023, make: 'RAM', model: '3500', vin: '3C7WRTCJ4PG123987', plate: 'OH-TRK1067', type: 'Box Truck', status: 'Active', mileage: 28900, next_pm_miles: 35000, next_pm_date: FG.utils.addDays(new Date(), 71), safety_score: 97, gvwr: 12000, color: 'White', assigned_driver: null, notes: 'Newest unit. 14ft cargo.' },
    { id: 't_107', unit_number: 'T-107', year: 2021, make: 'Mack', model: 'LR Series', vin: '1M2GR4GC4MM123456', plate: 'OH-TRK1071', type: 'Box Truck', status: 'In Shop', mileage: 119840, next_pm_miles: 125000, next_pm_date: FG.utils.addDays(new Date(), 22), safety_score: 84, gvwr: 33000, color: 'Yellow', assigned_driver: null, notes: 'Currently at Diesel Dynamics — transmission service.' },
  ];

  const drivers = [
    { id: 'd_001', name: 'Marcus Johnson', cdl_number: 'OH-CD893421', cdl_class: 'Class B', cdl_expiry: '2026-09-12', medical_card_expiry: '2025-11-30', hire_date: '2020-03-15', status: 'Active', safety_score: 91, phone: '(614) 555-0211', email: 'marcus@abctowing.com', address: '1820 Oakridge Dr, Columbus OH', dob: '1985-06-22', notes: 'Senior driver. Trains new hires.' },
    { id: 'd_002', name: 'Tasha Williams', cdl_number: 'OH-CD712890', cdl_class: 'Class B', cdl_expiry: '2027-04-05', medical_card_expiry: '2026-02-15', hire_date: '2021-07-08', status: 'Active', safety_score: 96, phone: '(614) 555-0223', email: 'tasha@abctowing.com', address: '733 Maple St, Reynoldsburg OH', dob: '1990-11-04', notes: 'Top safety score in fleet.' },
    { id: 'd_003', name: 'Devon Carter', cdl_number: 'OH-CD445112', cdl_class: 'Class A', cdl_expiry: '2025-12-01', medical_card_expiry: '2025-06-15', hire_date: '2019-11-22', status: 'Flagged', safety_score: 68, phone: '(614) 555-0244', email: 'devon@abctowing.com', address: '92 Lincoln Ave, Whitehall OH', dob: '1988-02-14', notes: 'Coaching session scheduled — speeding flags.' },
    { id: 'd_004', name: 'Alicia Romero', cdl_number: 'OH-CD998023', cdl_class: 'Class B', cdl_expiry: '2026-06-30', medical_card_expiry: '2025-12-20', hire_date: '2022-01-10', status: 'Active', safety_score: 89, phone: '(614) 555-0258', email: 'alicia@abctowing.com', address: '1455 Cedar Lane, Dublin OH', dob: '1992-09-17', notes: 'Box truck specialist.' },
    { id: 'd_005', name: 'Brandon Kim', cdl_number: 'OH-CD220391', cdl_class: 'Class B', cdl_expiry: '2026-01-18', medical_card_expiry: '2025-08-05', hire_date: '2023-05-19', status: 'On Leave', safety_score: 87, phone: '(614) 555-0271', email: 'brandon@abctowing.com', address: '4 Pinecrest Rd, Westerville OH', dob: '1995-03-28', notes: 'Returning from medical leave June 1.' },
  ];

  const maintenance = [
    { id: 'm_01', truck_id: 't_101', type: 'Oil & Filter Change', due_date: FG.utils.addDays(new Date(), -4), due_miles: 188000, status: 'Overdue', notes: 'Use 15W-40 synthetic blend.', completed_date: null, cost: null },
    { id: 'm_02', truck_id: 't_102', type: 'Brake Inspection', due_date: FG.utils.addDays(new Date(), 18), due_miles: 95000, status: 'Scheduled', notes: 'Front pads measured at 4mm.', completed_date: null, cost: null },
    { id: 'm_03', truck_id: 't_103', type: 'DOT Annual Inspection', due_date: FG.utils.addDays(new Date(), 4), due_miles: 137500, status: 'Scheduled', notes: 'Required by April 30.', completed_date: null, cost: null },
    { id: 'm_04', truck_id: 't_104', type: 'Tire Rotation', due_date: FG.utils.addDays(new Date(), 33), due_miles: 60000, status: 'Scheduled', notes: '', completed_date: null, cost: null },
    { id: 'm_05', truck_id: 't_105', type: 'Annual Inspection', due_date: FG.utils.addDays(new Date(), 9), due_miles: 215000, status: 'Scheduled', notes: 'Cert uploaded yesterday.', completed_date: null, cost: null },
    { id: 'm_06', truck_id: 't_107', type: 'Transmission Service', due_date: FG.utils.addDays(new Date(), -2), due_miles: 120000, status: 'In Progress', notes: 'At Diesel Dynamics.', completed_date: null, cost: null },
    { id: 'm_07', truck_id: 't_102', type: 'Oil & Filter Change', due_date: FG.utils.addDays(new Date(), -45), due_miles: 90000, status: 'Completed', notes: '', completed_date: FG.utils.addDays(new Date(), -45), cost: 184.50 },
    { id: 'm_08', truck_id: 't_104', type: 'Annual Inspection', due_date: FG.utils.addDays(new Date(), -120), due_miles: 50000, status: 'Completed', notes: 'Passed.', completed_date: FG.utils.addDays(new Date(), -120), cost: 240.00 },
  ];

  const repairs = [
    { id: 'r_01', truck_id: 't_107', issue: 'Transmission slipping in 3rd gear', priority: 'High', status: 'In Progress', shop: 'Diesel Dynamics', est_cost: 4200, opened_date: FG.utils.addDays(new Date(), -3), closed_date: null, notes: 'Customer authorized rebuild.' },
    { id: 'r_02', truck_id: 't_103', issue: 'Check engine light — DPF code', priority: 'Medium', status: 'Open', shop: null, est_cost: 850, opened_date: FG.utils.addDays(new Date(), -1), closed_date: null, notes: 'Awaiting shop assignment.' },
    { id: 'r_03', truck_id: 't_101', issue: 'Boom hydraulic leak', priority: 'High', status: 'Open', shop: null, est_cost: 1500, opened_date: FG.utils.addDays(new Date(), 0), closed_date: null, notes: 'Reported by driver this morning.' },
    { id: 'r_04', truck_id: 't_105', issue: 'Replace driver seat cushion', priority: 'Low', status: 'Closed', shop: 'Smith Auto Body', est_cost: 320, opened_date: FG.utils.addDays(new Date(), -25), closed_date: FG.utils.addDays(new Date(), -18), notes: 'Completed under budget.' },
    { id: 'r_05', truck_id: 't_104', issue: 'AC not cooling properly', priority: 'Medium', status: 'Closed', shop: 'Columbus Truck Service', est_cost: 680, opened_date: FG.utils.addDays(new Date(), -60), closed_date: FG.utils.addDays(new Date(), -54), notes: 'Recharged + leak repair.' },
  ];

  const parts = [
    { id: 'p_01', name: 'Oil Filter — Detroit DD13', sku: 'A4721800009', category: 'Filters', vendor: 'FleetPride', qty_on_hand: 8, reorder_point: 4, unit_cost: 24.50, location: 'Bin A-12' },
    { id: 'p_02', name: 'Air Filter — International', sku: 'AF26431', category: 'Filters', vendor: 'NAPA', qty_on_hand: 3, reorder_point: 4, unit_cost: 38.75, location: 'Bin A-14' },
    { id: 'p_03', name: 'Brake Pads — Front (F-450)', sku: 'BR-F450-FP', category: 'Brakes', vendor: 'AutoZone Pro', qty_on_hand: 6, reorder_point: 2, unit_cost: 89.99, location: 'Bin C-03' },
    { id: 'p_04', name: 'Hydraulic Hose — 1/2" x 36"', sku: 'HH-50-36', category: 'Hydraulics', vendor: 'Parker Store', qty_on_hand: 2, reorder_point: 3, unit_cost: 64.00, location: 'Bin D-08' },
    { id: 'p_05', name: 'DEF Fluid — 2.5 gal', sku: 'DEF-25', category: 'Fluids', vendor: 'FleetPride', qty_on_hand: 14, reorder_point: 6, unit_cost: 18.99, location: 'Shelf B-01' },
    { id: 'p_06', name: 'Wiper Blade — 22"', sku: 'WB-22', category: 'Accessories', vendor: 'NAPA', qty_on_hand: 0, reorder_point: 4, unit_cost: 14.50, location: 'Bin E-02' },
    { id: 'p_07', name: 'Tow Strap — 4" x 30ft', sku: 'TS-4-30', category: 'Recovery Gear', vendor: 'Mile Marker', qty_on_hand: 5, reorder_point: 2, unit_cost: 142.00, location: 'Cabinet F' },
    { id: 'p_08', name: 'LED Light Bar — 50W', sku: 'LED-50-AMB', category: 'Electrical', vendor: 'Whelen', qty_on_hand: 3, reorder_point: 2, unit_cost: 218.00, location: 'Bin G-04' },
    { id: 'p_09', name: 'Coolant — Heavy Duty 1 gal', sku: 'CL-HD-1', category: 'Fluids', vendor: 'NAPA', qty_on_hand: 12, reorder_point: 6, unit_cost: 22.00, location: 'Shelf B-02' },
  ];

  const dot_files = [
    { id: 'dot_01', type: 'Driver Qualification File', driver_id: 'd_001', truck_id: null, name: 'Marcus Johnson — DQ File 2024', file_size: 2400000, uploaded_date: '2024-03-15', expires_date: '2026-09-12', status: 'Active' },
    { id: 'dot_02', type: 'Driver Qualification File', driver_id: 'd_002', truck_id: null, name: 'Tasha Williams — DQ File 2024', file_size: 2200000, uploaded_date: '2024-04-02', expires_date: '2027-04-05', status: 'Active' },
    { id: 'dot_03', type: 'Driver Qualification File', driver_id: 'd_003', truck_id: null, name: 'Devon Carter — DQ File 2024', file_size: 2100000, uploaded_date: '2024-02-20', expires_date: '2025-12-01', status: 'Expiring' },
    { id: 'dot_04', type: 'Annual Vehicle Inspection', driver_id: null, truck_id: 't_105', name: 'T-105 — Annual Inspection Cert', file_size: 980000, uploaded_date: FG.utils.addDays(new Date(), -1), expires_date: FG.utils.addDays(new Date(), 364), status: 'Active' },
    { id: 'dot_05', type: 'Annual Vehicle Inspection', driver_id: null, truck_id: 't_102', name: 'T-102 — Annual Inspection Cert', file_size: 1020000, uploaded_date: '2024-08-10', expires_date: '2025-08-10', status: 'Active' },
    { id: 'dot_06', type: 'Medical Certificate', driver_id: 'd_005', truck_id: null, name: 'Brandon Kim — Med Card', file_size: 410000, uploaded_date: '2024-08-01', expires_date: '2025-08-05', status: 'Expiring' },
    { id: 'dot_07', type: 'IFTA Registration', driver_id: null, truck_id: null, name: 'Ohio IFTA Registration 2025', file_size: 320000, uploaded_date: '2025-01-04', expires_date: '2025-12-31', status: 'Active' },
    { id: 'dot_08', type: 'PUCO Authority', driver_id: null, truck_id: null, name: 'PUCO Operating Authority', file_size: 540000, uploaded_date: '2024-11-20', expires_date: '2026-11-20', status: 'Active' },
  ];

  const safety_incidents = [
    { id: 's_01', driver_id: 'd_003', truck_id: 't_103', type: 'Speeding', severity: 'High', date: FG.utils.addDays(new Date(), -1), description: '14 mph over posted limit on I-270.', status: 'Open' },
    { id: 's_02', driver_id: 'd_003', truck_id: 't_103', type: 'Hard Braking', severity: 'Medium', date: FG.utils.addDays(new Date(), -2), description: 'Sudden deceleration event.', status: 'Open' },
    { id: 's_03', driver_id: 'd_001', truck_id: 't_101', type: 'Distracted Driving', severity: 'Low', date: FG.utils.addDays(new Date(), -7), description: 'Phone usage detected — 8 seconds.', status: 'Reviewed' },
    { id: 's_04', driver_id: 'd_004', truck_id: 't_104', type: 'Hard Cornering', severity: 'Low', date: FG.utils.addDays(new Date(), -14), description: 'Aggressive cornering on city street.', status: 'Reviewed' },
    { id: 's_05', driver_id: 'd_002', truck_id: 't_102', type: 'Speeding', severity: 'Low', date: FG.utils.addDays(new Date(), -22), description: '6 mph over posted limit.', status: 'Closed' },
  ];

  const insurance_policies = [
    { id: 'ins_01', carrier: 'Progressive Commercial', policy_number: 'PC-44218903', type: 'Commercial Auto Liability', premium: 28400, deductible: 2500, effective_date: '2024-05-11', expiry_date: '2025-05-11', coverage_limit: 1000000, status: 'Active', notes: 'Renewal in progress — multi-broker quote.' },
    { id: 'ins_02', carrier: 'Progressive Commercial', policy_number: 'PC-44218904', type: 'Physical Damage', premium: 18200, deductible: 1000, effective_date: '2024-05-11', expiry_date: '2025-05-11', coverage_limit: 750000, status: 'Active', notes: '' },
    { id: 'ins_03', carrier: 'Travelers', policy_number: 'TR-89302145', type: 'General Liability', premium: 4800, deductible: 500, effective_date: '2024-08-01', expiry_date: '2025-08-01', coverage_limit: 1000000, status: 'Active', notes: '' },
    { id: 'ins_04', carrier: 'The Hartford', policy_number: 'HF-7732891', type: 'Workers Compensation', premium: 12300, deductible: 0, effective_date: '2024-07-15', expiry_date: '2025-07-15', coverage_limit: 500000, status: 'Active', notes: '' },
  ];

  const documents = [
    { id: 'doc_01', name: 'Operating Authority — Federal.pdf', category: 'Compliance', file_size: 540000, uploaded_date: '2024-11-20', uploaded_by: 'John Smith' },
    { id: 'doc_02', name: 'Insurance Certificate 2024.pdf', category: 'Insurance', file_size: 220000, uploaded_date: '2024-05-15', uploaded_by: 'John Smith' },
    { id: 'doc_03', name: 'Driver Handbook v3.docx', category: 'HR', file_size: 480000, uploaded_date: '2024-01-08', uploaded_by: 'John Smith' },
    { id: 'doc_04', name: 'IFTA Q1 2025.pdf', category: 'Compliance', file_size: 180000, uploaded_date: '2025-04-15', uploaded_by: 'FleetGuard Team' },
    { id: 'doc_05', name: 'Vehicle Lease — T-106.pdf', category: 'Fleet', file_size: 920000, uploaded_date: '2023-04-22', uploaded_by: 'John Smith' },
    { id: 'doc_06', name: 'Tow Hook Rigging Procedures.pdf', category: 'Safety', file_size: 310000, uploaded_date: '2024-06-04', uploaded_by: 'FleetGuard Team' },
  ];

  const alerts = [
    { id: 'a_01', type: 'maintenance', severity: 'high', title: 'PM Overdue: T-101', message: 'Oil change is overdue by 340 miles. Schedule service immediately.', date: FG.utils.addDays(new Date(), 0), read: false, related_type: 'truck', related_id: 't_101' },
    { id: 'a_02', type: 'safety', severity: 'medium', title: 'Driver Safety Flag: Devon Carter', message: '2 speeding events in the last 7 days. Coaching session recommended.', date: FG.utils.addDays(new Date(), -1), read: false, related_type: 'driver', related_id: 'd_003' },
    { id: 'a_03', type: 'compliance', severity: 'medium', title: 'CDL Renewal Approaching: Devon Carter', message: 'CDL expires Dec 1, 2025 (216 days). Begin renewal process.', date: FG.utils.addDays(new Date(), -2), read: false, related_type: 'driver', related_id: 'd_003' },
    { id: 'a_04', type: 'insurance', severity: 'low', title: 'Insurance Renewal Process Started', message: 'Progressive renewal due May 11. Multi-broker quote initiated.', date: FG.utils.addDays(new Date(), -3), read: true, related_type: 'insurance', related_id: 'ins_01' },
    { id: 'a_05', type: 'compliance', severity: 'medium', title: 'Med Card Expiring: Brandon Kim', message: 'Medical card expires Aug 5, 2025. Schedule DOT physical.', date: FG.utils.addDays(new Date(), -5), read: true, related_type: 'driver', related_id: 'd_005' },
    { id: 'a_06', type: 'parts', severity: 'low', title: 'Parts Reorder: Air Filter / Hydraulic Hose / Wiper Blade', message: '3 SKUs at or below reorder point.', date: FG.utils.addDays(new Date(), -1), read: false, related_type: null, related_id: null },
  ];

  const billing = [
    { id: 'b_01', invoice_number: 'FG-2025-04', plan: 'All-Access', amount: 399.00, period_start: '2025-04-01', period_end: '2025-04-30', status: 'Paid', issued_date: '2025-04-01', paid_date: '2025-04-02' },
    { id: 'b_02', invoice_number: 'FG-2025-03', plan: 'All-Access', amount: 399.00, period_start: '2025-03-01', period_end: '2025-03-31', status: 'Paid', issued_date: '2025-03-01', paid_date: '2025-03-03' },
    { id: 'b_03', invoice_number: 'FG-2025-02', plan: 'All-Access', amount: 399.00, period_start: '2025-02-01', period_end: '2025-02-28', status: 'Paid', issued_date: '2025-02-01', paid_date: '2025-02-02' },
    { id: 'b_04', invoice_number: 'FG-2025-01', plan: 'All-Access', amount: 399.00, period_start: '2025-01-01', period_end: '2025-01-31', status: 'Paid', issued_date: '2025-01-01', paid_date: '2025-01-04' },
    { id: 'b_05', invoice_number: 'FG-2024-12', plan: 'All-Access', amount: 399.00, period_start: '2024-12-01', period_end: '2024-12-31', status: 'Paid', issued_date: '2024-12-01', paid_date: '2024-12-02' },
    { id: 'b_06', invoice_number: 'FG-2025-05', plan: 'All-Access', amount: 399.00, period_start: '2025-05-01', period_end: '2025-05-31', status: 'Pending', issued_date: '2025-05-01', paid_date: null },
  ];

  const garage_shops = [
    { id: 'g_01', name: 'Diesel Dynamics', tier: 'Partner', specialties: 'Heavy diesel, transmission, DPF', address: '2840 Lockbourne Rd, Columbus OH', phone: '(614) 555-0301', contact: 'Frank Russo', rating: 4.8, discount_pct: 12, notes: 'Currently servicing T-107.' },
    { id: 'g_02', name: 'Columbus Truck Service', tier: 'Partner', specialties: 'General repair, AC, brakes', address: '901 Harmon Ave, Columbus OH', phone: '(614) 555-0322', contact: 'Lisa Park', rating: 4.6, discount_pct: 10, notes: '24-hr towing partner.' },
    { id: 'g_03', name: 'Smith Auto Body', tier: 'Preferred', specialties: 'Body work, paint, glass', address: '4112 Cleveland Ave, Columbus OH', phone: '(614) 555-0345', contact: 'Doug Smith', rating: 4.5, discount_pct: 8, notes: '' },
    { id: 'g_04', name: 'Midwest Hydraulics', tier: 'Preferred', specialties: 'Hydraulic systems, boom service', address: '15 Williams Rd, Groveport OH', phone: '(614) 555-0367', contact: 'Renee Cole', rating: 4.7, discount_pct: 10, notes: 'Tow boom specialists.' },
    { id: 'g_05', name: 'Buckeye Tire Center', tier: 'Standard', specialties: 'Tires, alignment', address: '2299 Morse Rd, Columbus OH', phone: '(614) 555-0389', contact: 'Mike T.', rating: 4.2, discount_pct: 5, notes: '' },
    { id: 'g_06', name: 'Express Lube Plus', tier: 'Standard', specialties: 'Quick PM, oil, filters', address: '720 Hamilton Rd, Gahanna OH', phone: '(614) 555-0404', contact: 'Front Counter', rating: 4.0, discount_pct: 5, notes: '' },
  ];

  const reports = [
    { id: 'rep_01', type: 'safety', name: 'April 2025 Driver Safety Summary', period: 'April 2025', generated_date: FG.utils.addDays(new Date(), -2), summary: '5 incidents, 2 high-severity. Devon Carter flagged.' },
    { id: 'rep_02', type: 'maintenance', name: 'Q1 2025 Maintenance Cost Report', period: 'Q1 2025', generated_date: FG.utils.addDays(new Date(), -28), summary: 'Total spend $14,820. Down 8% YoY.' },
    { id: 'rep_03', type: 'compliance', name: 'DOT Audit Readiness — March 2025', period: 'March 2025', generated_date: FG.utils.addDays(new Date(), -55), summary: '94% compliance score. 2 expiring docs flagged.' },
    { id: 'rep_04', type: 'insurance', name: '2024 Loss Run Compilation', period: 'FY 2024', generated_date: FG.utils.addDays(new Date(), -90), summary: '1 minor incident, $2,300 paid out. Used for renewal quotes.' },
  ];

  const seed = () => {
    FG.storage.set('company', company);
    FG.storage.set('trucks', trucks);
    FG.storage.set('drivers', drivers);
    FG.storage.set('maintenance', maintenance);
    FG.storage.set('repairs', repairs);
    FG.storage.set('parts', parts);
    FG.storage.set('dot_files', dot_files);
    FG.storage.set('safety_incidents', safety_incidents);
    FG.storage.set('insurance_policies', insurance_policies);
    FG.storage.set('documents', documents);
    FG.storage.set('alerts', alerts);
    FG.storage.set('billing', billing);
    FG.storage.set('garage_shops', garage_shops);
    FG.storage.set('reports', reports);
    FG.storage.set('seeded', true);
  };

  const ensureSeeded = () => {
    if (!FG.storage.get('seeded')) seed();
  };

  const reset = () => {
    FG.storage.clearAll();
    seed();
  };

  return { seed, ensureSeeded, reset };
})();
