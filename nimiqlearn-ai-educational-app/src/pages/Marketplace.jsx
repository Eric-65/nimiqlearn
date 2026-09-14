import React, { useState } from "react";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { LEARNING_PACKS } from "../data/mockLearningPacks.js";
import LearningPaymentModal from "../components/payments/LearningPaymentModal.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { useI18n } from "../hooks/useI18n.js";
import Button from "../components/ui/Button.jsx";
import { PAYMENTS_ENABLED, PAYMENTS_DISABLED_REASON_KEY } from "../config/paymentConfig.js";

export default function Marketplace() {
  const { learner, unlockPack } = useLearner();
  const nimiq = useNimiq();
  const { t, tOr } = useI18n();
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
    /* Key + vars: the notice is built here but rendered below, so it is
       translated at render time and follows a mid-session language switch. */
    setNotice({
      kind: result.simulated ? "warn" : "success",
      key: result.simulated ? "market.unlocked.sim" : "market.unlocked",
      vars: { title: tOr(`pack.${selectedPack.id}.title`, selectedPack.title) },
    });
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("market.title")}</h1>
          <p className="page-sub">{t("market.sub")}</p>
        </div>
        {nimiq.isConnected ? (
          <Badge tone="teal" dot>{t("market.live")}</Badge>
        ) : (
          <Badge tone="amber" dot>{t("market.demoBadge")}</Badge>
        )}
      </header>

      {!PAYMENTS_ENABLED && (
        <div className="notice danger anim-pop" style={{ marginBottom: 22 }} role="status">
          <span aria-hidden="true">⚠️</span>
          <span>{t(PAYMENTS_DISABLED_REASON_KEY)}</span>
        </div>
      )}

      {notice && (
        <div className={`notice ${notice.kind} anim-pop`} style={{ marginBottom: 22 }} role="status">
          <span aria-hidden="true">{notice.kind === "success" ? "🎉" : "🧪"}</span>
          <span>{t(notice.key, notice.vars)}</span>
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
                  {pack.popular && <Badge tone="gold">{t("market.popular")}</Badge>}
                  {isUnlocked && (
                    <Badge tone={entry?.simulated ? "amber" : "teal"}>
                      {t(entry?.simulated ? "market.unlockedSim" : "market.unlockedBadge")}
                    </Badge>
                  )}
                </div>
              </div>

              <Badge tone="blue">{tOr(`pack.${pack.id}.category`, pack.category)}</Badge>
              <h3 style={{ fontSize: 17, margin: "8px 0 2px" }}>{tOr(`pack.${pack.id}.title`, pack.title)}</h3>
              {/* The creator's name is a person's name and stays as written;
                  only the words around it translate. */}
              <p className="tiny muted" style={{ margin: "0 0 8px" }}>
                {t("market.by", { creator: pack.creator })} · {tOr(`pack.${pack.id}.duration`, pack.duration)} ·{" "}
                {tOr(`pack.${pack.id}.difficulty`, pack.difficulty)}
              </p>
              <p className="small muted" style={{ flex: 1, margin: "0 0 12px", lineHeight: 1.6 }}>
                {tOr(`pack.${pack.id}.description`, pack.description)}
              </p>

              <p className="small strong" style={{ margin: "0 0 6px", color: "var(--c-text-dim)", fontSize: 12.5 }}>
                {t("market.outcomes")}
              </p>
              <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0, display: "grid", gap: 5 }}>
                {pack.outcomes.map((o, i) => (
                  <li key={o} className="small" style={{ color: "var(--c-text-dim)" }}>
                    <span style={{ color: "var(--c-teal)" }} aria-hidden="true">✓</span>{" "}
                    {tOr(`pack.${pack.id}.outcome${i}`, o)}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between" style={{ marginTop: "auto", borderTop: "1px solid var(--c-border)", paddingTop: 12 }}>
                <div>
                  <span className="strong" style={{ fontSize: 18 }}>{pack.price} {pack.asset}</span>
                  <span className="tiny muted" style={{ display: "block" }}>{t("market.oneTime")}</span>
                </div>
                <Button
                  variant={isUnlocked ? "ghost" : "nimiq"}
                  size="sm"
                  disabled={isUnlocked}
                  onClick={() => setSelectedPack(pack)}
                >
                  {t(isUnlocked ? "market.unlockedCheck" : "market.unlock")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="notice info" style={{ marginTop: 24 }}>
        <span aria-hidden="true">🛡️</span>
        <span>
          <strong>{t("market.safety.title")}</strong> {t("market.safety.body")}
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
