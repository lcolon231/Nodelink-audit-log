-- ============================================================
-- NodeLink Audit Log — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists audit_events (

  -- Primary key, auto-incrementing (mirrors on-chain entry ID via on_chain_id)
  id            bigserial primary key,

  -- Wall-clock time the row was inserted into Supabase
  created_at    timestamptz not null default now(),

  -- Category of security event (e.g. FILE_ACCESS, USER_LOGIN, CONFIG_CHANGE)
  event_type    text        not null,

  -- Identity of the user, service, or system that performed the action
  actor         text        not null,

  -- The file, endpoint, record, or system that was acted upon (optional)
  resource      text,

  -- Flexible JSON context: IP address, user agent, before/after values, etc.
  metadata      jsonb,

  -- keccak256 hash of the canonical event payload written to the blockchain.
  -- Stored as a 0x-prefixed hex string. Re-hashing the row and comparing to
  -- this value proves the off-chain record has not been tampered with.
  data_hash     text        not null,

  -- The numeric entry ID returned by AuditLog.logEvent() on Sepolia.
  -- Null until the blockchain write is confirmed.
  on_chain_id   bigint,

  -- Sepolia transaction hash of the logEvent() call (0x-prefixed).
  -- Null until the transaction is confirmed.
  tx_hash       text,

  -- Sepolia block number where the transaction was mined.
  -- Null until confirmed.
  block_number  bigint,

  -- Lifecycle of the blockchain mirror step.
  -- pending   → row inserted, chain write not yet attempted
  -- confirmed → logEvent() mined and on_chain_id/tx_hash/block_number populated
  -- failed    → chain write attempted but errored (see metadata for reason)
  chain_status  text        not null default 'pending'
    check (chain_status in ('pending', 'confirmed', 'failed'))

);

-- Fast lookups by event category in reverse-chronological order
-- (used by the dashboard and compliance reports)
create index if not exists idx_audit_events_type_time
  on audit_events (event_type, created_at desc);

-- Fast lookup by hash (used by the integrity-verification endpoint)
create index if not exists idx_audit_events_data_hash
  on audit_events (data_hash);

-- ── Row-Level Security ─────────────────────────────────────
-- Enable RLS so the anon key can only read; only the service
-- role (used by the backend bridge) can insert/update.
alter table audit_events enable row level security;

-- Public read policy (anon key / frontend)
create policy "Public can read audit events"
  on audit_events for select
  using (true);

-- Service role bypass: Supabase automatically grants full
-- access to the service_role key regardless of RLS policies,
-- so no explicit insert policy is needed for the bridge script.
