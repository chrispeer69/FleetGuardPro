// ============================================================
// DB ERRORS — Postgres error → user-facing translation registry
// ============================================================
// Wave 1: parts. Wave 2: trucks + drivers. Wave 3: maintenance + repairs +
// safety_incidents. Wave 4: insurance_policies + garage_shops. Extend per
// panel as we migrate.
//
// Constraint names follow Postgres canonical auto-naming for inline
// column-level constraints: <table>_<column>_check for CHECK,
// <table>_<column>_fkey for FK, <table>_<col1>_<col2>_key for
// composite UNIQUE. Verified against pg_constraint on dev.
//
// Translated shape:
//   { code, field, message, raw }
//     code    — stable enum string consumers can branch on
//     field   — form field key to highlight (or null)
//     message — user-readable string
//     raw     — original PostgREST error, for logging
window.FG = window.FG || {};

FG.dbErrors = (function () {

  // 23505 — unique_violation. Keyed by Postgres constraint name.
  const UNIQUE = {
    parts_company_id_sku_key: {
      code: 'DUPLICATE_SKU',
      field: 'sku',
      message: 'SKU already exists.',
    },
    trucks_company_id_unit_number_key: {
      code: 'DUPLICATE_UNIT_NUMBER',
      field: 'unit_number',
      message: 'Unit number already exists.',
    },
    insurance_policies_company_id_policy_number_key: {
      code: 'DUPLICATE_POLICY_NUMBER',
      field: 'policy_number',
      message: 'Policy number already exists.',
    },
    garage_shops_company_id_name_key: {
      code: 'DUPLICATE_SHOP_NAME',
      field: 'name',
      message: 'Shop name already exists.',
    },
  };

  // 23514 — check_violation. Keyed by Postgres constraint name.
  const CHECK = {
    parts_qty_on_hand_check:    { code: 'CHECK_VIOLATION', field: 'qty_on_hand',   message: 'Quantity on hand cannot be negative.' },
    parts_reorder_point_check:  { code: 'CHECK_VIOLATION', field: 'reorder_point', message: 'Reorder point cannot be negative.' },
    parts_unit_cost_check:      { code: 'CHECK_VIOLATION', field: 'unit_cost',     message: 'Unit cost cannot be negative.' },

    trucks_year_check:          { code: 'CHECK_VIOLATION', field: 'year',          message: 'Year must be between 1980 and 2100.' },
    trucks_mileage_check:       { code: 'CHECK_VIOLATION', field: 'mileage',       message: 'Mileage cannot be negative.' },
    trucks_next_pm_miles_check: { code: 'CHECK_VIOLATION', field: 'next_pm_miles', message: 'Next PM miles cannot be negative.' },
    trucks_safety_score_check:  { code: 'CHECK_VIOLATION', field: 'safety_score',  message: 'Safety score must be between 0 and 100.' },
    trucks_gvwr_check:          { code: 'CHECK_VIOLATION', field: 'gvwr',          message: 'GVWR cannot be negative.' },
    trucks_type_check:          { code: 'CHECK_VIOLATION', field: 'type',          message: 'Invalid unit type.' },
    trucks_status_check:        { code: 'CHECK_VIOLATION', field: 'status',        message: 'Invalid status.' },

    drivers_cdl_class_check:    { code: 'CHECK_VIOLATION', field: 'cdl_class',     message: 'Invalid CDL class.' },
    drivers_status_check:       { code: 'CHECK_VIOLATION', field: 'status',        message: 'Invalid status.' },
    drivers_safety_score_check: { code: 'CHECK_VIOLATION', field: 'safety_score',  message: 'Safety score must be between 0 and 100.' },

    maintenance_status_check:        { code: 'CHECK_VIOLATION', field: 'status',    message: 'Invalid status.' },
    maintenance_due_miles_check:     { code: 'CHECK_VIOLATION', field: 'due_miles', message: 'Due mileage cannot be negative.' },
    maintenance_cost_check:          { code: 'CHECK_VIOLATION', field: 'cost',      message: 'Cost cannot be negative.' },

    repairs_priority_check:          { code: 'CHECK_VIOLATION', field: 'priority',  message: 'Invalid priority.' },
    repairs_status_check:            { code: 'CHECK_VIOLATION', field: 'status',    message: 'Invalid status.' },
    repairs_est_cost_check:          { code: 'CHECK_VIOLATION', field: 'est_cost',  message: 'Estimated cost cannot be negative.' },

    safety_incidents_severity_check: { code: 'CHECK_VIOLATION', field: 'severity',  message: 'Invalid severity.' },
    safety_incidents_status_check:   { code: 'CHECK_VIOLATION', field: 'status',    message: 'Invalid status.' },

    insurance_policies_premium_check:        { code: 'CHECK_VIOLATION', field: 'premium',        message: 'Premium cannot be negative.' },
    insurance_policies_deductible_check:     { code: 'CHECK_VIOLATION', field: 'deductible',     message: 'Deductible cannot be negative.' },
    insurance_policies_coverage_limit_check: { code: 'CHECK_VIOLATION', field: 'coverage_limit', message: 'Coverage limit cannot be negative.' },
    insurance_policies_status_check:         { code: 'CHECK_VIOLATION', field: 'status',         message: 'Invalid status.' },

    garage_shops_tier_check:         { code: 'CHECK_VIOLATION', field: 'tier',         message: 'Invalid tier.' },
    garage_shops_rating_check:       { code: 'CHECK_VIOLATION', field: 'rating',       message: 'Rating must be between 0 and 5.' },
    garage_shops_discount_pct_check: { code: 'CHECK_VIOLATION', field: 'discount_pct', message: 'Discount must be between 0 and 100.' },
  };

  // Constraint name parsed from message; details is locale-shaped.
  const constraintFromMessage = (msg) => {
    if (!msg) return null;
    const m = msg.match(/constraint "([^"]+)"/);
    return m ? m[1] : null;
  };

  // 23502 NOT NULL — column on err.column for PostgREST 12+, fallback to message.
  const columnFromError = (err) => {
    if (err && err.column) return err.column;
    const m = err && err.message && err.message.match(/column "([^"]+)"/);
    return m ? m[1] : null;
  };

  const translate = (err) => {
    if (!err) return null;
    const code = err.code;

    if (code === '23505') {
      const name = constraintFromMessage(err.message);
      if (name && UNIQUE[name]) return { ...UNIQUE[name], raw: err };
      return { code: 'DUPLICATE', field: null, message: 'That value is already taken.', raw: err };
    }

    if (code === '23514') {
      const name = constraintFromMessage(err.message);
      if (name && CHECK[name]) return { ...CHECK[name], raw: err };
      return { code: 'CHECK_VIOLATION', field: null, message: 'Value violates a database constraint.', raw: err };
    }

    if (code === '23502') {
      const col = columnFromError(err);
      return { code: 'REQUIRED', field: col, message: col ? `${col} is required.` : 'A required field is missing.', raw: err };
    }

    if (code === '42501') {
      return { code: 'FORBIDDEN', field: null, message: 'You do not have permission to perform this action.', raw: err };
    }

    return { code: 'UNKNOWN', field: null, message: err.message || 'Save failed. Please try again.', raw: err };
  };

  return { translate };
})();
