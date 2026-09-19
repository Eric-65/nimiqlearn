import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
import { conceptsForGoal } from "../services/onboardingService.js";
import { generateActivityContent } from "../services/learnLoopService.js";
import { STAGE_LABEL_KEYS } from "../services/masteryService.js";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";

/**
 * The diagnostic: what does this learner already know?
 *
 * One question per concept, not five on one — five questions about
 * quadratics tell you how well somebody does quadratics, which you were
 * going to find out anyway. One each across five concepts tells you where
 * to start, which is the only thing this is for.
 *
 * EVERY QUESTION ASKS TWICE. After the answer comes "how sure were you?",
 * and the pair is worth far more than the answer alone. Right and sure is
 * knowledge — the concept starts at CAN_RECALL and the learner never gets
 * taught it from scratch. Right but unsure is a guess, and counting a
 * guess as knowledge is how a learner ends up stuck three concepts later
 * wondering why nothing makes sense. Confidently wrong is the most useful
 * answer in the whole exercise: that is a misconception with a name, and
 * the coach will go and repair it.
 *
 * Questions come from NimiqLearn AI (/api/learn/activity) and fall back to
 * the built-in templates when the backend is unreachable, so the
 * diagnostic always completes.
 */
export default function Diagnostic() {
  const { route, navigate } = useNav();
  const { recordDiagnostic, goal } = useLearner();
  const { t, tOr } = useI18n();

  const goalId = route.params?.goal || goal?.goalId || "explore";
  const concepts = useMemo(() => conceptsForGoal(goalId).slice(0, 5), [goalId]);

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  /* All questions up front: mid-diagnostic loading spinners are where
     people abandon, and the whole thing is meant to take under a minute.
     Generated in parallel, and each one independently falls back, so one
     slow or failed call does not hold up the rest. */
  const load = useCallback(async () => {
    setLoading(true);
    const built = await Promise.all(
      concepts.map((topic) =>
        generateActivityContent({
          type: "MULTIPLE_CHOICE",
          topic,
          level: goal?.level || "beginner",
        })
          .then((content) => ({ topic, ...content }))
          .catch(() => null)
      )
    );
    setQuestions(built.filter((q) => q && Array.isArray(q.options) && q.options.length >= 2));
    setLoading(false);
  }, [concepts, goal?.level]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = questions[index] || null;

  const answerConfidence = (confident) => {
    const correct = picked === current.correctIndex;
    const next = [
      ...answers,
      {
        topicId: current.topic.id,
        correct,
        confident,
        /* The misconception recorded for a confidently wrong answer is the
           option they actually chose — a named wrong idea, which is what
           makes it repairable. Never the question text. */
        question: !correct && confident ? current.options[picked] : null,
      },
    ];
    setAnswers(next);
    setPicked(null);

    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      setSummary(recordDiagnostic(next));
    }
  };

  if (loading) {
    return (
      <div>
        <header className="page-header">
          <h1 className="page-title">{t("diagnostic.title")}</h1>
        </header>
        <div className="flex items-center gap-12 muted small" aria-live="polite">
          <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
          {t("diagnostic.preparing")}
        </div>
      </div>
    );
  }

  if (summary) {
    return <DiagnosticSummary summary={summary} onStart={() => navigate("home")} />;
  }

  if (!current) {
    return (
      <div>
        <header className="page-header">
          <h1 className="page-title">{t("diagnostic.title")}</h1>
        </header>
        <Card>
          <p className="muted">{t("diagnostic.unavailable")}</p>
          <Button variant="teal" size="sm" onClick={() => navigate("home")}>{t("diagnostic.toHome")}</Button>
        </Card>
      </div>
    );
  }

  const topicName = tOr(`topic.${current.topic.id}.name`, current.topic.name);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("diagnostic.title")}</h1>
          <p className="page-sub">{t("diagnostic.sub")}</p>
        </div>
        <Badge tone="slate">{t("diagnostic.progress", { n: index + 1, total: questions.length })}</Badge>
      </header>

      <div className="sprint-progress" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={index + 1}>
        <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      <Card>
        <Badge tone="blue">{topicName}</Badge>
        <p style={{ fontSize: 17, margin: "12px 0 16px" }}>{current.question || current.prompt}</p>

        <div className="diagnostic-options">
          {current.options.map((option, i) => (
            <button
              key={i}
              type="button"
              className={`diagnostic-option ${picked === i ? "selected" : ""}`}
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
            >
              {option}
            </button>
          ))}
        </div>

        {/* The second half of every question. Asked after the answer so it
            cannot influence it, and phrased about certainty rather than
            difficulty — "was that a guess?" is a question people answer
            honestly. */}
        {picked !== null && (
          <div className="diagnostic-confidence anim-pop">
            <p className="small" style={{ margin: "0 0 10px" }}>{t("diagnostic.confidenceQ")}</p>
            <div className="flex gap-12 wrap">
              <Button variant="teal" size="sm" onClick={() => answerConfidence(true)}>
                {t("diagnostic.sure")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => answerConfidence(false)}>
                {t("diagnostic.guess")}
              </Button>
            </div>
          </div>
        )}

        <button type="button" className="todays-plan-why" style={{ marginTop: 14 }} onClick={() => answerConfidence(false)}>
          {t("diagnostic.dontKnow")}
        </button>
      </Card>
    </div>
  );
}

/**
 * What the diagnostic found. Three lists, because three things can be
 * true about a concept and each leads somewhere different: already known
 * (skip it), confidently wrong (repair it), not yet known (teach it).
 */
function DiagnosticSummary({ summary, onStart }) {
  const { t, tOr } = useI18n();
  const name = (id) => tOr(`topic.${id}.name`, id);

  const rows = [
    { key: "testedOut", ids: summary.testedOut, tone: "teal", icon: "✓", labelKey: "diagnostic.knownAlready" },
    { key: "misconceptions", ids: summary.misconceptions, tone: "rose", icon: "🔍", labelKey: "diagnostic.toRepair" },
    { key: "gaps", ids: summary.gaps, tone: "slate", icon: "○", labelKey: "diagnostic.toLearn" },
  ].filter((r) => r.ids.length);

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">{t("diagnostic.doneTitle")}</h1>
      </header>

      <Card className="anim-pop">
        <p style={{ margin: "0 0 18px" }}>
          {summary.testedOut.length
            ? t("diagnostic.doneWithSkips", { count: summary.testedOut.length })
            : t("diagnostic.doneNoSkips")}
        </p>

        {rows.map((row) => (
          <div key={row.key} className="diagnostic-row">
            <Badge tone={row.tone}>{t(row.labelKey)}</Badge>
            <ul className="diagnostic-list">
              {row.ids.map((id, i) => (
                <li key={`${id}-${i}`}>
                  <span aria-hidden="true">{row.icon}</span> {name(id)}
                  {row.key === "testedOut" && (
                    <span className="tiny muted"> · {t(STAGE_LABEL_KEYS.CAN_RECALL)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <Button variant="teal" onClick={onStart} style={{ marginTop: 18 }}>
          {t("diagnostic.seePlan")}
        </Button>
      </Card>
    </div>
  );
}
