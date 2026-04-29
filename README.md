# FleetGuard Pro

Fractional fleet management platform for small tow truck and box truck operators in Ohio.

A single-codebase product with two surfaces:

- **Marketing site** — public pages that convert visitors into members
- **Member portal** — 15-panel dashboard for fleet, drivers, compliance, finance

> Status: Phase 1 (demo complete) · 15/15 panels live with full CRUD on localStorage seed data.

---

## Demo

Live URL: _pending — will be filled in after first Cloudflare Pages deploy._

---

## Quick Start

No build step. No dependencies.

```bash
# Option A — open directly
open index.html

# Option B — local server (recommended for dev — avoids file:// CORS quirks)
python3 -m http.server 8000
# then visit http://localhost:8000

# Option C — npx
npx serve .
```

The marketing site loads first. Click **Sign In to Dashboard** (or **Dashboard Demo** in the footer) to enter the member portal as the seeded demo user.

---

## Demo Data

Pre-seeded as **ABC Towing LLC**:

| Entity              | Count |
|---------------------|-------|
| Trucks              | 7     |
| Drivers             | 5     |
| Maintenance tasks   | 8     |
| Repairs             | 5     |
| Parts SKUs          | 9     |
| DOT files           | 8     |
| Safety incidents    | 5     |
| Insurance policies  | 4     |
| Documents           | 6     |
| Alerts              | 6     |
| Invoices            | 6     |
| Garage shops        | 6     |
| Saved reports       | 4     |

Click **Reset Demo** in the sidebar to restore seed state at any time.

All persistence is in `localStorage` under `fgp_*` keys.

---

## File Structure

```
FleetGuardPro/
├── index.html              shell — loads CSS/JS, hosts both surfaces
├── css/
│   ├── base.css            tokens, resets, utilities, badges
│   ├── marketing.css       public pages
│   ├── dashboard.css       portal layout, sidebar, panels
│   ├── components.css      modals, toasts, shared UI
│   └── print.css           print stylesheet (Reports, invoices)
├── js/
│   ├── utils.js            formatters, dates, sort/filter helpers
│   ├── storage.js          namespaced localStorage wrapper
│   ├── seed.js             ABC Towing demo dataset
│   ├── state.js            generic CRUD repository
│   ├── modals.js           modal stack, confirm, generic form builder
│   ├── charts.js           SVG bar/line/donut (no deps)
│   ├── table.js            reusable sortable/filterable/searchable table
│   ├── app.js              boot, routing, sidebar, alert badge
│   └── panels/             one file per panel (15 total)
└── assets/                 logo, icons, screenshots
```

---

## Adding a Panel

1. Create `js/panels/<panel-name>.js` exporting a `render(container)` function.
2. Add a sidebar entry in `app.js` with route, label, icon.
3. Add seed data array in `seed.js` if the panel has its own entity.
4. Register the entity with `state.repo('<entity>')` to get free CRUD.
5. Use `Table.render(...)`, `Modals.openForm(...)`, and `Charts.*` from the shared modules.

A new panel typically lands in 80–150 lines because the repository, table, modal, and chart layers are already abstracted.

---

## Brand Tokens

Defined in `css/base.css`:

| Token         | Value      | Use                          |
|---------------|------------|------------------------------|
| `--black`     | `#0a0a0a`  | Page background              |
| `--panel`     | `#161b22`  | Cards, modals, sidebar       |
| `--border`    | `#21262d`  | Dividers                     |
| `--text`      | `#e6edf3`  | Primary text                 |
| `--muted`     | `#7d8590`  | Secondary text               |
| `--accent`    | `#f5a623`  | Primary CTA, highlights      |
| `--steel`     | `#1f6feb`  | Secondary CTA, links         |
| `--success`   | `#2ea043`  | Healthy / paid / passed      |
| `--warning`   | `#d29922`  | Due soon                     |
| `--danger`    | `#da3633`  | Overdue / failed / critical  |

Type stack: **Bebas Neue** (display) · **DM Sans** (body) · **DM Mono** (data).

---

## Roadmap

- **Phase 1 — COMPLETE** · demo dashboard, 15 panels, accessibility pass, print stylesheet, orphan safety, auto-alerts, marketing polish. Tag: `v1.0.0-demo` _(pending)_.
- **Phase 2 — NEXT** · Backend on Supabase, real auth, Stripe billing, file upload pipeline, audit log.
- **Phase 3 — PENDING** · Production domain, analytics, support escalation, onboarding flow.

See `PHASE1-CLOSEOUT.md` for the full Phase 1 punch list and what landed against each section.

---

## License

Proprietary — © Blue Collar AI / FleetGuard Pro. All rights reserved.
