import React from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { STATUS_META } from "../../services/knowledgeService.js";

/**
 * A single knowledge node.
 * Emphasis: weak nodes pulse ("Fix this"), mastered nodes glow,
 * due-for-review nodes show a clock, just-updated nodes flash teal.
 */
export default function KnowledgeNode({ topic, knowledge, onSelect, index, due = false, justUpdated = false }) {
  const { t } = useI18n();
  const color = STATUS_META[knowledge?.status]?.color || "var(--st-new)";
  const isWeak = knowledge?.status === "LEARNING" || (knowledge?.status === "NEW" && !knowledge.lastEvaluatedAt);
  const isMastered = knowledge?.status === "MASTERED";

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
      aria-label={`${topic.name}, ${STATUS_META[knowledge?.status]?.label || "New"}${due ? ", due for review" : ""}. Click to study.`}
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
          {topic.name}
        </span>
        <span className="tiny muted" style={{ display: "block" }}>
          {STATUS_META[knowledge?.status]?.label || "New"} {knowledge?.mastery > 0 ? `• ${knowledge.mastery}%` : ""}
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
