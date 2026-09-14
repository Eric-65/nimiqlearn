import React from "react";
import { useAiBackend } from "../../hooks/useAiBackend.js";
import { useI18n } from "../../hooks/useI18n.js";

/**
 * Subtle readiness indicator for NimiqLearn's OpenAI-backed grading/tutor
 * backend. Not a loading dashboard — one small badge. No technical wording
 * (model names, providers) in the learner UI.
 */
export default function AIStatus() {
  const { checking, available } = useAiBackend();
  const { t } = useI18n();

  const meta = checking
    ? { cls: "badge-amber", dot: "var(--st-learning)", glyph: "◌", label: t("aiStatus.checking") }
    : available
    ? { cls: "badge-teal", dot: "var(--st-strong)", glyph: "●", label: t("aiStatus.ready") }
    : { cls: "badge-rose", dot: "var(--c-rose)", glyph: "!", label: t("aiStatus.unavailable") };

  return (
    <div className="flex items-center gap-8" role="status" aria-live="polite">
      <span
        className={`badge ${meta.cls}`}
        title={
          checking
            ? t("aiStatus.checking.title")
            : available
            ? t("aiStatus.ready.title")
            : t("aiStatus.unavailable.title")
        }
      >
        <span className="status-dot" style={{ background: meta.dot }} aria-hidden="true" />
        <span aria-hidden="true">{meta.glyph}</span> NimiqLearn AI • {meta.label}
      </span>
    </div>
  );
}
