const express = require("express");
const cors    = require("cors");
require("dotenv").config({ path: "../.env" });

const logsRouter = require("./routes/logs");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/logs", logsRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "AuditLog backend running" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});