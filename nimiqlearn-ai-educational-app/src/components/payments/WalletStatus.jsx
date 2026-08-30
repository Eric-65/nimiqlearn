import React from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import { useNimiq } from "../../hooks/useNimiq.js";

export default function WalletStatus() {
  const nimiq = useNimiq();

  const mode = nimiq.mode;
  const detecting = mode === "detecting";

  return (
    <Card title="Nimiq Pay connection" sub="Wallet state is handled by application code — the AI never sees it.">
      <div className="flex items-center gap-8" style={{ marginBottom: 16 }}>
        {detecting ? (
          <Badge tone="amber" dot>Detecting environment…</Badge>
        ) : mode === "miniapp" ? (
          <Badge tone="teal" dot>Live Mini App mode</Badge>
        ) : (
          <Badge tone="amber" dot>DEMO MODE</Badge>
        )}
        {mode === "miniapp" && <span className="tiny muted">Real Nimiq Pay provider active</span>}
        {mode === "demo" && <span className="tiny muted">No wallet injected — payments are simulated & labelled</span>}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <Row label="Network" value={nimiq.network || "Nimiq"} />
        <Row label="Account" value={nimiq.accounts?.[0] ? `${nimiq.accounts[0].slice(0, 14)}…` : detecting ? "Checking…" : "Demo account (not real)"} mono />
        <Row label="Consensus" value={nimiq.consensus === null ? (detecting ? "Checking…" : "—") : nimiq.consensus ? "Established" : "Syncing"} />
        <Row label="Block height" value={nimiq.blockNumber ?? (detecting ? "…" : "—")} />
        {nimiq.evmChainName && <Row label="EVM chain" value={`${nimiq.evmChainName} (${nimiq.evmChainId})`} />}
        {nimiq.language && <Row label="Pay language" value={nimiq.language} />}
      </div>

      {mode === "demo" && !detecting && (
        <div className="notice warn" style={{ marginTop: 16, marginBottom: 0 }}>
          <span aria-hidden="true">🧪</span>
          <span>
            <strong>DEMO MODE:</strong> open NimiqLearn inside <strong>Nimiq Pay</strong> to activate the real wallet provider. All wallet actions here are mocked and clearly labelled.
          </span>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-12">
      <span className="muted small">{label}</span>
      <span className="small strong" style={mono ? { fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all", textAlign: "right" } : { textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
