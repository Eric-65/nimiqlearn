import React, { useState } from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";
import { WALLET_STATUS } from "../../services/nimiqWalletService.js";

function truncateAddress(address) {
  if (!address) return null;
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

export default function WalletStatus() {
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
    <Card title="Nimiq Pay connection" sub="Wallet state is handled by application code — the AI never sees it.">
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 16 }}>
        {nimiq.status === WALLET_STATUS.CONNECTING && <Badge tone="amber" dot>Connecting…</Badge>}
        {nimiq.status === WALLET_STATUS.CONNECTED && <Badge tone="teal" dot>Connected</Badge>}
        {nimiq.status === WALLET_STATUS.DISCONNECTED && <Badge tone="slate" dot>Disconnected</Badge>}
        {nimiq.status === WALLET_STATUS.ERROR && <Badge tone="rose" dot>Connection failed</Badge>}
        {nimiq.status === WALLET_STATUS.UNAVAILABLE && <Badge tone="amber" dot>Wallet unavailable in browser</Badge>}
      </div>

      {nimiq.status === WALLET_STATUS.UNAVAILABLE && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🧪</span>
          <span>Nimiq Pay connection available inside Nimiq Pay. Open this Mini App from Nimiq Pay to connect a real wallet — payments here run in DEMO MODE and are clearly labelled.</span>
        </div>
      )}

      {nimiq.status === WALLET_STATUS.ERROR && (
        <div className="notice danger" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">⚠️</span>
          <span>{nimiq.error || "Connection failed."}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
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
        <Row label="Network" value={nimiq.network || "—"} />
        <Row
          label="NIM balance"
          value="Not available"
          hint="This Mini App SDK does not expose a balance query — see Wallet diagnostics for why."
        />
        <Row label="Consensus" value={nimiq.consensus === null ? "—" : nimiq.consensus ? "Established" : "Syncing"} />
        <Row label="Block height" value={nimiq.blockNumber ?? "—"} />
      </div>

      <div className="flex gap-8 wrap">
        {nimiq.status === WALLET_STATUS.DISCONNECTED && (
          <Button variant="nimiq" size="sm" onClick={nimiq.connect}>Connect Nimiq Pay</Button>
        )}
        {nimiq.status === WALLET_STATUS.CONNECTING && (
          <Button variant="nimiq" size="sm" disabled loading>Connecting…</Button>
        )}
        {nimiq.status === WALLET_STATUS.ERROR && (
          <Button variant="outline" size="sm" onClick={nimiq.connect}>Retry</Button>
        )}
        {nimiq.status === WALLET_STATUS.CONNECTED && (
          <>
            <Button variant="outline" size="sm" onClick={nimiq.disconnect}>Disconnect</Button>
            {!nimiq.auth && (
              <Button variant="outline" size="sm" onClick={handleSignIn}>Sign in with Nimiq Pay</Button>
            )}
            {nimiq.auth && <Badge tone="teal">Signed in</Badge>}
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
