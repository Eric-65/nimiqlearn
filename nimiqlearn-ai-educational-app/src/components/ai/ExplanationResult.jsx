import React, { useEffect, useRef, useState } from "react";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";

/* ---------------- animated number (count-up, respects reduced motion) ---------------- */

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ---------------- section list ---------------- */

function Section({ title, items, tone, icon, empty }) {
  if (!items?.length && !empty) return null;
  const list = items?.length ? items : [empty];
  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--c-border)" }}>
      <div className="flex items-center gap-8" style={{ marginBottom: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            background: tone === "teal" ? "var(--c-teal)" : tone === "amber" ? "var(--c-amber)" : "var(--c-rose)",
            boxShadow: `0 0 8px ${tone === "teal" ? "var(--c-teal)" : tone === "amber" ? "var(--c-amber)" : "var(--c-rose)"}66`,
          }}
        />
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>
          {title}
        </h4>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {list.map((item, i) => (
          <li key={i} className="pill" style={{ padding: "10px 14px", fontSize: 14, background: `var(--c-${tone}-soft)`, borderColor: `rgba(var(--c-${tone}-rgb, 150,160,200), 0.25)` }}>
            <span aria-hidden="true" style={{ color: tone === "teal" ? "var(--c-teal)" : tone === "amber" ? "var(--c-amber)" : "var(--c-rose)" }}>
              {icon}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- main component ---------------- */

/**
 * Learner-facing ExplainBack result. Structured into:
 *   YOU UNDERSTAND / STILL DEVELOPING / WATCH FOR THIS / NEXT CHALLENGE
 * plus an animated Understanding meter (before → after).
 * "✨ AI assessment — Generated locally on your device" — never a model name.
 */
export default function ExplanationResult({ evaluation, topic, beforeMastery = 0, afterMastery, statusAfter, onChallenge }) {
  const modelGenerated = evaluation?.confidence === "model";
  const animatedAfter = useCountUp(Math.round(afterMastery ?? evaluation?.masteryEstimate ?? 0));

  if (!evaluation) return null;

  return (
    <div className="anim-pop" aria-live="polite">
      {/* header */}
      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 14 }}>
        <Badge tone={modelGenerated ? "teal" : "amber"}>
          {modelGenerated ? "✨ AI assessment" : "🧩 Built-in assessment"}
        </Badge>
        <span className="tiny muted">
          {modelGenerated ? "Generated locally on your device" : "AI was unavailable — built-in fallback used"}
        </span>
      </div>

      {evaluation.note && (
        <div className="notice warn" style={{ marginBottom: 14 }}>
          <span aria-hidden="true">ℹ️</span>
          <span>{evaluation.note}</span>
        </div>
      )}

      {/* Understanding meter */}
      <Card style={{ marginBottom: 18 }}>
        <div className="flex items-center justify-between wrap gap-16">
          <div>
            <p className="small strong" style={{ margin: "0 0 4px", color: "var(--c-text-dim)" }}>Understanding</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="strong" style={{ fontSize: 40, lineHeight: 1, color: "var(--c-gold)" }}>{animatedAfter}%</span>
              <span className="tiny muted" aria-hidden="true">before: {Math.round(beforeMastery)}%</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="flex items-center gap-8" aria-hidden="true">
              <span className="small muted">{Math.round(beforeMastery)}%</span>
              <span style={{ color: "var(--c-text-faint)" }}>→</span>
              <span className="small strong" style={{ color: "var(--c-teal)" }}>{Math.round(afterMastery ?? evaluation.masteryEstimate)}%</span>
            </div>
            {statusAfter && (
              <Badge tone={statusAfter === "MASTERED" ? "gold" : statusAfter === "STRONG" ? "teal" : "blue"} className="mt-8">
                {statusAfter}
              </Badge>
            )}
          </div>
        </div>
        <div className="progress" style={{ marginTop: 14, height: 10 }} role="presentation">
          <div
            className="progress-bar gold shimmer"
            style={{ width: `${Math.max(2, animatedAfter)}%`, transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </div>
      </Card>

      {/* the three analysis sections */}
      <Card style={{ marginBottom: 18 }}>
        <Section title="You understand" items={evaluation.strengths} tone="teal" icon="✓" empty="No clear strengths captured yet." />
        <Section title="Still developing" items={evaluation.missingConcepts} tone="amber" icon="•" empty="Nothing missing — strong coverage." />
        <Section title="Watch for this" items={evaluation.misconceptions} tone="rose" icon="•" empty="No misconceptions detected." />
      </Card>

      {/* next challenge */}
      <Card
        style={{
          borderColor: "rgba(247,193,79,0.45)",
          background: "linear-gradient(135deg, rgba(247,193,79,0.12), rgba(17,24,49,0.9) 60%)",
        }}
      >
        <span className="eyebrow" style={{ marginBottom: 8 }}>Next challenge</span>
        <p className="strong" style={{ fontSize: 17, margin: "0 0 14px", lineHeight: 1.5 }}>
          {evaluation.nextChallenge || evaluation.nextAction || `Can you explain ${topic?.name} again with an example?`}
        </p>
        {onChallenge && (
          <Button variant="primary" onClick={onChallenge}>
            Take the challenge →
          </Button>
        )}
      </Card>
    </div>
  );
}
