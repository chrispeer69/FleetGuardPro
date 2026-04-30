// ============================================================
// SUPABASE — auth client init
// Phase 2B: signup, login, logout, session check.
// Phase 2C will move data reads off localStorage onto these tables.
// ============================================================
//
// Email verification redirect: configure Supabase → Authentication →
// URL Configuration → Site URL = https://fleetguardpro.online.
// file:// origins won't survive the verify-link round-trip; test the
// full flow against the live deploy, not local index.html.
//
// TODO Phase 2D: pull these out of source and into env / build config.
window.FG = window.FG || {};

FG.supabaseConfig = {
  SUPABASE_URL: 'https://yodxzdkbtwxyllnnrmkl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZHh6ZGtidHd4eWxsbm5ybWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzU1OTksImV4cCI6MjA5MzExMTU5OX0.1w2cRbvHiqX81JLxt9RXqlTmxLujV2DyZBc00wfnYbw',
};

(function () {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS SDK not loaded — check the CDN <script> tag.');
    return;
  }
  FG.supabase = window.supabase.createClient(
    FG.supabaseConfig.SUPABASE_URL,
    FG.supabaseConfig.SUPABASE_ANON_KEY
  );
})();
