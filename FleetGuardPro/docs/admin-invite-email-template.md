# Admin Invite Email Template

Branded copy for the Supabase invite email sent by the
`admin-approve-request` Edge Function (Phase B). Paste this into the
Supabase dashboard after merging the Phase B PR.

## Where to paste it

1. Supabase Studio → your project (`yodxzdkbtwxyllnnrmkl`)
2. **Authentication → Email Templates → Invite User**
3. Replace the **Subject heading** and the **Message body** with the values below
4. Save

The `{{ .ConfirmationURL }}` placeholder must remain — Supabase substitutes
it with the invite link at send time. `{{ .Data.company_name }}` is the
field name we pass through `inviteUserByEmail({ data: { company_name } })`
from the Edge Function; if you rename that key in the function, rename it
here too.

## Subject heading

Paste exactly the line below into the **Subject heading** field — no leading
or trailing characters:

    Your FleetGuard Pro account is ready

## Message body (HTML)

Paste exactly the HTML below into the **Message body** field. Copy from the
first `<h2>` through the closing `</p>` only — do not include the indent or
any surrounding markdown.

    <h2 style="font-family: 'DM Sans', Arial, sans-serif; font-size: 22px; color: #0d1117; margin: 0 0 16px">You're in.</h2>

    <p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #24292f; line-height: 1.5; margin: 0 0 16px">
      Your FleetGuard Pro access request for <strong>{{ .Data.company_name }}</strong> has been approved.
    </p>

    <p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #24292f; line-height: 1.5; margin: 0 0 24px">
      Click the button below to set a password and activate your member dashboard.
    </p>

    <p style="margin: 0 0 24px">
      <a href="{{ .ConfirmationURL }}" style="background: #f5a623; color: #0d1117; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-family: 'DM Sans', Arial, sans-serif; font-weight: 600; font-size: 15px">Activate My Account</a>
    </p>

    <p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #57606a; line-height: 1.5; margin: 0 0 24px">
      Once you set your password we'll drop you straight into your dashboard. From there you can add your trucks and drivers, and your dedicated FleetGuard specialist will follow up to schedule onboarding.
    </p>

    <p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #57606a; line-height: 1.5; margin: 0 0 24px">
      Questions before you get started? Reply to this email or call <a href="tel:+16146337935" style="color: #f5a623">(614) 633-7935</a>.
    </p>

    <hr style="border: 0; border-top: 1px solid #d0d7de; margin: 32px 0 16px">

    <p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; color: #57606a; line-height: 1.5; margin: 0">
      FleetGuard Pro · Fractional Fleet Management<br>
      <a href="https://fleetguardpro.online" style="color: #57606a">fleetguardpro.online</a>
    </p>

## Notes

- Inline styles are required. Many email clients (Gmail, Outlook) strip
  `<style>` blocks and external stylesheets. Don't refactor styles out of
  the markup.
- The `#f5a623` button background matches `--accent` in `css/base.css`.
  If the brand accent changes later, sync this template to the new value.
- DM Sans is referenced first with Arial as fallback. Most email clients
  won't load the web font, so Arial is what most recipients will actually
  see — that's intentional, not an oversight.
- The granted services / trial length / plan are intentionally **not**
  enumerated in the email body. The dashboard is the source of truth for
  what's active; the email keeps the activation flow short. (If we later
  want a recap, the data is already in `access_requests.approval_metadata`
  and could be passed through `inviteUserByEmail`'s `data` option for
  template substitution.)
- The phone number `(614) 633-7935` is the same support line used on the
  trial-expired lockout page — keep them in sync.

## Required redirect-URL allowlist entry

The Edge Function sends invitees to `<SITE_URL>/complete-signup.html`
(default `https://fleetguardpro.online/complete-signup.html`). Add this
URL under **Authentication → URL Configuration → Redirect URLs** before
the first invite is approved, otherwise Supabase will refuse the
redirect at click time.

## Related

- Code that triggers this email:
  `supabase/functions/admin-approve-request/index.ts` (calls
  `auth.admin.inviteUserByEmail`).
- Landing page the link redirects to: `complete-signup.html`.
- Trigger that bootstraps the tenant (companies + users rows) on first
  insert into `auth.users`: `db/functions.sql` `on_auth_user_created`.
