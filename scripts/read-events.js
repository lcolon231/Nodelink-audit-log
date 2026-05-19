const { ethers } = require("hardhat");
require("dotenv").config();

// Hardcoded to the block where the known tx landed (0x0323d6...).
// Deployment was at or just before this block.
const DEPLOYMENT_BLOCK = 10881384;
const CHUNK_SIZE       = 10;   // stays inside Alchemy free-tier eth_getLogs limit
const DIVIDER          = "─".repeat(60);

async function main() {
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS is not set in .env");

  console.log("=== NodeLink AuditLog — Read Entries & Events ===\n");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Network : Sepolia\n");

  const auditLog = await ethers.getContractAt("AuditLog", CONTRACT_ADDRESS);

  // ════════════════════════════════════════════════════════════
  // PART A: STORED ENTRIES  (view functions — no log scanning)
  // ════════════════════════════════════════════════════════════
  console.log("=== PART A: STORED ENTRIES (view functions) ===\n");

  const total = await auditLog.getTotalEntries();
  console.log("Total entries on-chain:", total.toString(), "\n");

  if (total === 0n) {
    console.log("No entries stored yet.\n");
  } else {
    // Entries are 1-indexed in the contract
    for (let id = 1n; id <= total; id++) {
      const e = await auditLog.getEntry(id);
      console.log(DIVIDER);
      console.log("  ID          :", e.id.toString());
      console.log("  Event type  :", e.eventType);
      console.log("  Data hash   :", e.dataHash);
      console.log("  Submitter   :", e.submitter);
      console.log("  Timestamp   :", new Date(Number(e.timestamp) * 1000).toISOString());
    }
    console.log(DIVIDER);
    console.log(`\nPart A complete — ${total} entry/entries read from contract storage.\n`);
  }

  // ════════════════════════════════════════════════════════════
  // PART B: EVENT LOG SCAN  (chunked, 10 blocks at a time)
  // ════════════════════════════════════════════════════════════
  console.log("=== PART B: EVENT LOG SCAN (chunked, 10 blocks/call) ===\n");

  const latestBlock  = await ethers.provider.getBlockNumber();
  const totalBlocks  = latestBlock - DEPLOYMENT_BLOCK + 1;
  const totalChunks  = Math.ceil(totalBlocks / CHUNK_SIZE);

  console.log(`Deployment block : ${DEPLOYMENT_BLOCK}`);
  console.log(`Latest block     : ${latestBlock}`);
  console.log(`Total blocks     : ${totalBlocks}`);
  console.log(`Chunks to scan   : ${totalChunks} (${CHUNK_SIZE} blocks each)\n`);

  const filter    = auditLog.filters.EntryLogged();
  const allEvents = [];
  let chunksOk    = 0;
  let chunksFail  = 0;

  for (let from = DEPLOYMENT_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, latestBlock);

    // Print progress every 50 chunks so the terminal doesn't go silent
    const chunkIndex = Math.floor((from - DEPLOYMENT_BLOCK) / CHUNK_SIZE) + 1;
    if (chunkIndex === 1 || chunkIndex % 50 === 0) {
      const pct = Math.round((chunkIndex / totalChunks) * 100);
      process.stdout.write(`  Scanning chunk ${chunkIndex}/${totalChunks} (${pct}%)...\r`);
    }

    try {
      const events = await auditLog.queryFilter(filter, from, to);
      chunksOk++;
      for (const ev of events) {
        allEvents.push(ev);
        console.log("\n" + DIVIDER);
        console.log("  *** EntryLogged event found ***");
        console.log("  Block       :", ev.blockNumber);
        console.log("  Tx hash     :", ev.transactionHash);
        console.log("  ID          :", ev.args.id.toString());
        console.log("  Event type  :", ev.args.eventType);
        console.log("  Data hash   :", ev.args.dataHash);
        console.log("  Submitter   :", ev.args.submitter);
        console.log("  Timestamp   :", new Date(Number(ev.args.timestamp) * 1000).toISOString());
        console.log(DIVIDER);
      }
    } catch (err) {
      chunksFail++;
      console.warn(`\n  [WARN] Chunk [${from}→${to}] failed: ${err.message}`);
    }
  }

  console.log(`\n\nScan complete.`);
  console.log(`  Chunks scanned : ${chunksOk}`);
  console.log(`  Chunks failed  : ${chunksFail}`);
  console.log(`  Events found   : ${allEvents.length}`);

  if (allEvents.length > 0) {
    console.log("\nEtherscan links:");
    for (const ev of allEvents) {
      console.log(`  https://sepolia.etherscan.io/tx/${ev.transactionHash}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
