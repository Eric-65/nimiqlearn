import React, { useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { TUTOR_CONFIGURED } from "../../config/explainBackTutorConfig.js";
import { askExplainBackTutor } from "../../services/explainBackTutorService.js";

/**
 * Optional, opt-in AI Tutor feedback for an ExplainBack result — asks
 * GLM-5.3 (via NimiqLearn's own backend, never client-side, see
 * docs/explainback-ai-tutor.md) to critique the learner's explanation
 * against the app's own rubric grading, and complete or correct it when
 * it's partial or wrong.
 *
 * Renders nothing when the backend isn't configured (see
 * explainBackTutorConfig.js) — this is a paid, metered call, so it is
 * never shown as a broken button and never fired automatically; the
 * learner has to press "Ask the AI Tutor" themselves.
 */
export default function AITutorPanel({ topic, referenceAnswer, learnerExplanation, evaluation }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  if (!TUTOR_CONFIGURED) return null;

  const handleAsk = async () => {
    setState("loading");
    setError(null);
    const result = await askExplainBackTutor({
      topic: topic?.name,
      referenceAnswer,
      learnerExplanation,
      assessment: {
        score: evaluation?.score,
        missingConcepts: evaluation?.missingConcepts,
        misconceptions: evaluation?.misconceptions,
      },
    });
    if (result.ok) {
      setFeedback(result.feedback);
      setState("done");
    } else {
      setError(result.error);
      setState("error");
    }
  };

  return (
    <Card className="anim-rise" style={{ borderColor: "rgba(124,92,255,0.4)" }}>
      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>
          NimiqLearn AI Tutor
        </h3>
        <Badge tone="violet">GLM-5.3</Badge>
      </div>

      {state === "idle" && (
        <>
          <p className="small muted" style={{ margin: "0 0 12px" }}>
            Get a deeper AI critique of your explanation — and a completed version of anything you missed.
          </p>
          <Button variant="outline" size="sm" onClick={handleAsk}>
            Ask the AI Tutor →
          </Button>
        </>
      )}

      {state === "loading" && (
        <div className="flex items-center gap-12 muted small">
          <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
          Asking GLM-5.3…
        </div>
      )}

      {state === "error" && (
        <div className="notice warn" style={{ margin: 0 }}>
          <span aria-hidden="true">⚠️</span>
          <span>
            {error}{" "}
            <button className="btn btn-ghost btn-sm" onClick={handleAsk} style={{ marginLeft: 6 }}>
              Retry →
            </button>
          </span>
        </div>
      )}

      {state === "done" && (
        <p className="small" style={{ margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {feedback}
        </p>
      )}
    </Card>
  );
}
