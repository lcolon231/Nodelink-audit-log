# NodeLink Audit Log

A blockchain-anchored audit log prototype for small and medium-sized business (SMB) security compliance. Combines an off-chain database (Supabase) for rich, queryable event storage with on-chain cryptographic anchoring (Ethereum Sepolia testnet) for tamper-evidence.

---

## About This Project

This repository is the prototype artifact for an MSIT thesis titled **"Blockchain-Based Audit Log for SMB Security Compliance"**, conducted using Design Science Research (DSR) methodology. The central research question is whether SMBs can achieve cryptographically verifiable audit logs using affordable, free-tier-compatible infrastructure — without requiring dedicated blockchain infrastructure or enterprise security budgets.

**Author:** Luis Colon  
**Organization:** NodeLink Technologies

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│     Backend API (Express)  ·  Frontend (React, planned)     │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                      Bridge Layer                           │
│              Node.js scripts  ·  lib/hash.js                │
│        canonicalHash(event)  →  keccak256 commitment        │
└──────────────┬──────────────────────────────┬──────────────┘
               │                              │
┌──────────────▼──────────────┐  ┌───────────▼──────────────┐
│      Off-Chain Store         │  │     On-Chain Anchor        │
│      Supabase Postgres       │  │     Ethereum Sepolia       │
│      audit_events table      │  │     AuditLog.sol           │
│                              │  │                            │
│  Full event records:         │  │  keccak256 hashes only:    │
│  event_type, actor,          │  │  dataHash, submitter,      │
│  resource, metadata,         │  │  eventType, timestamp      │
│  data_hash, chain_status     │  │  (immutable, permanent)    │
└──────────────┬──────────────┘  └───────────┬──────────────┘
               │                              │
