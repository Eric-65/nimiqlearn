import React, { useState } from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";
import { NIMIQ_STATUS } from "../../services/nimiqWalletService.js";

function truncateAddress(address) {
  if (!address) return null;
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/**
 * Wallet connection status card (Part 29/30). Deliberately NOT a crypto
 * dashboard — just: Nimiq Pay detected, wallet connected, wallet
 * authenticated, network ready. Connection and authentication are shown
 * as two independent facts (Part 10): a connected account is never shown
 * as authenticated unless a real signing flow has actually succeeded.
 *
 * Copy for each state follows Part 29 exactly:
 *   NOT AVAILABLE  → "Open NimiqLearn in Nimiq Pay to connect your wallet."
 *   DISCONNECTED   → "Connect Nimiq Pay"
 *   CONNECTING     → "Connecting..."
 *   CONNECTED      → "Wallet connected"
 *   AUTHENTICATED  → "Wallet authenticated"
 *   ERROR          → "Connection failed" [Retry]
 */
export default function NimiqWalletStatus() {
  const nimiq = useNimiq();
  const [copied, setCopied] = useState(false);
  const [signInError, setSignInError] = useState(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nimiq.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — not critical */
    }
  };

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await nimiq.signIn();
    } catch (err) {
      setSignInError(err?.message || "Sign-in was rejected.");
    }
  };

  return (
    <Card title="Your Nimiq wallet" sub="Wallet state is handled by application code — the AI never sees it.">
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 16 }}>
        {nimiq.status === NIMIQ_STATUS.INITIALIZING && <Badge tone="amber" dot>Connecting...</Badge>}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && nimiq.isAuthenticated && <Badge tone="teal" dot>Wallet authenticated</Badge>}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && !nimiq.isAuthenticated && <Badge tone="teal" dot>Wallet connected</Badge>}
        {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && <Badge tone="slate" dot>Nimiq Pay detected</Badge>}
        {nimiq.status === NIMIQ_STATUS.ERROR && <Badge tone="rose" dot>Connection failed</Badge>}
        {nimiq.status === NIMIQ_STATUS.BROWSER_MODE && <Badge tone="amber" dot>Not available</Badge>}
      </div>

      {nimiq.status === NIMIQ_STATUS.BROWSER_MODE && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🧪</span>
          <span>
            Open NimiqLearn in Nimiq Pay to connect your wallet. This browser environment is useful for UI testing but
            cannot prove the real wallet flow.
          </span>
        </div>
      )}

      {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && nimiq.error === "Connection cancelled" && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🚫</span>
          <span>Connection cancelled. Nothing was shared, and no account was connected.</span>
        </div>
      )}

      {nimiq.status === NIMIQ_STATUS.ERROR && (
        <div className="notice danger" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">⚠️</span>
          <span>{nimiq.error || "Connection failed."}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <Row label="Nimiq Pay detected" value={nimiq.providerAvailable ? "YES" : "NO"} />
        <Row label="Wallet connected" value={nimiq.isConnected ? "YES" : "NO"} />
        <Row label="Wallet authenticated" value={nimiq.isAuthenticated ? "YES" : "NO"} />
        <Row
          label="Network ready"
          value={nimiq.consensusReady === null ? "—" : nimiq.consensusReady ? "Network ready" : "Waiting for network…"}
        />
        <Row
          label="Address"
          value={nimiq.address ? truncateAddress(nimiq.address) : nimiq.isConnected ? "—" : "Not connected"}
          mono
          action={nimiq.address && (
            <button className="btn btn-ghost btn-sm" onClick={handleCopy} aria-label="Copy address" style={{ marginLeft: 8 }}>
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        />
        <Row
          label="NIM balance"
          value="Balance unavailable in this Mini App provider."
          hint="See Wallet diagnostics for why — no balance query method is exposed."
        />
        <Row label="Block number" value={nimiq.blockNumber ?? "—"} />
      </div>

      <div className="flex gap-8 wrap">
        {nimiq.status === NIMIQ_STATUS.NIMIQ_PAY_AVAILABLE && (
          <Button variant="nimiq" onClick={nimiq.connect}>Connect Nimiq Pay</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.INITIALIZING && (
          <Button variant="nimiq" disabled loading>Connecting...</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.ERROR && (
          <Button variant="outline" onClick={nimiq.connect}>Retry</Button>
        )}
        {nimiq.status === NIMIQ_STATUS.CONNECTED && (
          <>
            <Button variant="outline" onClick={nimiq.disconnect}>Disconnect</Button>
            {!nimiq.isAuthenticated && (
              <Button variant="outline" onClick={handleSignIn}>Sign in with Nimiq Pay</Button>
            )}
          </>
        )}
      </div>
      {signInError && (
        <p className="tiny" style={{ color: "var(--c-rose)", marginTop: 8, marginBottom: 0 }} role="alert">{signInError}</p>
      )}
    </Card>
  );
}

function Row({ label, value, mono, hint, action }) {
  return (
    <div>
      <div className="flex justify-between gap-12 items-center">
        <span className="muted small">{label}</span>
        <span className="flex items-center" style={{ textAlign: "right" }}>
          <span className="small strong" style={mono ? { fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all" } : undefined}>
            {value}
          </span>
          {action}
        </span>
      </div>
      {hint && <p className="tiny muted" style={{ margin: "2px 0 0" }}>{hint}</p>}
    </div>
  );
}
