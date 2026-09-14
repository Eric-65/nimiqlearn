import React, { useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { ACTIVITY_LABEL_KEYS } from "../../services/learnLoopService.js";
import { useI18n } from "../../hooks/useI18n.js";

/**
 * Renders any LearnLoop activity and reports the outcome back.
 * MCQ/PRACTICE get instant feedback; open responses hand control
 * to the caller (e.g. an ExplainBack evaluation).
 */
export default function LearningActivity({ activity, onAnswer, busy = false, aiConfigured = false, onRetryAI }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [openText, setOpenText] = useState("");
  const { t, tOr } = useI18n();

  if (!activity) return null;
  const type = activity.activityType;
  const hasOptions = Array.isArray(activity.options) && activity.options.length >= 2;
  // Free-text activities are answered by writing, never by picking.
  const isFreeText = type === "OPEN_RESPONSE" || type === "EXPLAIN_BACK";
  // Everything else is answered by picking an option whenever options
  // exist — including spaced review and the teaching activities, which
  // both used to render a question with nothing to answer it with.
  const isChoice = !isFreeText && (type === "MULTIPLE_CHOICE" || type === "PRACTICE" || hasOptions);

  const handleChoice = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === activity.correctIndex;
    onAnswer(correct);
  };

  const showSource = activity.source === "model";
  // AI is configured, but THIS activity still came from the built-in
  // template — meaning the AI call was attempted and failed (timed out,
  // backend unreachable, malformed response), not that AI was skipped on
  // purpose. That distinction matters: silently swapping in a template
  // with no indication looks identical to a real AI activity, which is
  // exactly what made a real outage invisible instead of retryable.
  const aiAttemptFailed = aiConfigured && activity.source === "template";

  return (
    <Card className="anim-pop">
      {aiAttemptFailed && (
        <div className="notice warn" style={{ marginBottom: 12 }} role="status">
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>{t("activity.aiTimeout")}</strong> {t("activity.aiTimeout.body")}{" "}
            {onRetryAI && (
              <button className="btn btn-ghost btn-sm" onClick={onRetryAI} disabled={busy} style={{ marginLeft: 6 }}>
                {t("activity.retryAI")}
              </button>
            )}
          </span>
        </div>
      )}
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 12 }}>
        <Badge tone={type === "REVIEW" ? "violet" : type === "PRACTICE" ? "amber" : "blue"}>
          {t(ACTIVITY_LABEL_KEYS[type] || type)}
        </Badge>
        {activity.reasonKey && (
          <span className="tiny muted">
            {/* The reason may name a topic; the name is translated too,
                falling back to the English source when it is not. */}
            {t(activity.reasonKey, activity.reasonVars?.topicId
              ? { ...activity.reasonVars, topic: tOr(`topic.${activity.reasonVars.topicId}.name`, activity.reasonVars.topic) }
              : activity.reasonVars)}
          </span>
        )}
        {showSource && <Badge tone="teal">{t("activity.generatedByAI")}</Badge>}
      </div>

      <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{activity.prompt}</h3>

      {activity.body && (
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--c-text-dim)", marginBottom: 14 }}>{activity.body}</p>
      )}

      {activity.points?.length > 0 && (
        <ul style={{ margin: "0 0 16px", paddingLeft: 18, color: "var(--c-text-dim)", fontSize: 14.5, display: "grid", gap: 6 }}>
          {activity.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      {/* Only ever show a question the learner can actually answer —
          either by picking an option or by typing a free-text response. */}
      {activity.question && (isChoice || isFreeText) && (
        <p className="strong" style={{ fontSize: 15.5, margin: "0 0 14px" }}>{activity.question}</p>
      )}

      {isChoice && activity.options?.length > 0 && (
        <div style={{ display: "grid", gap: 9, marginBottom: 14 }}>
          {activity.options.map((opt, i) => {
            let style = { textAlign: "left", justifyContent: "flex-start" };
            let cls = "btn btn-outline btn-block";
            if (selected !== null) {
              if (i === activity.correctIndex) {
                cls = "btn btn-teal btn-block";
              } else if (i === selected) {
                cls = "btn btn-danger btn-block";
              } else {
                cls = "btn btn-ghost btn-block";
                style = { ...style, opacity: 0.5 };
              }
            }
            return (
              <button
                key={i}
                className={cls}
                style={style}
                disabled={selected !== null || busy}
                onClick={() => handleChoice(i)}
              >
                <span style={{ flex: 1 }}>{opt}</span>
                {selected !== null && i === activity.correctIndex && <span aria-hidden="true">✓</span>}
                {selected !== null && i === selected && i !== activity.correctIndex && <span aria-hidden="true">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {selected !== null && activity.explanation && (
        <div className="notice info" style={{ marginBottom: 0 }} aria-live="polite">
          <span aria-hidden="true">💡</span>
          <span>{activity.explanation}</span>
        </div>
      )}

      {(type === "OPEN_RESPONSE" || type === "EXPLAIN_BACK") && (
        <div>
          <textarea
            className="textarea"
            aria-label={t("activity.yourAnswerFor", { activity: t(ACTIVITY_LABEL_KEYS[type] || type) })}
            placeholder={t(type === "EXPLAIN_BACK" ? "activity.placeholder.explain" : "activity.placeholder.open")}
            value={openText}
            onChange={(e) => setOpenText(e.target.value)}
            rows={4}
          />
          <Button
            variant="teal"
            loading={busy}
            disabled={!openText.trim()}
            onClick={() => onAnswer(true, openText)}
            style={{ marginTop: 10 }}
          >
            {t(type === "EXPLAIN_BACK" ? "activity.evaluate" : "activity.submit")}
          </Button>
        </div>
      )}

      {/* Read-and-continue only when there is nothing to answer. With a
          comprehension question present, picking an option is what
          completes the activity. */}
      {(type === "SHORT_EXPLANATION" || type === "ANALOGY" || type === "EXAMPLE") && !hasOptions && (
        <Button variant="teal" loading={busy} onClick={() => onAnswer(true)} style={{ marginTop: 6 }}>
          {t("activity.gotIt")}
        </Button>
      )}

      {type === "REVIEW" && !hasOptions && (
        <div className="flex gap-8 wrap" style={{ marginTop: 6 }}>
          <Button variant="teal" loading={busy} onClick={() => onAnswer(true)}>
            {t("activity.recalled")}
          </Button>
          <Button variant="outline" loading={busy} onClick={() => onAnswer(false)}>
            {t("activity.anotherPass")}
          </Button>
        </div>
      )}

      {type === "MULTIPLE_CHOICE" && selected !== null && !revealed && (
        <Button variant="ghost" size="sm" onClick={() => setRevealed(true)} style={{ marginTop: 12 }}>
          {t("activity.showExplanation")}
        </Button>
      )}
      {type === "MULTIPLE_CHOICE" && revealed && activity.explanation && (
        <div className="notice info" style={{ marginTop: 12 }}>
          <span aria-hidden="true">💡</span>
          <span>{activity.explanation}</span>
        </div>
      )}
    </Card>
  );
}