┌──────────────▼──────────────────────────────▼──────────────┐
│                   Verification Layer                         │
│   Re-hash Supabase row  →  compare to on-chain commitment   │
│   Result: VERIFIED (match) or TAMPERED (mismatch)           │
└────────────────────────────────────────────────────────────┘
```

**Hybrid design rationale:** Full event data (actor, resource, metadata, timestamps) lives in Supabase Postgres for fast, cheap, SQL-queryable storage. Only the keccak256 hash of each event is written to the Ethereum smart contract. This keeps gas costs minimal while providing a cryptographic commitment that cannot be altered without detection. Integrity is verified by re-hashing the Supabase row with the same deterministic function (`canonicalHash`) and comparing the result to the on-chain stored hash — a mismatch proves tampering.

---

## Tech Stack

**Smart contract layer**
- Solidity 0.8.28
- Hardhat 2.28.6 (compile, test, deploy, verify)
- ethers.js 6.x (contract interaction)

**Network**
- Ethereum Sepolia testnet
- Alchemy (RPC provider, free tier)
- MetaMask (wallet / transaction signing)

**Off-chain storage**
- Supabase (Postgres + JS client `@supabase/supabase-js`)
- Row Level Security enabled on `audit_events` table

**Hashing**
- keccak256 via ethers.js (`ethers.keccak256`)
- Deterministic canonical JSON serialization (sorted keys, `lib/hash.js`)

**Runtime / tooling**
- Node.js 18+
- dotenv for environment variable management
- Hardhat Toolbox (chai, mocha, hardhat-gas-reporter, solidity-coverage, typechain)

---

## Current Status

### Implemented

- [x] **Smart contract written** — `contracts/AuditLog.sol`: access-controlled event logging with keccak256 data anchoring, batch retrieval, on-chain integrity verification, and owner-managed submitter allowlist
- [x] **Contract deployed to Sepolia** — [`0x81A0320ecB33ce82C803EF890b1022e062bb9c31`](https://sepolia.etherscan.io/address/0x81A0320ecB33ce82C803EF890b1022e062bb9c31)
- [x] **Contract source verified on Etherscan** — ABI and source visible at the address above under the *Contract* tab
- [x] **On-chain write confirmed** — sample `FILE_ACCESS` entry written via `scripts/interact.js` ([tx `0x0323d6...e22a`](https://sepolia.etherscan.io/tx/0x0323d683cace4d2d0387d857c0805c7cdfa112b1736dcef7685799588131e22a))
- [x] **Dual on-chain read confirmed** — `scripts/read-events.js` retrieves entries via both `getEntry()` view calls and chunked `eth_getLogs` scanning (Alchemy free-tier compatible, 10-block chunks)
- [x] **Hardhat test suite** — `test/AuditLog.js`: 18 tests covering all contract functions, access control paths, and edge cases
- [x] **Supabase project provisioned** — `audit_events` table deployed via `supabase/schema.sql` with indexes on `(event_type, created_at)` and `data_hash`, plus RLS policies
- [x] **Deterministic canonical hashing** — `lib/hash.js` exports `canonicalHash(event)` using recursively sorted JSON keys; `scripts/test-supabase.js` confirms write/read round-trip and hash consistency
- [x] **Backend API scaffold** — Express server (`backend/`) with `POST /api/logs`, `GET /api/logs`, `POST /api/logs/verify` endpoints wired to the deployed contract
- [x] **Environment template** — `.env.example` documents all required variables

### Roadmap

- [ ] **Bridge layer** (`scripts/bridge.js`) — poll Supabase for `chain_status = 'pending'` rows, call `logEvent()`, update rows with `on_chain_id`, `tx_hash`, `block_number`, and `chain_status = 'confirmed'`
- [ ] **Verification script** (`scripts/verify.js`) — fetch a Supabase row by ID, re-run `canonicalHash`, compare to on-chain `dataHash` via `verifyEntry()`, print `VERIFIED` or `TAMPERED`
- [ ] **Tampering demonstration** (`scripts/tamper-demo.js`) — mutate a Supabase row without touching the chain, run verification, show mismatch for thesis defense
- [ ] **Functional frontend** — full UI for browsing entries, submitting events, and running integrity checks
- [ ] **Evaluation phase** — performance benchmarks (write latency, read latency, gas cost per entry), cost analysis vs. traditional SIEM solutions, comparison to centralized audit log systems
- [ ] **Thesis Chapters 4 & 5** — evaluation results and discussion

---

## Repository Structure

```
Nodelink-audit-log/
│
├── contracts/
│   ├── AuditLog.sol           # Primary contract: tamper-proof audit log
│   └── Lock.sol               # Hardhat boilerplate sample (unused)
│
├── scripts/
│   ├── deploy.js              # Deploy AuditLog to any configured network
│   ├── interact.js            # Write + read one sample entry end-to-end
│   ├── read-events.js         # Read all entries (view calls + chunked log scan)
│   └── test-supabase.js       # Insert/read Supabase row, verify hash round-trip
│
├── lib/
│   ├── hash.js                # canonicalHash(event) → deterministic keccak256
│   └── supabase.js            # serviceClient (write) + publicClient (read)
│
├── supabase/
│   └── schema.sql             # audit_events table, indexes, RLS policies
│
├── test/
│   ├── AuditLog.js            # 18-test Hardhat suite for AuditLog.sol
│   └── Lock.js                # Hardhat boilerplate tests (unused)
│
├── backend/
│   ├── index.js               # Express server (port 3001)
│   ├── contract.js            # ethers.js contract client
│   └── routes/
│       └── logs.js            # POST /api/logs, GET /api/logs, POST /api/logs/verify
│
├── frontend/                  # React + Vite scaffold (UI not yet functional)
│   ├── index.html
│   ├── vite.config.js         # proxies /api → localhost:3001
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # Log form, entries table, verify panel
│       └── App.css
│
├── ignition/
│   └── modules/Lock.js        # Hardhat Ignition sample (unused)
│
├── hardhat.config.js          # Solidity 0.8.28, localhost + Sepolia networks,
│                              # Etherscan verification, gas reporter
├── package.json               # Root: Hardhat toolchain + @supabase/supabase-js
├── .env.example               # Template for all required environment variables
└── .gitignore
```

---

## Prerequisites

- Node.js 18+
- MetaMask browser extension (funded with Sepolia ETH)
- [Alchemy](https://dashboard.alchemy.com) account — free tier is sufficient
- [Supabase](https://supabase.com) project — free tier is sufficient
- [Etherscan](https://etherscan.io) API key — free tier is sufficient

---

## Environment Variables

Copy `.env.example` to `.env` and populate all fields:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `ALCHEMY_SEPOLIA_URL` | Alchemy HTTPS endpoint for Sepolia |
| `DEPLOYER_PRIVATE_KEY` | Private key of the wallet that signs transactions (testnet only) |
| `CONTRACT_ADDRESS` | Deployed `AuditLog` address — set after running `deploy.js` |
| `ETHERSCAN_API_KEY` | For `npx hardhat verify` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Public key — safe for frontend reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key — backend/bridge only, never expose publicly |
| `PORT` | Backend port (default: `3001`) |

---

## Setup

```bash
# 1. Install root dependencies (Hardhat toolchain + Supabase client)
npm install

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Run the schema in Supabase
#    Dashboard → SQL Editor → New query → paste supabase/schema.sql → Run
```

---

## Scripts Reference

All Hardhat scripts run from the project root. All `node` scripts also run from the root.

```bash
# Compile contracts
npm run compile

