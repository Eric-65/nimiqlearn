import React from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";

/**
 * The "Next challenge" call to action from an ExplainBack result.
 *
 * Deliberately NOT part of ExplanationResult.jsx: the page decides where
 * it sits, so the AI Tutor's deeper critique can come first and the
 * learner reads the feedback before being pushed to the next thing.
 */
export default function NextChallengeCard({ evaluation, topic, onChallenge }) {
  if (!evaluation) return null;

  return (
    <Card
      style={{
        borderColor: "rgba(247,193,79,0.45)",
        background: "linear-gradient(135deg, var(--c-gold-soft), var(--c-card-base) 60%)",
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
  );
}
