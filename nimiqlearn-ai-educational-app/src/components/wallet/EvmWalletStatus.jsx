import React from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { useEvmWallet } from "../../hooks/useEvmWallet.js";
import { EVM_STATUS } from "../../services/evmWalletService.js";

function truncateAddress(address) {
  if (!address) return null;
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/**
 * EVM wallet connection status card — mirrors NimiqWalletStatus.jsx, for
 * the separate window.ethereum provider USDT payments use. Independent
 * connection state: a learner can have Nimiq Pay connected without ever
 * having granted EVM account access, and vice versa.
 */
export default function EvmWalletStatus() {
  const evm = useEvmWallet();

  return (
    <Card title="Your EVM wallet (USDT)" sub="A separate connection from your Nimiq wallet above — used only for USDT payments.">
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 16 }}>
        {evm.status === EVM_STATUS.INITIALIZING && <Badge tone="amber" dot>Connecting...</Badge>}
        {evm.status === EVM_STATUS.CONNECTED && <Badge tone="teal" dot>Wallet connected</Badge>}
        {evm.status === EVM_STATUS.EVM_AVAILABLE && <Badge tone="slate" dot>Ethereum provider detected</Badge>}
        {evm.status === EVM_STATUS.ERROR && <Badge tone="rose" dot>Connection failed</Badge>}
        {evm.status === EVM_STATUS.BROWSER_MODE && <Badge tone="amber" dot>Not available</Badge>}
      </div>

      {evm.status === EVM_STATUS.BROWSER_MODE && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🧪</span>
          <span>Open NimiqLearn in Nimiq Pay to connect an EVM wallet for USDT payments.</span>
        </div>
      )}

      {evm.status === EVM_STATUS.EVM_AVAILABLE && evm.error === "Connection cancelled" && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">🚫</span>
          <span>Connection cancelled. Nothing was shared, and no account was connected.</span>
        </div>
      )}

      {evm.status === EVM_STATUS.ERROR && (
        <div className="notice danger" style={{ marginBottom: 16 }}>
          <span aria-hidden="true">⚠️</span>
          <span>{evm.error || "Connection failed."}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <Row label="Ethereum provider detected" value={evm.isUnavailable ? "NO" : "YES"} />
        <Row label="Wallet connected" value={evm.isConnected ? "YES" : "NO"} />
        <Row
          label="Address"
          value={evm.address ? truncateAddress(evm.address) : evm.isConnected ? "—" : "Not connected"}
          mono
        />
        <Row label="Active chain ID" value={evm.chainId || "—"} mono />
      </div>

      <div className="flex gap-8 wrap">
        {evm.status === EVM_STATUS.EVM_AVAILABLE && (
          <Button variant="nimiq" onClick={evm.connect}>Connect EVM wallet</Button>
        )}
        {evm.status === EVM_STATUS.INITIALIZING && (
          <Button variant="nimiq" disabled loading>Connecting...</Button>
        )}
        {evm.status === EVM_STATUS.ERROR && (
          <Button variant="outline" onClick={evm.connect}>Retry</Button>
        )}
        {evm.status === EVM_STATUS.CONNECTED && (
          <Button variant="outline" onClick={evm.disconnect}>Disconnect</Button>
        )}
      </div>
      {evm.status === EVM_STATUS.CONNECTED && (
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>
          Disconnecting only clears this app's local state — revoke NimiqLearn's access from within Nimiq Pay itself to fully disconnect.
        </p>
      )}
    </Card>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-12 items-center">
      <span className="muted small">{label}</span>
      <span
        className="small strong"
        style={mono ? { fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
