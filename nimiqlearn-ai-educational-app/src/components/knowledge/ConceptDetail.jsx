import React from "react";
import Modal from "../ui/Modal.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import {
  STAGE_LABEL_KEYS,
  STAGE_COLORS,
  deriveMasteryStage,
  nextEvidenceNeeded,
  evidenceFor,
} from "../../services/masteryService.js";
import { findTopicPath } from "../../data/mockTopics.js";
import { useI18n } from "../../hooks/useI18n.js";

/* Relative dates take t/tPlural rather than returning English: "3 days ago"
   is a sentence, and every language builds it differently. */
function formatDate(ts, t, tPlural) {
  if (!ts) return t("date.never");
  const days = Math.round((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days <= 0) return t("date.today");
  if (days === 1) return t("date.yesterday");
  return tPlural("date.daysAgo", days);
}

function formatFutureDate(ts, t, tPlural) {
  if (!ts) return t("date.notScheduled");
  const days = Math.round((ts - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return t("date.dueNow");
  if (days === 1) return t("date.tomorrow");
  return tPlural("date.inDays", days);
}

/**
 * Tap-to-inspect panel for a single Knowledge Map node (see PROMPT 8,
 * "Knowledge Map interaction"). Shows the canonical learner-state fields
 * for this concept and offers the four standard next steps — it does not
 * duplicate learner state, only reads it.
 */
export default function ConceptDetail({ topic, entry, onClose, onNavigate }) {
  const { t, tOr, tPlural } = useI18n();
  if (!topic) return null;
  const path = findTopicPath(topic.id);
  const stage = entry?.masteryStage || deriveMasteryStage(entry || {});
  const recent = entry?.recentPerformance || [];
  const needed = nextEvidenceNeeded(entry || {});
  /* The three demonstrations, and whether this concept has each. Read
     straight off the ledger rather than inferred from the stage, so the
     panel can show a concept that explained but never recalled — which
     happens, and which a stage alone would hide. */
  const LADDER = ["RECALL", "EXPLAIN", "APPLY"];
  const shown = LADDER.map((kind) => ({ kind, proof: evidenceFor(entry || {}, kind) }));
  const misconception = entry?.misconceptions?.[0] || null;

  return (
    <Modal open={!!topic} onClose={onClose} labelledBy="concept-detail-title" maxWidth={480}>
      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 4 }}>
        <span className="tiny muted">{path.map((p) => tOr(`topic.${p.id}.name`, p.name)).join(" • ")}</span>
        <button onClick={onClose} aria-label={t("common.close")} style={{ background: "none", border: "none", color: "var(--c-text-faint)", cursor: "pointer", fontSize: 15 }}>✕</button>
      </div>
      <h2 id="concept-detail-title" style={{ margin: "0 0 10px", fontSize: 22 }}>{tOr(`topic.${topic.id}.name`, topic.name)}</h2>
      <div className="flex items-center gap-8 wrap">
        <span className="status-dot" style={{ background: STAGE_COLORS[stage] }} aria-hidden="true" />
        <Badge tone={stage === "MASTERED" ? "gold" : stage === "CAN_APPLY" || stage === "CAN_EXPLAIN" ? "teal" : stage === "CAN_RECALL" ? "blue" : stage === "LEARNING" ? "amber" : "slate"}>
          {t(STAGE_LABEL_KEYS[stage] || STAGE_LABEL_KEYS.NEW)}
        </Badge>
      </div>

      {/* WHAT THIS IS BASED ON.
          A stage is a claim about somebody, so the panel shows the
          attempts behind it rather than asking to be believed. An
          unticked row is not a failure — it is simply something not yet
          demonstrated, which is also the next thing to do. */}
      <ul className="detail-evidence">
        {shown.map(({ kind, proof }) => (
          <li key={kind} className={proof.length ? "has" : ""}>
            <span aria-hidden="true">{proof.length ? "✓" : "○"}</span>
            <span>{t(`detail.evidence.${kind.toLowerCase()}`)}</span>
            {proof.length > 0 && (
              <span className="tiny muted">
                {proof.some((p) => p.inferred)
                  ? t("detail.evidence.inferred")
                  : t("detail.evidence.count", { count: proof.length })}
              </span>
            )}
          </li>
        ))}
      </ul>

      {misconception && (
        <p className="detail-misconception">
          <span aria-hidden="true">🔍</span> {t("detail.misconception", { misconception })}
        </p>
      )}

      {needed.stage && (
        <p className="detail-next">
          {t("detail.nextStep", {
            needed: t(`evidence.${String(needed.kind).toLowerCase()}`),
            stage: t(STAGE_LABEL_KEYS[needed.stage]),
          })}
        </p>
      )}

      <div className="grid grid-2" style={{ gap: 14, margin: "18px 0" }}>
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="tiny muted">{t("detail.mastery")}</span>
            <span className="small strong">{entry?.mastery ?? 0}%</span>
          </div>
          <ProgressBar value={entry?.mastery ?? 0} tone="gold" ariaLabel={t("detail.mastery")} />
        </div>
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="tiny muted" title={t("detail.confidence.title")}>{t("detail.confidence")}</span>
            <span className="small strong">{entry?.confidence ?? 0}%</span>
          </div>
          <ProgressBar value={entry?.confidence ?? 0} tone="teal" ariaLabel={t("detail.confidence")} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        <div className="flex items-center justify-between">
          <span className="tiny muted">{t("detail.recent")}</span>
          <span className="flex gap-4" aria-label={t("detail.recent.aria", { correct: recent.filter((r) => r === 1).length, total: recent.length })}>
            {recent.length ? recent.map((r, i) => (
              <span key={i} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: r === 1 ? "var(--c-teal)" : "var(--c-rose)" }} />
            )) : <span className="tiny muted">{t("detail.noAttempts")}</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">{t("profile.lastStudied")}</span>
          <span className="small">{formatDate(entry?.lastStudiedAt, t, tPlural)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">{t("detail.nextReview")}</span>
          <span className="small">{formatFutureDate(entry?.nextReviewAt, t, tPlural)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">{t("detail.lifetime")}</span>
          <span className="small">{t("detail.record", { correct: entry?.correctAttempts ?? 0, incorrect: entry?.incorrectAttempts ?? 0 })}</span>
        </div>
      </div>

      <div className="flex gap-8 wrap">
        {/* The sprint first: it is the one action that performs whatever
            demonstration this concept is missing, so it is the right
            answer for every state the panel can be in. The rest stay for
            a learner who wants to choose. */}
        <Button variant="teal" size="sm" onClick={() => onNavigate("sprint", topic.id)}>{t("detail.sprint")}</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("learn", topic.id)}>{t("nav.learn")}</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("explain", topic.id)}>{t("detail.explain")}</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("learn", topic.id)}>{t("detail.practice")}</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("review", topic.id)}>{t("detail.review")}</Button>
      </div>
    </Modal>
  );
}
