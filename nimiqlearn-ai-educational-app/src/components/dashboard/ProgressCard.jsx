import React from "react";
import Card from "../ui/Card.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import { STATUS_META } from "../../services/knowledgeService.js";
import { useI18n } from "../../hooks/useI18n.js";

export default function ProgressCard({ knowledge, averageMastery }) {
  const { t } = useI18n();
  const statuses = ["LEARNING", "DEVELOPING", "STRONG", "MASTERED"];
  const counts = statuses.map((s) => knowledge.filter((k) => k.status === s).length);

  return (
    <Card title={t("progress.title")} sub={t("progress.sub")}>
      <div style={{ marginBottom: 18 }}>
        <ProgressBar value={averageMastery} label={t("knowledge.avgMastery")} tone="gold" ariaLabel={t("knowledge.avgMastery")} />
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {statuses.map((s, i) => (
          <div key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-8 small">
              <span className="status-dot" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
              {t(`status.${s.toLowerCase()}`)}
            </span>
            <span className="strong small">{counts[i]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
