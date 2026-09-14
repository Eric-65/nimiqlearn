import React from "react";
import { useI18n } from "../../hooks/useI18n.js";
import Card from "../ui/Card.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";

export default function StreakCard({ learner }) {
  const { t } = useI18n();
  const levelPct = Math.min(100, Math.round((learner.xp / learner.xpToNext) * 100));
  return (
    <Card>
      <div className="flex items-center gap-16" style={{ marginBottom: 14 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            fontSize: 26,
            background: "var(--c-gold-soft)",
            border: "1px solid rgba(247,193,79,0.35)",
            flex: "none",
          }}
          aria-hidden="true"
        >
          {learner.avatarEmoji}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>{learner.name}</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Level {learner.level} • {learner.xp}/{learner.xpToNext} XP
          </p>
        </div>
      </div>

      <ProgressBar value={levelPct} ariaLabel={t("streak.levelAria", { pct: levelPct })} />

      <div className="flex justify-between" style={{ marginTop: 16 }}>
        <div>
          <div className="strong" style={{ fontSize: 20 }}>🔥 {learner.streakDays}</div>
          <div className="tiny muted">day streak</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="strong" style={{ fontSize: 20 }}>⏱ {learner.studyMinutes}</div>
          <div className="tiny muted">min studied</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="strong" style={{ fontSize: 20 }}>🪙 {learner.coins}</div>
          <div className="tiny muted">learning coins</div>
        </div>
      </div>
    </Card>
  );
}