# Run test suite
npm test

# Run tests with gas cost report
REPORT_GAS=true npm test

# Run test suite with Solidity coverage
npm run test:coverage

# Start a local Hardhat node (for local development without Sepolia)
npm run node

# Deploy to local node
npm run deploy:local

# Deploy to Sepolia
npm run deploy:sepolia

# Verify deployed contract on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# Write a sample entry and read it back (Sepolia)
npx hardhat run scripts/interact.js --network sepolia

# Read all entries from the chain (view calls + chunked log scan)
npx hardhat run scripts/read-events.js --network sepolia

# Test Supabase write/read and hash round-trip
node scripts/test-supabase.js
```

---

## Smart Contract — AuditLog.sol

Deployed and verified on Sepolia: [`0x81A0320ecB33ce82C803EF890b1022e062bb9c31`](https://sepolia.etherscan.io/address/0x81A0320ecB33ce82C803EF890b1022e062bb9c31#code)

| Function | Access | Description |
|---|---|---|
| `logEvent(eventType, dataHash)` | Authorized | Write a new audit entry; returns `uint256 id` |
| `getEntry(uint256 id)` | Public | Fetch a single entry by ID (1-indexed) |
| `getEntries(uint256 from, uint256 to)` | Public | Fetch a range of entries (inclusive) |
| `getTotalEntries()` | Public | Total number of entries logged |
| `verifyEntry(uint256 id, bytes rawPayload)` | Public | Re-hash payload and compare to stored hash |
| `setSubmitter(address, bool)` | Owner | Grant or revoke write access |
| `isAuthorized(address)` | Public | Check whether an address can write |

**Events emitted:**
```solidity
event EntryLogged(
    uint256 indexed id,
    string          eventType,
    bytes32 indexed dataHash,
    address indexed submitter,
    uint256         timestamp
);
event SubmitterUpdated(address indexed account, bool authorized);
```

---

## Integrity Verification Model

```
Supabase row  ──►  canonicalHash()  ──►  computed hash
                                              │
                                         compare ▼
On-chain entry  ──►  verifyEntry()  ──►  stored dataHash
                                              │
                                    VERIFIED (equal) │ TAMPERED (not equal)
```

`canonicalHash(event)` in `lib/hash.js` sorts all object keys recursively before `JSON.stringify`, ensuring the same logical event always produces the same hash regardless of property insertion order.

---

## License

MIT
