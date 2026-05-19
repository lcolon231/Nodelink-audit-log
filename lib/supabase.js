const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const url = process.env.SUPABASE_URL;
if (!url) throw new Error("SUPABASE_URL is not set in .env");

// Server-side client — used by backend scripts and the bridge layer.
// The service role key bypasses Row Level Security and can write to any table.
// Never expose this key in frontend code or public repos.
const serviceClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Public client — safe to use in frontend code.
// Respects Row Level Security; read-only for audit_events per schema policy.
const publicClient = createClient(url, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

module.exports = { serviceClient, publicClient };
