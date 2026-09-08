import React from "react";
import { useNimiq } from "../hooks/useNimiq.js";
import { useLearner } from "../hooks/useLearner.js";
import NimiqWalletStatus from "../components/wallet/NimiqWalletStatus.jsx";
import EvmWalletStatus from "../components/wallet/EvmWalletStatus.jsx";
import PaymentHistory from "../components/payments/PaymentHistory.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { getSupportedAssets } from "../services/paymentService.js";

export default function Wallet() {
  const nimiq = useNimiq();
  const { learner, resetLearner } = useLearner();
  const assets = getSupportedAssets();

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Wallet & Learning Economy</h1>
          <p className="page-sub">Your connection to Nimiq Pay, the assets supported by this environment, and your unlock history.</p>
        </div>
        {nimiq.isConnected ? (
          <Badge tone="teal" dot>Connected to Nimiq Pay</Badge>
        ) : (
          <Badge tone="amber" dot>DEMO MODE</Badge>
        )}
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <NimiqWalletStatus />

          <EvmWalletStatus />

          <Card title="Supported assets" sub="Detected from the current environment — never hard-coded to an unsupported chain.">
            <div style={{ display: "grid", gap: 10 }}>
              {assets.map((a) => (
                <div key={a.asset} className="flex items-center justify-between pill" style={{ cursor: "default" }}>
                  <span className="flex items-center gap-10">
                    <span className="strong">{a.asset}</span>
                    <span className="tiny muted">{a.network}</span>
                  </span>
                  {a.real ? <Badge tone="teal">Real support</Badge> : <Badge tone="slate">Coming soon</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          {(learner.pendingPayments || []).length > 0 && (
            <Card title="Payment status needs verification" sub="A payment may have been submitted but could not be confirmed — check your Nimiq Pay transaction history before retrying.">
              <div style={{ display: "grid", gap: 8 }}>
                {learner.pendingPayments.map((p) => (
                  <div key={p.productId} className="notice warn" style={{ margin: 0 }}>
                    <span aria-hidden="true">⏳</span>
                    <span>
                      <strong>{p.productId}</strong> — attempted {new Date(p.startedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <PaymentHistory unlockedPacks={learner.unlockedPacks} />

          <Card title="How to run as a real Mini App">
            <div style={{ display: "grid", gap: 10 }}>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>1.</strong> Deploy this app to an HTTPS URL and open it inside <strong>Nimiq Pay</strong> via{" "}
                <code style={{ wordBreak: "break-all" }}>nimiqpay://miniapp?url=your-app.com</code> or{" "}
                <code style={{ wordBreak: "break-all" }}>https://nimpay.app/miniapps/open/your-app.com</code>.
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>2.</strong> The Mini App SDK <code>init()</code> resolves, real accounts load, and payments use Nimiq Pay's native confirmation dialogs.
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>3.</strong> In a normal browser the app transparently runs in <strong>DEMO MODE</strong>: the AI still works, but payments are explicit simulations labelled <code>SIM-…</code>.
              </p>
            </div>
            <div className="notice warn" style={{ margin: "16px 0 0" }}>
              <span aria-hidden="true">🔐</span>
              <span>NimiqLearn never stores seed phrases or private keys, never creates custodial wallets, and never bypasses native Nimiq Pay confirmation.</span>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Start fresh</h3>
                <p className="small muted" style={{ margin: "4px 0 0" }}>Reset learner state, knowledge map, and review queue to the demo defaults.</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => { if (confirm("Reset all learner data?")) resetLearner(); }}>
                Reset learner data
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
