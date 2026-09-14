import React from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import { LEARNING_PACKS } from "../../data/mockLearningPacks.js";
import { useI18n } from "../../hooks/useI18n.js";

export default function PaymentHistory({ unlockedPacks }) {
  const { t, tOr, locale } = useI18n();
  const items = (unlockedPacks || [])
    .map((u) => ({ ...u, pack: LEARNING_PACKS.find((p) => p.id === u.productId) }))
    .filter((u) => u.pack)
    .sort((a, b) => (b.purchasedAt || 0) - (a.purchasedAt || 0));

  return (
    <Card title={t("history.title")} sub={t("history.sub")}>
      {items.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          {t("history.empty")}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((u) => (
            <div key={u.productId} className="flex items-center justify-between gap-12 pill" style={{ cursor: "default" }}>
              <span className="flex items-center gap-10">
                <span style={{ fontSize: 20 }} aria-hidden="true">{u.pack.emoji}</span>
                <span>
                  <span className="strong" style={{ display: "block", fontSize: 14 }}>
                    {tOr(`pack.${u.pack.id}.title`, u.pack.title)}
                  </span>
                  {/* Locale-aware, not browser-aware — see Profile.jsx. */}
                  <span className="tiny muted">
                    {u.pack.price} {u.pack.asset} • {new Date(u.purchasedAt).toLocaleDateString(locale)}
                  </span>
                </span>
              </span>
              {u.simulated ? <Badge tone="amber">{t("profile.simulated")}</Badge> : <Badge tone="teal">{t("history.confirmed")}</Badge>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
