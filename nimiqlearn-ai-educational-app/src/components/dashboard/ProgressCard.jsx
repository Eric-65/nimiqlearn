import React from "react";
import Card from "../ui/Card.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import { STATUS_META } from "../../services/knowledgeService.js";

export default function ProgressCard({ knowledge, averageMastery }) {
  const statuses = ["LEARNING", "DEVELOPING", "STRONG", "MASTERED"];
  const counts = statuses.map((s) => knowledge.filter((k) => k.status === s).length);

  return (
    <Card title="Your learning state" sub="Application-calculated from your activity — updated after every interaction.">
      <div style={{ marginBottom: 18 }}>
        <ProgressBar value={averageMastery} label="Average mastery" tone="gold" ariaLabel="Average mastery" />
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {statuses.map((s, i) => (
          <div key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-8 small">
              <span className="status-dot" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
              {STATUS_META[s].label}
            </span>
            <span className="strong small">{counts[i]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
