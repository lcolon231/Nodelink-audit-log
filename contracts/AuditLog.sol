// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditLog
 * @author NodeLink Technologies
 * @notice Tamper-proof security event logger for SMB compliance.
 *         Each log entry stores a keccak256 hash of the event data on-chain.
 *         Any attempt to modify an entry off-chain will produce a hash mismatch,
 *         providing cryptographic proof of tampering.
 */
contract AuditLog {

    // ─── Structs ────────────────────────────────────────────────────────────

    struct LogEntry {
        uint256 id;
        string  eventType;
        bytes32 dataHash;
        address submitter;
        uint256 timestamp;
        bool    exists;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;
    uint256 private entryCount;
    mapping(uint256 => LogEntry) private entries;
    mapping(address => bool) private authorizedSubmitters;

    // ─── Events ──────────────────────────────────────────────────────────────

    event EntryLogged(
        uint256 indexed id,
        string          eventType,
        bytes32 indexed dataHash,
        address indexed submitter,
        uint256         timestamp
    );

    event SubmitterUpdated(address indexed account, bool authorized);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditLog: caller is not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedSubmitters[msg.sender],
            "AuditLog: caller is not authorized"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizedSubmitters[msg.sender] = true;
    }

    // ─── Write Functions ─────────────────────────────────────────────────────

    function logEvent(
        string  calldata eventType,
        bytes32          dataHash
    ) external onlyAuthorized returns (uint256 id) {
        require(bytes(eventType).length > 0, "AuditLog: eventType cannot be empty");
        require(dataHash != bytes32(0),       "AuditLog: dataHash cannot be zero");

        entryCount++;
        id = entryCount;

        entries[id] = LogEntry({
            id:        id,
            eventType: eventType,
            dataHash:  dataHash,
            submitter: msg.sender,
            timestamp: block.timestamp,
            exists:    true
        });

        emit EntryLogged(id, eventType, dataHash, msg.sender, block.timestamp);
    }

    // ─── Read Functions ───────────────────────────────────────────────────────

    function getEntry(uint256 id) external view returns (LogEntry memory) {
        require(entries[id].exists, "AuditLog: entry does not exist");
        return entries[id];
    }

    function getEntries(
        uint256 from,
        uint256 to
    ) external view returns (LogEntry[] memory) {
        require(from >= 1 && from <= to,    "AuditLog: invalid range");
        require(to   <= entryCount,         "AuditLog: range exceeds total entries");

        uint256 size = to - from + 1;
        LogEntry[] memory result = new LogEntry[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = entries[from + i];
        }

        return result;
    }

    function getTotalEntries() external view returns (uint256) {
        return entryCount;
    }

    // ─── Verification ─────────────────────────────────────────────────────────

    function verifyEntry(
        uint256 id,
        bytes   calldata rawPayload
    ) external view returns (bool isValid) {
        require(entries[id].exists, "AuditLog: entry does not exist");

        bytes32 computedHash = keccak256(rawPayload);
        isValid = (computedHash == entries[id].dataHash);
    }

    // ─── Access Control ───────────────────────────────────────────────────────

    function setSubmitter(address account, bool authorized) external onlyOwner {
        require(account != address(0), "AuditLog: zero address");
        authorizedSubmitters[account] = authorized;
        emit SubmitterUpdated(account, authorized);
    }

    function isAuthorized(address account) external view returns (bool) {
        return account == owner || authorizedSubmitters[account];
    }
}