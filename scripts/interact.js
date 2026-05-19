const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  // ── 1. Validate config ──────────────────────────────────────────────────
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS is not set in .env");

  const [signer] = await ethers.getSigners();
  const balance  = await ethers.provider.getBalance(signer.address);

  console.log("=== NodeLink AuditLog — Interact Script ===\n");
  console.log("Signer  :", signer.address);
  console.log("Balance :", ethers.formatEther(balance), "ETH");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("");

  // ── 2. Connect to deployed contract ─────────────────────────────────────
  const auditLog = await ethers.getContractAt("AuditLog", CONTRACT_ADDRESS);

  const isAuth = await auditLog.isAuthorized(signer.address);
  console.log("Authorized to write:", isAuth);
  if (!isAuth) throw new Error("This signer is not authorized to call logEvent.");
  console.log("");

  // ── 3. Build a realistic audit event payload ─────────────────────────────
  const payload = {
    actor:     "admin@nodelink.test",
    action:    "FILE_ACCESS",
    resource:  "/clients/acme/invoice.pdf",
    timestamp: new Date().toISOString(),
  };

  console.log("--- Payload to log ---");
  console.log(JSON.stringify(payload, null, 2));
  console.log("");

  // Hash it the same way the backend does: keccak256(utf8(JSON.stringify(payload)))
  const encoded  = ethers.toUtf8Bytes(JSON.stringify(payload));
  const dataHash = ethers.keccak256(encoded);
  console.log("keccak256 hash:", dataHash);
  console.log("");

  // ── 4. Write to chain ────────────────────────────────────────────────────
  console.log("Submitting logEvent('FILE_ACCESS', hash) to Sepolia...");
  const tx = await auditLog.logEvent("FILE_ACCESS", dataHash);
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for 1 confirmation...");

  const receipt = await tx.wait(1);
  console.log("");
  console.log("Transaction confirmed!");
  console.log("  Tx hash     :", receipt.hash);
  console.log("  Block number:", receipt.blockNumber);
  console.log("  Gas used    :", receipt.gasUsed.toString());
  console.log("");

  // ── 5. Read the entry back ───────────────────────────────────────────────
  const total = await auditLog.getTotalEntries();
  console.log("Total entries on-chain:", total.toString());

  const entry = await auditLog.getEntry(total); // latest entry is always 'total'
  console.log("");
  console.log("--- Entry read from chain ---");
  console.log("  ID        :", entry.id.toString());
  console.log("  Event type:", entry.eventType);
  console.log("  Data hash :", entry.dataHash);
  console.log("  Submitter :", entry.submitter);
  console.log("  Timestamp :", new Date(Number(entry.timestamp) * 1000).toISOString());
  console.log("");

  // ── 6. Integrity check ───────────────────────────────────────────────────
  const isValid = await auditLog.verifyEntry(total, encoded);
  console.log("Integrity check (verifyEntry):", isValid ? "VERIFIED ✓" : "TAMPERED ✗");
  console.log("");
  console.log("View on Etherscan:");
  console.log(`  https://sepolia.etherscan.io/tx/${receipt.hash}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
