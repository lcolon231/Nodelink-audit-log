const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: "../.env" });

const artifactPath = path.join(__dirname, "../artifacts/contracts/AuditLog.sol/AuditLog.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const ABI = artifact.abi;

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
const wallet   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

module.exports = { contract, ethers };