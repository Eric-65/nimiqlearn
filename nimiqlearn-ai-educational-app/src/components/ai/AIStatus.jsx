import React from "react";
import { useAiBackend } from "../../hooks/useAiBackend.js";

/**
 * Subtle readiness indicator for NimiqLearn's OpenAI-backed grading/tutor
 * backend. Not a loading dashboard — one small badge. No technical wording
 * (model names, providers) in the learner UI.
 */
export default function AIStatus() {
  const { checking, available } = useAiBackend();

  const meta = checking
    ? { cls: "badge-amber", dot: "var(--st-learning)", glyph: "◌", label: "Checking…" }
    : available
    ? { cls: "badge-teal", dot: "var(--st-strong)", glyph: "●", label: "Ready" }
    : { cls: "badge-rose", dot: "var(--c-rose)", glyph: "!", label: "Unavailable" };

  return (
    <div className="flex items-center gap-8" role="status" aria-live="polite">
      <span
        className={`badge ${meta.cls}`}
        title={
          checking
            ? "Checking whether AI grading is reachable…"
            : available
            ? "AI grading is configured and reachable."
            : "AI grading isn't reachable right now — the built-in assessment engine is used instead."
        }
      >
        <span className="status-dot" style={{ background: meta.dot }} aria-hidden="true" />
        <span aria-hidden="true">{meta.glyph}</span> NimiqLearn AI • {meta.label}
      </span>
    </div>
  );
}
