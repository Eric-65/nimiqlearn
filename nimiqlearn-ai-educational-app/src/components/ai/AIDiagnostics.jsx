import React, { useEffect, useState } from "react";
import { useAI, AI_STATUS, PRIMARY_MODEL } from "../../hooks/useAI.js";
import { enablePreloadFlag, supportsWebGPU, MODEL_DTYPE } from "../../services/aiService.js";
import Button from "../ui/Button.jsx";

const FLAG = "nimiqlearn:diagnostics";

function enabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV !== true) return false;
  let flag = "0";
  try {
    flag = localStorage.getItem(FLAG) || "0";
  } catch {
    /* storage may be unavailable (sandboxed) — default off */
  }
  return flag === "1" || window.location.hash.includes("diagnostics");
}

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between gap-12" style={{ padding: "5px 0", borderBottom: "1px solid var(--c-border)" }}>
      <span className="tiny muted">{label}</span>
      <span className="tiny strong" style={{ color: tone || "var(--c-text)", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

const STATUS_LABEL = {
  [AI_STATUS.IDLE]: "IDLE",
  [AI_STATUS.CHECKING]: "CHECKING",
  [AI_STATUS.LOADING]: "LOADING",
  [AI_STATUS.READY]: "READY",
  [AI_STATUS.FALLBACK]: "COMPATIBILITY",
  [AI_STATUS.GENERATING]: "GENERATING",
  [AI_STATUS.ERROR]: "ERROR",
};

/**
 * DEVELOPMENT-ONLY diagnostics panel.
 * Visible only in dev builds with the flag `nimiqlearn:diagnostics=1`
 * or the `#diagnostics` hash. Never ships to normal learners.
 */
export default function AIDiagnostics() {
  const ai = useAI();
  const [show, setShow] = useState(enabled());

  useEffect(() => {
    if (import.meta.env.DEV) {
      try {
        localStorage.setItem(FLAG, show ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }, [show]);

  if (import.meta.env.DEV !== true) return null;

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        style={{
          position: "fixed",
          right: 12,
          bottom: 78,
          zIndex: 90,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px dashed var(--c-border-strong)",
          background: "rgba(10,15,30,0.9)",
          color: "var(--c-text-faint)",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        ⚙ AI Diagnostics
      </button>
    );
  }

  const activeDtype = ai.metrics?.activeDtype || MODEL_DTYPE;
  const modelSizeMb = ai.metrics?.totalBytes ? (ai.metrics.totalBytes / (1024 * 1024)).toFixed(0) : null;

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 95,
        width: "min(380px, calc(100vw - 24px))",
        maxHeight: "70vh",
        overflowY: "auto",
        background: "#0a0f1e",
        border: "1px solid var(--c-border-strong)",
        borderRadius: 14,
        boxShadow: "var(--shadow-lg)",
        padding: 14,
      }}
      aria-label="AI diagnostics (development)"
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="small strong" style={{ color: "var(--c-gold)" }}>⚙ AI Diagnostics (dev)</span>
        <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "var(--c-text-faint)", cursor: "pointer", fontSize: 13 }} aria-label="Close diagnostics">
          ✕
        </button>
      </div>

      <Row label="Status" value={STATUS_LABEL[ai.status]} tone={ai.status === AI_STATUS.ERROR ? "var(--c-rose)" : ai.status === AI_STATUS.READY || ai.status === AI_STATUS.FALLBACK ? "var(--c-teal)" : "var(--c-gold)"} />
      <Row label="Transformers.js" value="BUNDLED (npm)" />
      <Row label="WebGPU" value={supportsWebGPU() ? "AVAILABLE" : "UNAVAILABLE"} tone={supportsWebGPU() ? "var(--c-teal)" : "var(--c-gold)"} />
      <Row label="Runtime" value={ai.device ? ai.device.toUpperCase() : "—"} />
      <Row label="Active model" value={ai.model ? ai.model.split("/").pop() : "—"} />
      <Row label="Quantization" value={activeDtype} />
      {modelSizeMb && <Row label="Model size" value={`~${modelSizeMb} MB (selected file)`} />}
      <Row label="Model progress" value={`${ai.progress?.percent || 0}%`} />
      <Row label="Load type" value={ai.status === AI_STATUS.READY ? (ai.wasCached ? "CACHED LOAD" : "FIRST LOAD") : ai.status === AI_STATUS.FALLBACK ? "COMPATIBILITY LOAD" : "—"} />
      {ai.metrics?.libLoadedAtMs != null && <Row label="Library load" value={`${ai.metrics.libLoadedAtMs} ms`} />}
      {ai.metrics?.initDurationMs != null && <Row label="Initialization time" value={`${(ai.metrics.initDurationMs / 1000).toFixed(1)} s`} />}
      {ai.metrics?.lastGenerationMs != null && <Row label="Generation time" value={`${(ai.metrics.lastGenerationMs / 1000).toFixed(1)} s`} />}
      {ai.metrics?.firstTokenMs != null && <Row label="First token" value={`${(ai.metrics.firstTokenMs / 1000).toFixed(1)} s`} />}
      <Row label="Cached locally" value={ai.wasCached ? "YES" : "NO"} />
      {ai.error && <Row label="Last error" value={ai.error} tone="var(--c-rose)" />}

      {ai.attempts?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="tiny strong" style={{ color: "var(--c-text-dim)" }}>Attempt trail</span>
          <div style={{ display: "grid", gap: 2, marginTop: 4, fontFamily: "monospace", fontSize: 10.5, color: "var(--c-text-faint)" }}>
            {ai.attempts.slice(-6).map((a, i) => (
              <div key={i}>
                {a.ok ? "✓" : "✗"} {a.stage} {a.model?.split("/").pop() || ""} {a.device || ""} {a.dtype || ""}
                {a.error ? ` — ${String(a.error).slice(0, 60)}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-8 wrap" style={{ marginTop: 12 }}>
        <Button variant="outline" size="sm" onClick={ai.reset}>Reset AI</Button>
        <Button variant="outline" size="sm" onClick={ai.preload}>Idle preload</Button>
        <Button variant="outline" size="sm" onClick={() => { enablePreloadFlag(); ai.initialize(); }}>Force preload</Button>
      </div>
    </div>
  );
}
