import React, { useState } from "react";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { LEARNING_PACKS } from "../data/mockLearningPacks.js";
import LearningPaymentModal from "../components/payments/LearningPaymentModal.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { PAYMENTS_ENABLED, PAYMENTS_DISABLED_REASON } from "../config/paymentConfig.js";

export default function Marketplace() {
  const { learner, unlockPack } = useLearner();
  const nimiq = useNimiq();
  const [selectedPack, setSelectedPack] = useState(null);
  const [notice, setNotice] = useState(null);

  const unlocked = (productId) => (learner.unlockedPacks || []).some((p) => p.productId === productId);
  const unlockedEntry = (productId) => (learner.unlockedPacks || []).find((p) => p.productId === productId);

  const handleSuccess = (result) => {
    unlockPack({
      productId: selectedPack.id,
      purchaserAddress: result.purchaserAddress || null,
      transactionHash: result.transactionHash,
      simulated: result.simulated,
    });
    setNotice({
      kind: result.simulated ? "warn" : "success",
      text: result.simulated
        ? `${selectedPack.title} unlocked in DEMO MODE (simulated payment).`
        : `${selectedPack.title} unlocked — payment confirmed via Nimiq Pay.`,
    });
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Learning Economy</h1>
          <p className="page-sub">Courses and learning paths from independent educators. Unlock them directly with NIM through Nimiq Pay — creators receive payments instantly.</p>
        </div>
        {nimiq.isConnected ? (
          <Badge tone="teal" dot>Live Nimiq Pay</Badge>
        ) : (
          <Badge tone="amber" dot>DEMO MODE — payments simulated</Badge>
        )}
      </header>

      {!PAYMENTS_ENABLED && (
        <div className="notice danger anim-pop" style={{ marginBottom: 22 }} role="status">
          <span aria-hidden="true">⚠️</span>
          <span>{PAYMENTS_DISABLED_REASON}</span>
        </div>
      )}

      {notice && (
        <div className={`notice ${notice.kind} anim-pop`} style={{ marginBottom: 22 }} role="status">
          <span aria-hidden="true">{notice.kind === "success" ? "🎉" : "🧪"}</span>
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-3" style={{ alignItems: "stretch" }}>
        {LEARNING_PACKS.map((pack) => {
          const isUnlocked = unlocked(pack.id);
          const entry = unlockedEntry(pack.id);
          return (
            <Card key={pack.id} hover className="flex-col" style={{ display: "flex", flexDirection: "column" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 34 }} aria-hidden="true">{pack.emoji}</span>
                <div className="flex items-center gap-6">
                  {pack.popular && <Badge tone="gold">Popular</Badge>}
                  {isUnlocked && <Badge tone={entry?.simulated ? "amber" : "teal"}>{entry?.simulated ? "Unlocked (sim.)" : "Unlocked"}</Badge>}
                </div>
              </div>

              <Badge tone="blue">{pack.category}</Badge>
              <h3 style={{ fontSize: 17, margin: "8px 0 2px" }}>{pack.title}</h3>
              <p className="tiny muted" style={{ margin: "0 0 8px" }}>
                by {pack.creator} · {pack.duration} · {pack.difficulty}
              </p>
              <p className="small muted" style={{ flex: 1, margin: "0 0 12px", lineHeight: 1.6 }}>{pack.description}</p>

              <p className="small strong" style={{ margin: "0 0 6px", color: "var(--c-text-dim)", fontSize: 12.5 }}>You'll be able to</p>
              <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0, display: "grid", gap: 5 }}>
                {pack.outcomes.map((o) => (
                  <li key={o} className="small" style={{ color: "var(--c-text-dim)" }}>
                    <span style={{ color: "var(--c-teal)" }} aria-hidden="true">✓</span> {o}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between" style={{ marginTop: "auto", borderTop: "1px solid var(--c-border)", paddingTop: 12 }}>
                <div>
                  <span className="strong" style={{ fontSize: 18 }}>{pack.price} {pack.asset}</span>
                  <span className="tiny muted" style={{ display: "block" }}>one-time unlock</span>
                </div>
                <Button
                  variant={isUnlocked ? "ghost" : "nimiq"}
                  size="sm"
                  disabled={isUnlocked}
                  onClick={() => setSelectedPack(pack)}
                >
                  {isUnlocked ? "Unlocked ✓" : "Unlock pack"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="notice info" style={{ marginTop: 24 }}>
        <span aria-hidden="true">🛡️</span>
        <span>
          <strong>Unlocks go through Nimiq Pay's native confirmation.</strong> Your keys never leave the wallet. NIM is supported on every pack; USDT is available on packs that list a USDT price, over Nimiq Pay's Ethereum provider. Wallet and payment services are fully separated from the AI — the model never sees your address.
        </span>
      </div>

      <LearningPaymentModal
        pack={selectedPack}
        open={!!selectedPack}
        onClose={() => setSelectedPack(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
