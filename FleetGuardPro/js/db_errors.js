// ============================================================
// DB ERRORS — Postgres error → user-facing translation registry
// ============================================================
// Wave 1: parts only. Extend per panel as we migrate.
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
  };

  // 23514 — check_violation. Keyed by Postgres constraint name.
  const CHECK = {
    parts_qty_on_hand_check:    { code: 'CHECK_VIOLATION', field: 'qty_on_hand',   message: 'Quantity on hand cannot be negative.' },
    parts_reorder_point_check:  { code: 'CHECK_VIOLATION', field: 'reorder_point', message: 'Reorder point cannot be negative.' },
    parts_unit_cost_check:      { code: 'CHECK_VIOLATION', field: 'unit_cost',     message: 'Unit cost cannot be negative.' },
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
