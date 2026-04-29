# Phase 1 Closeout — Punch List

Hand this to Claude Code as a working ticket list. Each item is scoped to land in one focused commit.

---

## A. Print + Reports Engine wiring

- [ ] Add `<link rel="stylesheet" href="css/print.css" media="print">` to `index.html`.
- [ ] In `js/panels/reports.js`, wire each "Export PDF" button to:
  ```js
  function printReport(reportId) {
    document.body.classList.add('printing');
    document.body.dataset.printDate = new Date().toLocaleDateString();
    document.body.dataset.companyName = State.get('company').name;
    window.print();
    document.body.classList.remove('printing');
    delete document.body.dataset.printDate;
    delete document.body.dataset.companyName;
  }
  ```
- [ ] Same pattern in `js/panels/billing.js` for invoice printing.
- [ ] Label the "Email" buttons "Coming soon — Phase 2" or hide them via `data-no-print` and a `data-phase="2"` attribute that's currently dimmed.
- [ ] Smoke test: open Reports → Vehicle Cost Summary → Print → confirm sidebar/buttons hidden, table prints with header repeated on page 2.

## B. Accessibility pass

- [ ] **Modal focus trap:** in `js/modals.js`, on open, capture all focusable descendants and cycle Tab/Shift+Tab within the modal. Restore focus to the trigger element on close.
- [ ] **ESC** already wired (per status update) — verify it actually fires when focus is inside a form input.
- [ ] **ARIA on charts:** every SVG in `js/charts.js` gets `role="img"` and an `<title>` child describing the chart (e.g. "Operating costs, last 6 months, ranging from $4,200 to $9,800").
- [ ] **Contrast check:** `--muted` (#7d8590) on `--panel` (#161b22) is around 4.6:1 — passes WCAG AA for normal text but fails for small text below 14px. Audit anywhere `--muted` is used at ≤12px and bump to a lighter shade or larger size.
- [ ] **Form labels:** every input in the generic form builder needs an associated `<label for>` or `aria-label` — verify the builder enforces this.
- [ ] **Skip link:** add `<a href="#main" class="skip-link">Skip to content</a>` as the first focusable element.
- [ ] Run Lighthouse on Overview, Fleet Units, and Reports panels. Target Accessibility ≥ 95.

## C. Mobile responsive pass

- [ ] **Test viewports:** 375 (iPhone SE), 414 (iPhone Plus), 768 (iPad portrait).
- [ ] **Wide tables** — Fleet Units, Maintenance, Reports detail views — wrap in `<div class="table-wrap">` with `overflow-x: auto` and a subtle scroll shadow on the right edge.
- [ ] **Modals** at <768px: full-screen instead of centered card. Sticky header with title + close, sticky footer with action buttons.
- [ ] **KPI grid** at <768px: 2 columns instead of 4.
- [ ] **Sidebar** already collapses (per status) — verify the collapsed state on the dashboard route doesn't push content off-screen.
- [ ] **Filter bars** at <768px: stack vertically, full-width inputs.
- [ ] Test the "Add Truck" / "Add Driver" / "Request Service" workflows on mobile end-to-end.

## D. localStorage hardening

- [ ] Wrap all `storage.set()` calls in try/catch; on `QuotaExceededError`, show toast: "Storage limit reached. Reset Demo or remove documents to continue."
- [ ] Add `storage.estimate()` helper that returns approximate `fgp_*` size in KB; show on Company Profile in dev mode.
- [ ] Confirm **Reset Demo** scope: should clear `fgp_data_*` keys but preserve `fgp_session_*` so the user stays logged in. Verify and adjust if needed.

## E. Cross-entity orphan safety

- [ ] **Driver delete** — block (or warn + reassign) if driver has open repairs or pending DOT files attached.
- [ ] **Truck delete** — block if open repairs exist; cascade-delete maintenance tasks with confirmation.
- [ ] **Garage shop delete** — block if pending Request Service exists.
- [ ] **Part delete** — block if `on_hand > 0` or referenced in any open repair's `parts_used[]`.
- [ ] Use the existing confirm modal — surface what will be affected ("This shop has 2 open repair requests").

## F. Auto-generated alerts (cross-entity wiring)

Currently you only have static seed alerts. Add generators that run on app boot + after each CRUD:

- [ ] CDL or medical card expiring within 30 days → alert.
- [ ] Insurance policy expiring within 60 days → alert.
- [ ] Maintenance task overdue (date passed OR mileage exceeded) → alert.
- [ ] Part stock at or below `reorder_at` → alert.
- [ ] DOT file expired or expiring within 30 days → alert.

Single function in `js/state.js` like `generateAlerts()` — idempotent, dedupes by (type, target_id), runs after every repo write.

## G. Marketing site polish

- [ ] All CTAs scroll to or route correctly (no dead `<a>` tags).
- [ ] Pricing cards: $149/mo à la carte and $399/mo full membership clearly differentiated; "Most Popular" badge on Membership.
- [ ] Contact form: client-side validation on email + phone, success state shows toast + clears form.
- [ ] Footer links: Terms, Privacy, Cookie — even if stub pages, link to a single boilerplate `/legal.html`.
- [ ] Open Graph tags + favicon + page title.
- [ ] OG image (1200×630) — placeholder until a real one is shot.

## H. Smoke test before deploy

- [ ] Reset Demo → walk through every panel → no console errors.
- [ ] Add a truck → confirm appears in Fleet Units, Overview KPI updates, Activity feed updates.
- [ ] Open Garage Access → Request Service → confirm Repair Request auto-created.
- [ ] Open Maintenance → mark task complete → confirm Activity feed + alert badge update.
- [ ] Print Reports → confirm clean output.
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- [ ] Test in Safari, Firefox, Chrome, mobile Safari.

## I. Deploy

**Recommended: Cloudflare Pages or Vercel** — both free, both serve static instantly.

### Cloudflare Pages (recommended for static)
```bash
# from repo root
npx wrangler pages deploy . --project-name=fleetguard-pro
```
Or connect the GitHub repo via dashboard at [pages.cloudflare.com](http://pages.cloudflare.com) → builds on push.

### Vercel
```bash
npm i -g vercel
vercel --prod
```
Vercel auto-detects static site, no config needed.

### Custom domain
- Buy `fleetguardpro.com` (Cloudflare Registrar — at-cost pricing).
- Point to deploy via Cloudflare DNS.
- SSL auto-provisioned.

---

## Definition of Done — Phase 1

- All checkboxes above ticked
- Demo URL live, shareable, password-protected if you want a soft launch (`htpasswd` via Cloudflare Access or Vercel Password Protection)
- README + BUILD.md + this file in repo root
- Tag the commit: `git tag v1.0.0-demo && git push --tags`
