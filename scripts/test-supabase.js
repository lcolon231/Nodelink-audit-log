require("dotenv").config();
const { serviceClient } = require("../lib/supabase");
const { canonicalHash }  = require("../lib/hash");

const DIVIDER = "─".repeat(60);

async function main() {
  console.log("=== NodeLink — Supabase Write/Read Test ===\n");

  // ── 1. Build sample event ─────────────────────────────────────────────────
  const timestamp = new Date().toISOString();

  const event = {
    event_type: "USER_LOGIN",
    actor:      "admin@nodelink.test",
    resource:   "/admin/dashboard",
    metadata:   { ip: "192.168.1.100", user_agent: "Mozilla/5.0" },
    timestamp,  // included in hash for uniqueness and ordering
  };

  console.log("Sample event:");
  console.log(JSON.stringify(event, null, 2));
  console.log("");

  // ── 2. Compute deterministic hash ─────────────────────────────────────────
  const dataHash = canonicalHash(event);
  console.log("Computed data_hash:", dataHash);
  console.log("");

  // ── 3. Insert row into Supabase ───────────────────────────────────────────
  console.log("Inserting row into audit_events...");

  const { data: inserted, error: insertError } = await serviceClient
    .from("audit_events")
    .insert({
      event_type:   event.event_type,
      actor:        event.actor,
      resource:     event.resource,
      metadata:     event.metadata,
      data_hash:    dataHash,
      // on_chain_id, tx_hash, block_number left null — bridge will fill these
      chain_status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    console.error("INSERT failed:", insertError.message);
    process.exit(1);
  }

  console.log("Insert successful.\n");

  // ── 4. Print the inserted row ─────────────────────────────────────────────
  console.log(DIVIDER);
  console.log("  Inserted row:");
  console.log("  id           :", inserted.id);
  console.log("  created_at   :", inserted.created_at);
  console.log("  event_type   :", inserted.event_type);
  console.log("  actor        :", inserted.actor);
  console.log("  resource     :", inserted.resource);
  console.log("  metadata     :", JSON.stringify(inserted.metadata));
  console.log("  data_hash    :", inserted.data_hash);
  console.log("  on_chain_id  :", inserted.on_chain_id ?? "(pending)");
  console.log("  tx_hash      :", inserted.tx_hash      ?? "(pending)");
  console.log("  block_number :", inserted.block_number  ?? "(pending)");
  console.log("  chain_status :", inserted.chain_status);
  console.log(DIVIDER);
  console.log("");

  // ── 5. Read the row back by id ────────────────────────────────────────────
  console.log(`Reading row id=${inserted.id} back from Supabase...`);

  const { data: fetched, error: fetchError } = await serviceClient
    .from("audit_events")
    .select("*")
    .eq("id", inserted.id)
    .single();

  if (fetchError) {
    console.error("SELECT failed:", fetchError.message);
    process.exit(1);
  }

  console.log("Read successful.\n");

  // ── 6. Integrity spot-check ───────────────────────────────────────────────
  const hashMatches = fetched.data_hash === dataHash;
  console.log("data_hash round-trip check:", hashMatches ? "PASSED ✓" : "FAILED ✗");

  if (!hashMatches) {
    console.error("  Expected:", dataHash);
    console.error("  Got     :", fetched.data_hash);
    process.exit(1);
  }

  console.log("\nBoth write and read paths work. Supabase integration is ready.");
  console.log(`\nRow id ${inserted.id} is now in audit_events with chain_status='pending'.`);
  console.log("The bridge script will fill on_chain_id, tx_hash, and block_number.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
