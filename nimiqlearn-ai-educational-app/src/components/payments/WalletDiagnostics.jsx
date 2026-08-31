import React, { useEffect, useState } from "react";
import { useNimiq } from "../../hooks/useNimiq.js";
import { WALLET_STATUS, ENVIRONMENT, isNimiqPayAvailable, getUsdtSupportStatus } from "../../services/nimiqWalletService.js";
import Button from "../ui/Button.jsx";

const FLAG = "nimiqlearn:wallet-diagnostics";

function enabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV !== true) return false;
  let flag = "0";
  try {
    flag = localStorage.getItem(FLAG) || "0";
  } catch {
    /* storage may be unavailable (sandboxed) — default off */
  }
  return flag === "1" || window.location.hash.includes("wallet-diagnostics");
}

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between gap-12" style={{ padding: "5px 0", borderBottom: "1px solid var(--c-border)" }}>
      <span className="tiny muted">{label}</span>
      <span className="tiny strong" style={{ color: tone || "var(--c-text)", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

function truncate(address) {
  if (!address) return "—";
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/**
 * DEVELOPMENT-ONLY diagnostics panel for the wallet/payment layer.
 * Visible only in dev builds with the flag `nimiqlearn:wallet-diagnostics=1`
 * or the `#wallet-diagnostics` hash. Never ships to normal learners.
 *
 * Shows connection facts only — never a private key, seed phrase, or
 * signature. `nimiq.auth` only ever holds { address, authenticatedAt,
 * expiresAt }, so surfacing it here is safe by construction.
 */
export default function WalletDiagnostics() {
  const nimiq = useNimiq();
  const [show, setShow] = useState(enabled());
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      try {
        localStorage.setItem(FLAG, show ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }, [show]);

  useEffect(() => {
    if (nimiq.error) setLastError(nimiq.error);
  }, [nimiq.error]);

  if (import.meta.env.DEV !== true) return null;

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        style={{
          position: "fixed",
          left: 12,
          bottom: 78,
          zIndex: 90,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px dashed var(--c-border-strong)",
          background: "rgba(10,15,30,0.9)",
          color: "var(--c-text-faint)",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        ⚙ Wallet Diagnostics
      </button>
    );
  }

  const environmentLabel =
    nimiq.environment === ENVIRONMENT.NIMIQ_PAY_AVAILABLE
      ? "NIMIQ_PAY_AVAILABLE"
      : nimiq.environment === ENVIRONMENT.BROWSER_MODE
      ? "BROWSER_MODE"
      : "UNSUPPORTED";

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 95,
        width: "min(380px, calc(100vw - 24px))",
        maxHeight: "70vh",
        overflowY: "auto",
        background: "#0a0f1e",
        border: "1px solid var(--c-border-strong)",
        borderRadius: 14,
        boxShadow: "var(--shadow-lg)",
        padding: 14,
      }}
      aria-label="Wallet diagnostics (development)"
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="small strong" style={{ color: "var(--c-gold)" }}>⚙ Wallet Diagnostics (dev)</span>
        <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "var(--c-text-faint)", cursor: "pointer", fontSize: 13 }} aria-label="Close diagnostics">
          ✕
        </button>
      </div>

      <Row label="Nimiq Pay detected" value={isNimiqPayAvailable() ? "YES" : "NO"} tone={isNimiqPayAvailable() ? "var(--c-teal)" : "var(--c-gold)"} />
      <Row label="Environment" value={environmentLabel} />
      <Row
        label="Connection status"
        value={nimiq.status.toUpperCase()}
        tone={nimiq.status === WALLET_STATUS.CONNECTED ? "var(--c-teal)" : nimiq.status === WALLET_STATUS.ERROR ? "var(--c-rose)" : "var(--c-gold)"}
      />
      <Row label="Address" value={truncate(nimiq.address)} />
      <Row label="Network" value={nimiq.network || "—"} />
      <Row label="Consensus" value={nimiq.consensus === null ? "—" : nimiq.consensus ? "ESTABLISHED" : "SYNCING"} />
      <Row label="Block height" value={nimiq.blockNumber ?? "—"} />
      <Row label="Host language" value={nimiq.language || "—"} />
      <Row label="NIM balance query" value="NOT SUPPORTED BY SDK" tone="var(--c-gold)" />
      <Row label="USDT support" value={getUsdtSupportStatus()} tone="var(--c-gold)" />
      <Row label="Payment provider" value="Nimiq Pay (native sendBasicTransaction)" />
      <Row label="Signed in (auth)" value={nimiq.auth ? "YES" : "NO"} tone={nimiq.auth ? "var(--c-teal)" : undefined} />
      {nimiq.auth && (
        <>
          <Row label="Auth address" value={truncate(nimiq.auth.address)} />
          <Row label="Auth expires" value={new Date(nimiq.auth.expiresAt).toLocaleTimeString()} />
        </>
      )}
      {lastError && <Row label="Last error" value={lastError} tone="var(--c-rose)" />}

      <div className="flex gap-8 wrap" style={{ marginTop: 12 }}>
        <Button variant="outline" size="sm" onClick={nimiq.connect}>Connect</Button>
        <Button variant="outline" size="sm" onClick={nimiq.disconnect}>Disconnect</Button>
      </div>
    </div>
  );
}
