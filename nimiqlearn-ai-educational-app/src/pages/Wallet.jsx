import React from "react";
import { useNimiq } from "../hooks/useNimiq.js";
import { useLearner } from "../hooks/useLearner.js";
import WalletStatus from "../components/payments/WalletStatus.jsx";
import PaymentHistory from "../components/payments/PaymentHistory.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
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
        {nimiq.mode === "miniapp" ? (
          <Badge tone="teal" dot>Real Mini App mode</Badge>
        ) : (
          <Badge tone="amber" dot>DEMO MODE</Badge>
        )}
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <WalletStatus />

          <Card title="Supported assets" sub="Detected from the current environment — never hard-coded to an unsupported chain.">
            <div style={{ display: "grid", gap: 10 }}>
              {assets.map((a) => (
                <div key={a.asset} className="flex items-center justify-between pill" style={{ cursor: "default" }}>
                  <span className="flex items-center gap-10">
                    <span className="strong">{a.asset}</span>
                    <span className="tiny muted">{a.network}</span>
                  </span>
                  {a.real ? <Badge tone="teal">Real support</Badge> : <Badge tone="slate">When supported</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <PaymentHistory unlockedPacks={learner.unlockedPacks} />

          <Card title="How to run as a real Mini App">
            <div style={{ display: "grid", gap: 10 }}>
              <p className="small muted" style={{ margin: 0 }}>
                <strong>1.</strong> Deploy this app to an HTTPS URL and open it inside <strong>Nimiq Pay</strong> via{" "}
                <code>nimiqpay://miniapp?url=your-app.com</code> or{" "}
                <code>https://nimpay.app/miniapps/open/your-app.com</code>.
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
