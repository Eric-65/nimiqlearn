import React from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { useI18n } from "../../hooks/useI18n.js";

/**
 * The "Next challenge" call to action from an ExplainBack result.
 *
 * Deliberately NOT part of ExplanationResult.jsx: the page decides where
 * it sits, so the AI Tutor's deeper critique can come first and the
 * learner reads the feedback before being pushed to the next thing.
 */
export default function NextChallengeCard({ evaluation, topic, onChallenge }) {
  const { t, tOr } = useI18n();
  if (!evaluation) return null;

  return (
    <Card
      style={{
        borderColor: "rgba(247,193,79,0.45)",
        background: "linear-gradient(135deg, var(--c-gold-soft), var(--c-card-base) 60%)",
      }}
    >
      <span className="eyebrow" style={{ marginBottom: 8 }}>{t("challenge.eyebrow")}</span>
      <p className="strong" style={{ fontSize: 17, margin: "0 0 14px", lineHeight: 1.5 }}>
        {/* The AI's own nextChallenge already comes back in the learner's
            language (the backend is told to answer in it), so it is shown
            as-is; only OUR fallback sentence needs translating. */}
        {evaluation.nextChallenge ||
          evaluation.nextAction ||
          t("challenge.fallback", { topic: tOr(`topic.${topic?.id}.name`, topic?.name || "") })}
      </p>
      {onChallenge && (
        <Button variant="primary" onClick={onChallenge}>
          {t("challenge.take")}
        </Button>
      )}
    </Card>
  );
}
