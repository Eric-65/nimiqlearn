import React from "react";
import Modal from "../ui/Modal.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import { STATUS_META } from "../../services/knowledgeService.js";
import { findTopicPath } from "../../data/mockTopics.js";

function formatDate(ts) {
  if (!ts) return "Never";
  const days = Math.round((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatFutureDate(ts) {
  if (!ts) return "Not scheduled";
  const days = Math.round((ts - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due now";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * Tap-to-inspect panel for a single Knowledge Map node (see PROMPT 8,
 * "Knowledge Map interaction"). Shows the canonical learner-state fields
 * for this concept and offers the four standard next steps — it does not
 * duplicate learner state, only reads it.
 */
export default function ConceptDetail({ topic, entry, onClose, onNavigate }) {
  if (!topic) return null;
  const path = findTopicPath(topic.id);
  const status = entry?.status || "NEW";
  const recent = entry?.recentPerformance || [];

  return (
    <Modal open={!!topic} onClose={onClose} labelledBy="concept-detail-title" maxWidth={480}>
      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 4 }}>
        <span className="tiny muted">{path.map((p) => p.name).join(" • ")}</span>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--c-text-faint)", cursor: "pointer", fontSize: 15 }}>✕</button>
      </div>
      <h2 id="concept-detail-title" style={{ margin: "0 0 10px", fontSize: 22 }}>{topic.name}</h2>
      <Badge tone={status === "MASTERED" ? "gold" : status === "STRONG" ? "teal" : status === "DEVELOPING" ? "blue" : status === "LEARNING" ? "amber" : "slate"}>
        {STATUS_META[status]?.label || "New"}
      </Badge>

      <div className="grid grid-2" style={{ gap: 14, margin: "18px 0" }}>
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="tiny muted">Mastery</span>
            <span className="small strong">{entry?.mastery ?? 0}%</span>
          </div>
          <ProgressBar value={entry?.mastery ?? 0} tone="gold" ariaLabel="Mastery" />
        </div>
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="tiny muted" title="How much evidence backs the mastery estimate — separate from mastery itself.">Confidence</span>
            <span className="small strong">{entry?.confidence ?? 0}%</span>
          </div>
          <ProgressBar value={entry?.confidence ?? 0} tone="teal" ariaLabel="Confidence" />
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        <div className="flex items-center justify-between">
          <span className="tiny muted">Recent performance</span>
          <span className="flex gap-4" aria-label={`${recent.filter((r) => r === 1).length} correct of last ${recent.length}`}>
            {recent.length ? recent.map((r, i) => (
              <span key={i} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: r === 1 ? "var(--c-teal)" : "var(--c-rose)" }} />
            )) : <span className="tiny muted">No attempts yet</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">Last studied</span>
          <span className="small">{formatDate(entry?.lastStudiedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">Next review</span>
          <span className="small">{formatFutureDate(entry?.nextReviewAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tiny muted">Lifetime record</span>
          <span className="small">{entry?.correctAttempts ?? 0} correct / {entry?.incorrectAttempts ?? 0} incorrect</span>
        </div>
      </div>

      <div className="flex gap-8 wrap">
        <Button variant="primary" size="sm" onClick={() => onNavigate("learn", topic.id)}>Learn</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("explain", topic.id)}>Explain</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("learn", topic.id)}>Practice</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("review", topic.id)}>Review</Button>
      </div>
    </Modal>
  );
}
