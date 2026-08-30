import React from "react";
import Button from "../ui/Button.jsx";
import { AI_STATUS, PRIMARY_MODEL } from "../../hooks/useAI.js";

const BLOCKS = 10;

/** Render progress as friendly blocks: ██████░░░░ 58% */
function BlockBar({ percent }) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * BLOCKS);
  return (
    <span
      aria-hidden="true"
      style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: 2, color: "var(--c-teal)", whiteSpace: "nowrap" }}
    >
      {"█".repeat(filled)}
      {"░".repeat(BLOCKS - filled)} {Math.round(percent)}%
    </span>
  );
}

/**
 * The staged AI-loading experience. The rest of the app stays fully
 * usable while this shows. Friendly copy for learners; raw technical
 * detail is only surfaced when `diagnostics` is enabled.
 */
export default function AIModelLoader({ status, progress, model, wasCached, webgpu, diagnostics = false, onRetry, onUseFallback }) {
  const pct = progress?.percent || 0;
  const downloading = progress?.stage === "download";
  const activeModel = model || progress?.model || null;
  const compatibility = status === AI_STATUS.FALLBACK;

  let phase = "preparing"; // preparing | loading | ready | unavailable
  let title = "Preparing AI…";
  let detail = "This happens once. The AI runs privately in your browser afterwards.";
  let tone = "info";

  if (status === AI_STATUS.READY || status === AI_STATUS.FALLBACK) {
    phase = "ready";
    title = "AI ready";
    tone = "success";
    detail = compatibility
      ? "NimiqLearn AI is running in compatibility mode. Everything works — just a little slower."
      : wasCached
        ? "Restored from your browser cache."
        : "Your AI tutor is ready.";
  } else if (status === AI_STATUS.ERROR) {
    phase = "unavailable";
    title = "AI is temporarily unavailable";
    tone = "danger";
    detail = "Your progress is safe. The built-in assessment engine will keep working — you can retry the AI anytime.";
  } else if (downloading) {
    phase = "loading";
    title = "Preparing AI…";
    detail = "Downloading the model (one-time). This can take a minute on your first run.";
  } else if (status === AI_STATUS.CHECKING) {
    phase = "preparing";
    title = "Preparing AI…";
    detail = "Checking your device and starting the learning assistant.";
  } else {
    phase = "loading";
    title = "Preparing AI…";
    detail = "Starting the learning assistant…";
  }

  const showProgress = phase === "preparing" || phase === "loading";

  return (
    <div className="card anim-pop" role="status" aria-live="polite" aria-atomic="true" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="flex items-center gap-16" style={{ marginBottom: 16 }}>
        <div
          className={phase === "loading" || phase === "preparing" ? "pulse-ai" : ""}
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: "var(--c-teal-soft)",
            border: "1px solid rgba(52,224,180,0.4)",
            fontSize: 22,
            flex: "none",
          }}
          aria-hidden="true"
        >
          🧠
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
          <p className="small muted" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>{detail}</p>
        </div>
      </div>

      {showProgress && (
        <>
          <div className="flex items-center justify-between gap-12" style={{ marginBottom: 6 }}>
            <span className="small strong" style={{ color: "var(--c-text-dim)" }}>
              {downloading ? "Downloading the AI model" : "Initializing"}
            </span>
            <BlockBar percent={pct} />
          </div>
          <div className="progress" role="presentation">
            <div
              className="progress-bar teal shimmer"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <div className="flex justify-between" style={{ marginTop: 10 }}>
            <span className="tiny muted">
              {status === AI_STATUS.CHECKING
                ? "Checking device & network…"
                : downloading
                  ? progress?.detail || "Downloading model files…"
                  : "Finalizing…"}
            </span>
            {onUseFallback && (
              <Button variant="ghost" size="sm" onClick={onUseFallback}>
                Use built-in assessment now
              </Button>
            )}
          </div>
          {diagnostics && (
            <p className="tiny muted" style={{ margin: "10px 0 0", fontFamily: "monospace", wordBreak: "break-all" }}>
              {activeModel || PRIMARY_MODEL} • {webgpu ? "webgpu" : "wasm"}
              {progress?.file ? ` • ${progress.file.split("/").pop()}` : ""}
            </p>
          )}
        </>
      )}

      {phase === "ready" && (
        <div className="notice success" style={{ margin: 0 }}>
          <span aria-hidden="true">✅</span>
          <span>
            <strong>AI ready.</strong>{" "}
            {compatibility
              ? "Running in compatibility mode — WebGPU is not available here."
              : webgpu
                ? "Running with GPU acceleration."
                : "Ready when you are."}
          </span>
        </div>
      )}

      {phase === "unavailable" && (
        <div className="notice danger" style={{ margin: 0 }}>
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>AI unavailable right now.</strong> {detail}
          </span>
        </div>
      )}

      {phase === "unavailable" && onRetry && (
        <Button variant="outline" block onClick={onRetry} style={{ marginTop: 14 }}>
          Retry AI
        </Button>
      )}
    </div>
  );
}
