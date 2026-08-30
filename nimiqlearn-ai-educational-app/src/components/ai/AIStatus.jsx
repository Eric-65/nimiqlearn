import React from "react";
import { useAI, AI_STATUS } from "../../hooks/useAI.js";

const STATE_META = {
  [AI_STATUS.IDLE]: { tone: "slate", label: "Standby", dot: "#8b9bb4", glyph: "◌" },
  [AI_STATUS.CHECKING]: { tone: "amber", label: "Preparing AI…", dot: "var(--st-learning)", glyph: "◌" },
  [AI_STATUS.LOADING]: { tone: "amber", label: "Preparing AI…", dot: "var(--st-learning)", glyph: "◌" },
  [AI_STATUS.READY]: { tone: "teal", label: "AI ready", dot: "var(--st-strong)", glyph: "●" },
  [AI_STATUS.FALLBACK]: { tone: "violet", label: "Compatibility mode", dot: "var(--c-violet)", glyph: "⚡" },
  [AI_STATUS.GENERATING]: { tone: "blue", label: "Analyzing…", dot: "var(--st-developing)", glyph: "◌" },
  [AI_STATUS.ERROR]: { tone: "rose", label: "AI unavailable", dot: "var(--c-rose)", glyph: "!" },
};

const TONE_CLASS = {
  amber: "badge-amber",
  teal: "badge-teal",
  blue: "badge-blue",
  rose: "badge-rose",
  slate: "badge-slate",
  violet: "badge-violet",
};

/**
 * Subtle readiness indicator. Not a loading dashboard — one small badge.
 * No technical wording (model names, runtimes) in the learner UI.
 */
export default function AIStatus() {
  const { status, webgpu } = useAI();
  const meta = STATE_META[status] || STATE_META[AI_STATUS.IDLE];

  return (
    <div className="flex items-center gap-8" role="status" aria-live="polite">
      <span
        className={`badge ${TONE_CLASS[meta.tone]}`}
        title={
          status === AI_STATUS.ERROR
            ? "The AI could not start — the built-in assessment engine is active. You can retry from the AI loader."
            : status === AI_STATUS.CHECKING || status === AI_STATUS.LOADING
              ? "Your AI tutor is preparing in the background — no action needed."
              : undefined
        }
      >
        <span className="status-dot" style={{ background: meta.dot }} aria-hidden="true" />
        <span aria-hidden="true">{meta.glyph}</span> NimiqLearn AI • {meta.label}
      </span>
      {status === AI_STATUS.GENERATING && (
        <span className="thinking-dots" aria-hidden="true">
          <span /><span /><span />
        </span>
      )}
      {(status === AI_STATUS.READY || status === AI_STATUS.FALLBACK) && !webgpu && (
        <span className="badge badge-slate" title="WebGPU is not available in this browser; running on the compatibility runtime.">
          ⚡ Compatibility mode
        </span>
      )}
    </div>
  );
}
