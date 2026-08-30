import React from "react";

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  tone = "teal",
  shimmer = false,
  height,
  ariaLabel,
}) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || label || "Progress"}
    >
      {label && (
        <div className="flex justify-between items-center mb-8">
          <span className="small muted strong">{label}</span>
          <span className="small strong">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="progress" style={height ? { height } : undefined}>
        <div
          className={`progress-bar ${tone === "gold" ? "gold" : "teal"} ${shimmer ? "shimmer" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
