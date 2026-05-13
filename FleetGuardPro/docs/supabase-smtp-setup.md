# Supabase Custom SMTP Setup (Resend)

Configuration guide for routing Supabase Auth emails (signup confirmation,
magic link, invite user, password reset, email change) through Resend SMTP
so they come from `noreply@fleetguardpro.online` with sender display
**FleetGuard Pro** — same as the transactional emails the
`access-request` Edge Function already sends.

Defaults to keep in mind before starting:

- Default Supabase SMTP rate limit is **~4 emails/hour** — that's the
  limit we kept hitting on the existing invite + password-reset flows.
- Resend free tier allows **100 emails/day**; the paid tier (which this
  project is on) allows **50,000/month**. Switching to Resend SMTP
  removes the practical cap for all forecasted invite + reset volume.
- The `fleetguardpro.online` domain is already verified in Resend
  (SPF / DKIM / DMARC) — the same verification used for the
  `access-request` Edge Function emails. No DNS changes needed.

## Where to paste it

1. Supabase Studio → your project (`yodxzdkbtwxyllnnrmkl`)
2. **Project Settings → Authentication → SMTP Settings** (in some
   dashboard revisions this is labelled **Authentication → Emails →
   SMTP Settings** — the form is the same)
3. Toggle **Enable Custom SMTP** ON
4. Fill in the fields below
5. Click **Save**

The existing `RESEND_API_KEY` value already configured for the
`access-request` Edge Function is reused as the SMTP password. Do not
mint a new key.

## Field values

Paste these into the SMTP form exactly:

| Field             | Value                                         |
| ----------------- | --------------------------------------------- |
| Sender email      | `noreply@fleetguardpro.online`                |
| Sender name       | `FleetGuard Pro`                              |
| Host              | `smtp.resend.com`                             |
| Port              | `587`                                         |
| Minimum interval  | `60` seconds *(Supabase default is fine)*     |
| Username          | `resend`                                      |
| Password          | *(paste the `RESEND_API_KEY` value)*          |

Notes on each field:

- **Sender email** — must match a verified sender on the Resend domain.
  `noreply@fleetguardpro.online` is already verified and is what the
  `access-request` function uses, so recipient inboxes will thread
  auth emails together with transactional notifications.
- **Sender name** — drives the inbox display label. Before this change
  recipients see "Supabase Auth"; after, they see "FleetGuard Pro".
- **Host / Port** — Resend's SMTP gateway. Port 587 uses STARTTLS;
  Supabase's SMTP client handles the upgrade automatically. Do not use
  port 465 (implicit TLS) — Supabase's form expects STARTTLS on 587.
- **Username** — Resend's SMTP username is the literal string `resend`
  for every account. The per-account distinguisher is the API key in
  the password field.
- **Password** — the existing API key stored as the `RESEND_API_KEY`
  Supabase secret. Retrieve it from the Resend dashboard
  (**API Keys** → the key used for `access-request`); copy the full
  `re_…` value. Treat it as a secret — Supabase masks the field after
  save.
- **Minimum interval** — Supabase's per-user throttle, unrelated to
  Resend. The default (60 s between repeat emails to the same address)
  prevents recipient-side spam and is fine to keep.

## Rate limit settings

After enabling custom SMTP, Supabase removes the 4-emails/hour cap and
replaces it with a per-hour cap you control under **Authentication →
Rate Limits**. Recommended starting values for FleetGuard Pro:

| Limit type                          | Recommended | Notes                                                            |
| ----------------------------------- | ----------- | ---------------------------------------------------------------- |
| Emails sent per hour                | `30`        | Comfortably above expected invite + reset volume during beta.    |
| Token verifications per 5 min       | *(default)* | Unrelated to SMTP — leave as-is.                                 |

Resend's plan caps (50,000/month on the paid tier) sit far above this
ceiling, so the Supabase cap is the operative one. Raise as needed.

## Testing plan

After saving the SMTP settings, run both flows end-to-end with a real
inbox you control:

1. **Password reset** — on the marketing site or member dashboard,
   click **Forgot password** and submit your email.
   - Confirm the email arrives.
   - Confirm the **From** address is
     `noreply@fleetguardpro.online`, **not**
     `noreply@mail.app.supabase.io`.
   - Confirm the inbox display name is **FleetGuard Pro**, not
     **Supabase Auth**.
   - Click the reset link and confirm it lands on
     `reset-password.html` with the recovery session attached.
2. **Invite user** — from the admin console, approve a pending
   access request (Phase B admin panel → **Pending** → **Approve**).
   The `admin-approve-request` Edge Function calls
   `auth.admin.inviteUserByEmail`, which routes through the same
   SMTP profile.
   - Confirm the invite email arrives at the requester's address.
   - Same From + sender-name checks as above.
   - Click the **Activate My Account** button and confirm it lands
     on `complete-signup.html` with the invite session attached.
3. *(Optional)* **Signup confirmation** — if Confirm Email is enabled,
   trigger a public signup and verify the confirmation email follows
   the same routing. Currently not enabled for FleetGuard Pro (all
   account creation goes through the admin invite path), so this is
   only relevant if the signup flow is reactivated.

If either test email arrives from the old Supabase sender, the SMTP
form was likely saved while a field was still empty — Supabase falls
back to its default sender silently in that case. Re-open the form,
re-check every field, and re-save.

## Notes

- All Auth emails route through this single SMTP profile — there's no
  per-template override. The branded subject/body markup in
  `password-reset-email-template.md` and
  `admin-invite-email-template.md` continues to apply; only the
  envelope (From address, sender name, transport) changes.
- The `FROM_EMAIL` constant in `supabase/functions/access-request/index.ts`
  and `supabase/functions/admin-approve-request/index.ts` is a
  **separate** path — those functions call the Resend HTTP API
  directly, not SMTP. They already send from
  `noreply@fleetguardpro.online`, so no code change is needed there.
- Rotating the Resend API key in the future requires updating both
  the `RESEND_API_KEY` Supabase secret (used by the Edge Functions
  over HTTPS) **and** the SMTP password field in this form (used by
  Auth over SMTP). They are not linked — Supabase does not pull
  secrets into the Auth SMTP config automatically.
- Resend SMTP does not require running `notify pgrst, 'reload schema';`
  — that note in `CLAUDE.md` only applies to DDL migrations affecting
  PostgREST's view of the schema.

## Related

- Transactional email sender (HTTPS, not SMTP):
  `supabase/functions/access-request/index.ts`
- Invite email sender (HTTPS, not SMTP — but the invite SMTP path
  triggered by `inviteUserByEmail` is what this doc configures):
  `supabase/functions/admin-approve-request/index.ts`
- Auth email body markup:
  - `password-reset-email-template.md`
  - `admin-invite-email-template.md`
- Resend dashboard: <https://resend.com/api-keys> for the key,
  <https://resend.com/domains> to confirm `fleetguardpro.online`
  verification status.
