import { useState, useEffect, useCallback } from "react";

const EVENT_TYPES = ["LOGIN", "LOGOUT", "FILE_ACCESS", "CONFIG_CHANGE", "ALERT", "PERMISSION_CHANGE"];

export default function App() {
  const [wallet, setWallet]   = useState(null);
  const [entries, setEntries] = useState([]);
  const [fetching, setFetching] = useState(false);

  // Log form
  const [eventType, setEventType] = useState("LOGIN");
  const [payload,   setPayload]   = useState('{"user":"alice","ip":"192.168.1.1"}');
  const [submitting, setSubmitting] = useState(false);
  const [logStatus,  setLogStatus]  = useState(null);

  // Verify form
  const [verifyId,      setVerifyId]      = useState("");
  const [verifyPayload, setVerifyPayload] = useState("");
  const [verifyResult,  setVerifyResult]  = useState(null);

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      const res  = await fetch("/api/logs");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install the MetaMask browser extension.");
      return;
    }
    try {
      const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(account);
    } catch (err) {
      console.error("Wallet connection rejected:", err);
    }
  }

  async function submitLog(e) {
    e.preventDefault();
    setLogStatus(null);
    setSubmitting(true);
    try {
      let parsed;
      try { parsed = JSON.parse(payload); }
      catch { setLogStatus({ ok: false, msg: "Payload must be valid JSON." }); return; }

      const res  = await fetch("/api/logs", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ eventType, payload: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        setLogStatus({ ok: true, msg: `Logged! Tx: ${data.txHash}` });
        fetchEntries();
      } else {
        setLogStatus({ ok: false, msg: data.error || "Unknown error" });
      }
    } catch (err) {
      setLogStatus({ ok: false, msg: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyEntry(e) {
    e.preventDefault();
    setVerifyResult(null);
    try {
      let parsed;
      try { parsed = JSON.parse(verifyPayload); }
      catch { setVerifyResult({ isValid: false, status: "Payload must be valid JSON." }); return; }

      const res  = await fetch("/api/logs/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: Number(verifyId), payload: parsed }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ isValid: false, status: `Error: ${err.message}` });
    }
  }

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div>
            <h1>NodeLink Audit Log</h1>
            <span className="subtitle">Tamper-proof event logging on Ethereum Sepolia</span>
          </div>
          <button className="wallet-btn" onClick={connectWallet}>
            {wallet
              ? <><span className="dot green" />{wallet.slice(0, 6)}…{wallet.slice(-4)}</>
              : "Connect MetaMask"}
          </button>
        </div>
      </header>

      <main>
        {/* ── Log an Event ───────────────────────────────────────── */}
        <section className="card">
          <h2>Log an Event</h2>
          <form onSubmit={submitLog} className="form">
            <label>Event Type
              <select value={eventType} onChange={e => setEventType(e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Payload <span className="hint">(JSON)</span>
              <textarea
                rows={3}
                value={payload}
                onChange={e => setPayload(e.target.value)}
                spellCheck={false}
              />
            </label>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? "Submitting to chain…" : "Submit to Blockchain"}
            </button>
          </form>
          {logStatus && (
            <div className={`status-msg ${logStatus.ok ? "ok" : "err"}`}>
              {logStatus.msg}
            </div>
          )}
        </section>

        {/* ── Audit Log Table ─────────────────────────────────────── */}
        <section className="card">
          <div className="section-head">
            <h2>Audit Log <span className="count">{entries.length} entries</span></h2>
            <button className="secondary" onClick={fetchEntries} disabled={fetching}>
              {fetching ? "Loading…" : "Refresh"}
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="empty">No entries yet — submit your first event above.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Data Hash</th>
                    <th>Submitter</th>
                    <th>Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td><span className="badge">{e.eventType}</span></td>
                      <td className="mono" title={e.dataHash}>{e.dataHash.slice(0, 14)}…</td>
                      <td className="mono" title={e.submitter}>{e.submitter.slice(0, 10)}…</td>
                      <td>{new Date(e.timestamp).toUTCString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Verify Entry ────────────────────────────────────────── */}
        <section className="card">
          <h2>Verify Entry</h2>
          <p className="hint">Paste the original payload to cryptographically verify it hasn't been tampered with.</p>
          <form onSubmit={verifyEntry} className="form">
            <label>Entry ID
              <input
                type="number"
                min="1"
                value={verifyId}
                onChange={e => setVerifyId(e.target.value)}
                placeholder="e.g. 1"
                required
              />
            </label>
            <label>Original Payload <span className="hint">(JSON)</span>
              <textarea
                rows={3}
                value={verifyPayload}
                onChange={e => setVerifyPayload(e.target.value)}
                placeholder='{"user":"alice","ip":"192.168.1.1"}'
                spellCheck={false}
                required
              />
            </label>
            <button type="submit" className="primary">Verify on Chain</button>
          </form>
          {verifyResult && (
            <div className={`verify-result ${verifyResult.isValid ? "ok" : "err"}`}>
              {verifyResult.isValid
                ? "VERIFIED — Entry is authentic. Hash matches on-chain record."
                : `TAMPERED — Hash mismatch. This payload does not match the stored record.`}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>NodeLink Technologies · Thesis Prototype · Ethereum Sepolia Testnet</span>
      </footer>
    </div>
  );
}
