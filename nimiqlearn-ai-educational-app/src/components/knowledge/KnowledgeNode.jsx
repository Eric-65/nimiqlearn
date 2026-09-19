import React from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { STAGE_LABEL_KEYS, STAGE_COLORS, STAGE_RANK, deriveMasteryStage } from "../../services/masteryService.js";

/**
 * A single knowledge node.
 * Emphasis: weak nodes pulse ("Fix this"), mastered nodes glow,
 * due-for-review nodes show a clock, just-updated nodes flash teal.
 */
export default function KnowledgeNode({ topic, knowledge, onSelect, index, due = false, justUpdated = false }) {
  const { t, tOr } = useI18n();
  /* STATUS_META.label is English source text, not a translation — the
     catalogue already carries these under status.*, so read them from
     there. The aria-label was built the same way and was still English
     inside a Korean UI. */
  const name = tOr(`topic.${topic.id}.name`, topic.name);
  /* The node now reports the mastery STAGE rather than the mastery band.
     "Can explain" and "Developing" are different claims: one says what the
     learner has demonstrated, the other describes a number. The map is
     where somebody looks to answer "what do I actually know", so it has to
     answer with the demonstration. */
  const stage = knowledge?.masteryStage || deriveMasteryStage(knowledge || {});
  const stageLabel = t(STAGE_LABEL_KEYS[stage] || STAGE_LABEL_KEYS.NEW);
  const color = STAGE_COLORS[stage] || "var(--st-new)";
  /* "Fix this" is for a concept that has been attempted without landing —
     not for one nobody has opened, which is simply new. */
  const isWeak = stage === "LEARNING";
  const isMastered = stage === "MASTERED";
  const demonstrated = STAGE_RANK[stage] >= STAGE_RANK.CAN_RECALL;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(topic.id)}
      className={`knode ${isWeak ? "pulse-warning" : ""} ${justUpdated ? "updated" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        textAlign: "left",
        padding: "11px 14px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${isMastered ? "rgba(247,193,79,0.4)" : "var(--c-border)"}`,
        background: isMastered ? "rgba(247,193,79,0.07)" : "rgba(151,166,211,0.06)",
        boxShadow: isMastered ? "0 0 16px rgba(247,193,79,0.12)" : undefined,
        cursor: "pointer",
        transition: "transform var(--t-fast), border-color var(--t-fast), background var(--t-fast)",
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateX(4px)";
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.borderColor = isMastered ? "rgba(247,193,79,0.4)" : "var(--c-border)";
      }}
      aria-label={t("node.aria", { name, status: stageLabel, due: due ? t("node.aria.due") : "" })}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          background: color,
          boxShadow: `0 0 12px ${color}66`,
          flex: "none",
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span className="tiny muted" style={{ display: "block" }}>
          {stageLabel}
          {demonstrated && knowledge?.mastery > 0 ? ` • ${knowledge.mastery}%` : ""}
        </span>
      </span>
      {due && (
        <span className="badge badge-violet" style={{ flex: "none" }} title={t("node.dueTitle")}>⏳ {t("detail.review")}</span>
      )}
      {isMastered && (
        <span className="badge badge-gold" style={{ flex: "none" }} title={t("status.mastered")}>★</span>
      )}
      {isWeak && (
        <span className="badge badge-amber" style={{ flex: "none" }}>{t("node.fixThis")}</span>
      )}
    </button>
  );
}
