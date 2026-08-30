import React from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import { LEARNING_PACKS } from "../../data/mockLearningPacks.js";

export default function PaymentHistory({ unlockedPacks }) {
  const items = (unlockedPacks || [])
    .map((u) => ({ ...u, pack: LEARNING_PACKS.find((p) => p.id === u.packId) }))
    .filter((u) => u.pack)
    .sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0));

  return (
    <Card title="Your unlocks" sub="Purchases you've made through the Learning Economy.">
      {items.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          No packs unlocked yet. Browse the marketplace to get started.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((u) => (
            <div key={u.packId} className="flex items-center justify-between gap-12 pill" style={{ cursor: "default" }}>
              <span className="flex items-center gap-10">
                <span style={{ fontSize: 20 }} aria-hidden="true">{u.pack.emoji}</span>
                <span>
                  <span className="strong" style={{ display: "block", fontSize: 14 }}>{u.pack.title}</span>
                  <span className="tiny muted">{u.pack.price} {u.pack.asset} • {new Date(u.unlockedAt).toLocaleDateString()}</span>
                </span>
              </span>
              {u.simulated ? <Badge tone="amber">Simulated</Badge> : <Badge tone="teal">Confirmed</Badge>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
