const express   = require("express");
const router    = express.Router();
const { contract, ethers } = require("../contract");

// POST /api/logs — write a new event to the chain
router.post("/", async (req, res) => {
  try {
    const { eventType, payload } = req.body;
    if (!eventType || !payload) {
      return res.status(400).json({ error: "eventType and payload are required" });
    }

    const encoded   = ethers.toUtf8Bytes(JSON.stringify(payload));
    const dataHash  = ethers.keccak256(encoded);
    const tx        = await contract.logEvent(eventType, dataHash);
    const receipt   = await tx.wait();

    res.json({
      success:  true,
      txHash:   receipt.hash,
      message:  "Event logged on-chain"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs — fetch all log entries
router.get("/", async (req, res) => {
  try {
    const total = await contract.getTotalEntries();
    if (total === 0n) return res.json([]);

    const entries = await contract.getEntries(1, total);
    const result  = entries.map(e => ({
      id:        e.id.toString(),
      eventType: e.eventType,
      dataHash:  e.dataHash,
      submitter: e.submitter,
      timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/verify — verify a log entry against its original payload
router.post("/verify", async (req, res) => {
  try {
    const { id, payload } = req.body;
    if (!id || !payload) {
      return res.status(400).json({ error: "id and payload are required" });
    }

    const encoded  = ethers.toUtf8Bytes(JSON.stringify(payload));
    const isValid  = await contract.verifyEntry(id, encoded);

    res.json({ id, isValid, status: isValid ? "VERIFIED" : "TAMPERED" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;