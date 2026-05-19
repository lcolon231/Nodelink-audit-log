const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("AuditLog", function () {
  async function deployFixture() {
    const [owner, submitter, stranger] = await ethers.getSigners();
    const AuditLog = await ethers.getContractFactory("AuditLog");
    const contract = await AuditLog.deploy();
    return { contract, owner, submitter, stranger };
  }

  function makeHash(payload) {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  }

  function makeRaw(payload) {
    return ethers.toUtf8Bytes(JSON.stringify(payload));
  }

  describe("Deployment", function () {
    it("sets the deployer as owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("authorizes the owner by default", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.isAuthorized(owner.address)).to.be.true;
    });

    it("starts with zero entries", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getTotalEntries()).to.equal(0n);
    });
  });

  describe("logEvent", function () {
    it("increments the entry count", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.logEvent("LOGIN", makeHash({ user: "alice" }));
      expect(await contract.getTotalEntries()).to.equal(1n);
    });

    it("emits EntryLogged with correct args", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const hash = makeHash({ user: "alice" });
      await expect(contract.logEvent("LOGIN", hash))
        .to.emit(contract, "EntryLogged")
        .withArgs(1n, "LOGIN", hash, owner.address, anyValue);
    });

    it("stores entry data correctly", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      const hash = makeHash({ file: "/etc/passwd" });
      await contract.logEvent("FILE_ACCESS", hash);
      const entry = await contract.getEntry(1);
      expect(entry.id).to.equal(1n);
      expect(entry.eventType).to.equal("FILE_ACCESS");
      expect(entry.dataHash).to.equal(hash);
      expect(entry.submitter).to.equal(owner.address);
      expect(entry.exists).to.be.true;
    });

    it("reverts for an unauthorized caller", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).logEvent("LOGIN", makeHash({ u: "eve" }))
      ).to.be.revertedWith("AuditLog: caller is not authorized");
    });

    it("reverts for empty eventType", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.logEvent("", makeHash({ u: "alice" }))
      ).to.be.revertedWith("AuditLog: eventType cannot be empty");
    });

    it("reverts for zero dataHash", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.logEvent("LOGIN", ethers.ZeroHash)
      ).to.be.revertedWith("AuditLog: dataHash cannot be zero");
    });
  });

  describe("getEntry", function () {
    it("returns the correct entry", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.logEvent("LOGOUT", makeHash({ user: "bob" }));
      const entry = await contract.getEntry(1);
      expect(entry.eventType).to.equal("LOGOUT");
      expect(entry.submitter).to.equal(owner.address);
    });

    it("reverts for a non-existent id", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getEntry(99)).to.be.revertedWith(
        "AuditLog: entry does not exist"
      );
    });
  });

  describe("getEntries", function () {
    async function logThree(contract) {
      await contract.logEvent("LOGIN",       makeHash({ n: 1 }));
      await contract.logEvent("FILE_ACCESS", makeHash({ n: 2 }));
      await contract.logEvent("LOGOUT",      makeHash({ n: 3 }));
    }

    it("returns the full range", async function () {
      const { contract } = await loadFixture(deployFixture);
      await logThree(contract);
      const entries = await contract.getEntries(1, 3);
      expect(entries.length).to.equal(3);
      expect(entries[0].eventType).to.equal("LOGIN");
      expect(entries[2].eventType).to.equal("LOGOUT");
    });

    it("returns a partial range", async function () {
      const { contract } = await loadFixture(deployFixture);
      await logThree(contract);
      const entries = await contract.getEntries(2, 3);
      expect(entries.length).to.equal(2);
      expect(entries[0].eventType).to.equal("FILE_ACCESS");
    });

    it("reverts when 'to' exceeds total entries", async function () {
      const { contract } = await loadFixture(deployFixture);
      await logThree(contract);
      await expect(contract.getEntries(1, 10)).to.be.revertedWith(
        "AuditLog: range exceeds total entries"
      );
    });

    it("reverts when from > to", async function () {
      const { contract } = await loadFixture(deployFixture);
      await logThree(contract);
      await expect(contract.getEntries(3, 1)).to.be.revertedWith(
        "AuditLog: invalid range"
      );
    });
  });

  describe("verifyEntry", function () {
    it("returns true for the original payload", async function () {
      const { contract } = await loadFixture(deployFixture);
      const payload = { user: "alice", action: "login" };
      await contract.logEvent("LOGIN", makeHash(payload));
      expect(await contract.verifyEntry(1, makeRaw(payload))).to.be.true;
    });

    it("returns false for a tampered payload", async function () {
      const { contract } = await loadFixture(deployFixture);
      const original = { user: "alice", action: "login" };
      const tampered = { user: "eve",   action: "login" };
      await contract.logEvent("LOGIN", makeHash(original));
      expect(await contract.verifyEntry(1, makeRaw(tampered))).to.be.false;
    });

    it("reverts for a non-existent entry id", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.verifyEntry(42, makeRaw({ x: 1 }))
      ).to.be.revertedWith("AuditLog: entry does not exist");
    });
  });

  describe("Access Control", function () {
    it("owner can authorize a new submitter", async function () {
      const { contract, submitter } = await loadFixture(deployFixture);
      await contract.setSubmitter(submitter.address, true);
      expect(await contract.isAuthorized(submitter.address)).to.be.true;
    });

    it("authorized submitter can log events", async function () {
      const { contract, submitter } = await loadFixture(deployFixture);
      await contract.setSubmitter(submitter.address, true);
      await expect(
        contract.connect(submitter).logEvent("CONFIG_CHANGE", makeHash({ cfg: 1 }))
      ).to.not.be.reverted;
    });

    it("owner can revoke a submitter", async function () {
      const { contract, submitter } = await loadFixture(deployFixture);
      await contract.setSubmitter(submitter.address, true);
      await contract.setSubmitter(submitter.address, false);
      expect(await contract.isAuthorized(submitter.address)).to.be.false;
    });

    it("revoked submitter cannot log events", async function () {
      const { contract, submitter } = await loadFixture(deployFixture);
      await contract.setSubmitter(submitter.address, true);
      await contract.setSubmitter(submitter.address, false);
      await expect(
        contract.connect(submitter).logEvent("LOGIN", makeHash({ u: "revoked" }))
      ).to.be.revertedWith("AuditLog: caller is not authorized");
    });

    it("non-owner cannot call setSubmitter", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);
      await expect(
        contract.connect(stranger).setSubmitter(stranger.address, true)
      ).to.be.revertedWith("AuditLog: caller is not owner");
    });

    it("emits SubmitterUpdated on authorization change", async function () {
      const { contract, submitter } = await loadFixture(deployFixture);
      await expect(contract.setSubmitter(submitter.address, true))
        .to.emit(contract, "SubmitterUpdated")
        .withArgs(submitter.address, true);
    });
  });
});
