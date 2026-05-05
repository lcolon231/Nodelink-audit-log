const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy();
  await auditLog.waitForDeployment();

  const address = await auditLog.getAddress();
  console.log("AuditLog deployed to:", address);
  console.log("Save this address — you'll need it for the backend!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});