const { ethers } = require("ethers");

// Recursively sort object keys so that key ordering can never affect the hash.
// Arrays preserve element order (order is meaningful in arrays).
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => { acc[k] = sortKeysDeep(value[k]); return acc; }, {});
  }
  return value;
}

/**
 * Produce a deterministic keccak256 hash for an audit event.
 *
 * @param {{ event_type: string, actor: string, resource?: string, metadata?: object, timestamp: string }} event
 * @returns {string} 0x-prefixed 32-byte hex hash
 *
 * The hash is computed over the JSON representation of the event with keys
 * sorted alphabetically at every nesting level.  The same logical event will
 * always produce the same hash regardless of insertion order of JavaScript
 * object properties.
 */
function canonicalHash(event) {
  const sorted  = sortKeysDeep(event);
  const json    = JSON.stringify(sorted);
  const bytes   = ethers.toUtf8Bytes(json);
  return ethers.keccak256(bytes);
}

module.exports = { canonicalHash };
