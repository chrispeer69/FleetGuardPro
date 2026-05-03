# Password Reset Email Template

Branded copy for the Supabase password-reset email. Paste this into the
Supabase dashboard after merging the password-reset flow PR.

## Where to paste it

1. Supabase Studio → your project (`yodxzdkbtwxyllnnrmkl`)
2. **Authentication → Email Templates → Reset Password**
3. Replace the **Subject heading** and the **Message body** with the values below
4. Save

The `{{ .ConfirmationURL }}` placeholder must remain — Supabase substitutes it
with the recovery link at send time. Do not edit the placeholder.

## Subject heading

```
Reset your FleetGuard Pro password
```

## Message body (HTML)

```html
<h2 style="font-family: 'DM Sans', Arial, sans-serif; font-size: 22px; color: #0d1117; margin: 0 0 16px">Reset your password</h2>

<p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #24292f; line-height: 1.5; margin: 0 0 16px">
  We received a request to reset the password for your FleetGuard Pro account.
</p>

<p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #24292f; line-height: 1.5; margin: 0 0 24px">
  Click the button below to set a new password. This link expires in one hour.
</p>

<p style="margin: 0 0 24px">
  <a href="{{ .ConfirmationURL }}" style="background: #f5a623; color: #0d1117; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-family: 'DM Sans', Arial, sans-serif; font-weight: 600; font-size: 15px">Reset Password</a>
</p>

<p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #57606a; line-height: 1.5; margin: 0 0 24px">
  If you didn't request this, you can safely ignore this email — your password won't change.
</p>

<hr style="border: 0; border-top: 1px solid #d0d7de; margin: 32px 0 16px">

<p style="font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; color: #57606a; line-height: 1.5; margin: 0">
  FleetGuard Pro · Fractional Fleet Management<br>
  <a href="https://fleetguardpro.online" style="color: #57606a">fleetguardpro.online</a>
</p>
```

## Notes

- Inline styles are required. Many email clients (Gmail, Outlook) strip
  `<style>` blocks and external stylesheets. Don't refactor styles out of
  the markup.
- The `#f5a623` button background matches `--accent` in `css/base.css`.
  If the brand accent changes later, sync this template to the new value.
- DM Sans is referenced first with Arial as fallback. Most email clients
  won't load the web font, so Arial is what most recipients will actually
  see — that's intentional, not an oversight.
- Bebas Neue (the display font in the app UI) is intentionally not used
  here — narrower display fonts render unpredictably across email clients.
- Sender name and reply-to are configured separately under Auth → Project
  Settings → SMTP Settings, not in this template. The default Supabase
  sender (`noreply@mail.app.supabase.io`) is functional for beta but
  should be replaced with a custom-domain SMTP (SendGrid / Postmark / SES)
  before broader launch — flagged as a separate cleanup.

## Related

- Code that triggers this email: `js/app.js` `openForgotPasswordModal()`
- Landing page the link redirects to: `reset-password.html`
- Required redirect-URL allowlist entry:
  `https://fleetguardpro.online/reset-password.html` under Auth → URL
  Configuration → Redirect URLs
