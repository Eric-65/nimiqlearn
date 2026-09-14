import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { LEAF_TOPICS, findTopic, findTopicPath, TOPIC_CONTENT } from "../data/mockTopics.js";
import { ACTIVITY_LABEL_KEYS } from "../services/learnLoopService.js";
import { STATUS_META } from "../services/knowledgeService.js";
import { useI18n } from "../hooks/useI18n.js";
import { isAssessmentBackendConfigured } from "../services/explainBackAssessmentService.js";
import AIStatus from "../components/ai/AIStatus.jsx";
import ExplanationResult from "../components/ai/ExplanationResult.jsx";
import AITutorPanel from "../components/ai/AITutorPanel.jsx";
import NextChallengeCard from "../components/ai/NextChallengeCard.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export default function ExplainBack() {
  const { route, navigate } = useNav();
  const { getEntry, evaluateExplanation } = useLearner();
  const { t, tOr, tPlural } = useI18n();

  const [topicId, setTopicId] = useState(route.params?.topic || "newtons-second-law");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("input"); // input | analyzing | result
  const [evaluation, setEvaluation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [nextDecision, setNextDecision] = useState(null);
  const [beforeMastery, setBeforeMastery] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  const generatingRef = useRef(false);
  const activeTopicRef = useRef(topicId);
  const topicIdRef = useRef(topicId);
  topicIdRef.current = topicId;
  // Guards every async continuation below: if the learner navigates away
  // (unmounting this page) while a request is still in flight, no further
  // state updates are attempted on the unmounted component. Must set
  // current = true in the effect body itself, not just false in cleanup —
  // React StrictMode (dev only) deliberately runs mount -> cleanup -> mount
  // once on every initial mount, and without this the cleanup's `false`
  // would stick permanently, silently killing every async flow on this
  // page in development (a real bug found via live testing: the request
  // to the backend succeeded, but the result never rendered because this
  // ref was already stuck false before the user ever clicked anything).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const topic = findTopic(topicId);
  const entry = getEntry(topicId);
  const level = entry?.mastery < 40 ? "beginner" : entry?.mastery < 75 ? "intermediate" : "advanced";
  const path = topic ? findTopicPath(topic.id) : [];
  const words = wordCount(text);
  const aiConfigured = isAssessmentBackendConfigured();

  /** Shared evaluation runner. preferAI=false forces the deterministic
   * rubric engine. The review recommendation and next-activity decision
   * are computed once, inside evaluateExplanationAction (LearnerContext.jsx),
   * from the state that was actually just saved — this just displays them
   * rather than recomputing them from a possibly-stale local copy. */
  const runEvaluation = useCallback(
    async (preferAI) => {
      const { evaluation: ev, reviewRecommendation, nextDecision: decision } = await evaluateExplanation({
        topicId: activeTopicRef.current,
        learnerExplanation: text,
        learnerLevel: level,
        preferAI,
      });
      if (!mountedRef.current) return false;
      if (activeTopicRef.current !== topicIdRef.current) return false;

      setEvaluation(ev);
      setRecommendation(reviewRecommendation);
      setNextDecision(decision);
      setPhase("result");
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, level]
  );

  /** SUBMIT — "Check My Understanding →". A single short backend request
   * (or an instant deterministic fallback if AI grading isn't configured)
   * — there is no multi-hundred-MB model to load first. */
  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    activeTopicRef.current = topicId;
    setShowOriginal(true);
    setBeforeMastery(getEntry(topicId)?.mastery ?? 0);
    setPhase("analyzing");

    try {
      await runEvaluation(true);
    } catch (err) {
      // Never leave the learner stuck on "Checking your understanding…"
      // forever — an unexpected error anywhere in the pipeline still gets
      // a real result via the deterministic rubric, which cannot fail the
      // same way (no network, no external call).
      console.error("[NimiqLearn] ExplainBack evaluation failed unexpectedly; falling back to the built-in engine.", err);
      if (mountedRef.current) {
        try {
          await runEvaluation(false);
        } catch (fallbackErr) {
          console.error("[NimiqLearn] Built-in fallback also failed.", fallbackErr);
          if (mountedRef.current) setPhase("input");
        }
      }
    } finally {
      generatingRef.current = false;
      if (mountedRef.current) setIsGenerating(false);
    }
  }, [topicId, runEvaluation, getEntry]);

  const handleUseBuiltIn = async () => {
    setBeforeMastery(getEntry(topicId)?.mastery ?? 0);
    await runEvaluation(false);
  };

  const handleRetryAI = () => {
    handleAnalyze();
  };

  const handleReset = () => {
    setPhase("input");
    setEvaluation(null);
    setRecommendation(null);
    setNextDecision(null);
    setText("");
  };

  const switchTopic = (id) => {
    setTopicId(id);
    setPhase("input");
    setEvaluation(null);
    setRecommendation(null);
    setNextDecision(null);
    setText("");
  };

  const afterMastery = getEntry(topicId)?.mastery ?? beforeMastery;
  const statusAfter = getEntry(topicId)?.status;

  return (
    <div>
      {/* HEADER */}
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("nav.explain")}</h1>
          <p className="page-sub">{t("explain.sub")}</p>
        </div>
        <AIStatus />
      </header>

      {/* CONCEPT PICKER */}
      <div className="flex gap-8 wrap" style={{ marginBottom: 24 }}>
        {LEAF_TOPICS.map((leaf) => {
          const e = getEntry(leaf.id);
          const active = leaf.id === topicId;
          return (
            <button
              key={leaf.id}
              className={`chip ${active ? "active" : ""}`}
              onClick={() => switchTopic(leaf.id)}
              aria-pressed={active}
              disabled={isGenerating}
            >
              <span className="status-dot" style={{ background: STATUS_META[e?.status]?.color || "var(--st-new)" }} aria-hidden="true" />
              {tOr(`topic.${leaf.id}.name`, leaf.name)}
            </button>
          );
        })}
      </div>

      {/* INPUT — the core experience */}
      {phase === "input" && topic && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* CONCEPT CARD */}
          <Card className="anim-rise" style={{ marginBottom: 16, padding: "18px 22px" }}>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <div className="flex items-center gap-8 wrap" style={{ marginBottom: 6 }}>
                  <span className="tiny muted">
                    {path.map((p) => tOr(`topic.${p.id}.name`, p.name)).join(" • ")}
                  </span>
                </div>
                <h2 style={{ fontSize: 24, margin: 0 }}>{tOr(`topic.${topic.id}.name`, topic.name)}</h2>
              </div>
              <div className="flex items-center gap-8">
                <Badge tone={entry?.status === "MASTERED" ? "gold" : entry?.status === "STRONG" ? "teal" : entry?.status === "DEVELOPING" ? "blue" : entry?.status === "LEARNING" ? "amber" : "slate"}>
                  {t(`status.${String(entry?.status || "NEW").toLowerCase()}`)} {entry?.mastery > 0 ? `• ${entry.mastery}%` : ""}
                </Badge>
              </div>
            </div>
          </Card>

          {/* LEARNER PROMPT + TEXTAREA */}
          <Card className="anim-rise delay-1" style={{ padding: "24px 24px 20px" }}>
            <p className="small" style={{ margin: "0 0 14px", color: "var(--c-text-dim)", fontSize: 14.5 }}>
              {t("explain.prompt")}
            </p>

            <label className="label" htmlFor="explain-text" style={{ marginBottom: 8 }}>
              {t("explain.yourExplanation")}
            </label>
            <textarea
              id="explain-text"
              className="textarea"
              placeholder={t("explain.placeholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              style={{ minHeight: 180, fontSize: 16, lineHeight: 1.7 }}
            />

            <div className="flex items-center justify-between wrap gap-12" style={{ marginTop: 12 }}>
              <div className="flex items-center gap-12">
                <span className="tiny muted" aria-live="polite">
                  {tPlural("explain.words", words)}
                </span>
                <span className="tiny muted" aria-hidden="true">·</span>
                {aiConfigured ? (
                  <span className="tiny" style={{ color: "var(--c-teal)" }} role="status">
                    ● {t("explain.aiReady")}
                  </span>
                ) : (
                  <span className="tiny" style={{ color: "var(--c-rose)" }} role="status">
                    {t("explain.aiNotConfigured")}
                  </span>
                )}
              </div>
              <Button
                variant="teal"
                size="lg"
                onClick={handleAnalyze}
                disabled={!text.trim() || isGenerating}
              >
                {t("explain.check")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ANALYZING — a single short backend request, not a model download */}
      {phase === "analyzing" && topic && (
        <div className="anim-fade" style={{ display: "grid", gap: 18, maxWidth: 720, margin: "0 auto" }}>
          <Card>
            <div className="flex items-center gap-12" style={{ marginBottom: 14 }}>
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              <h3 style={{ margin: 0, fontSize: 17 }}>{t("explain.checking")}</h3>
            </div>

            {/* keep the learner's original text visible while waiting */}
            <details open={showOriginal} style={{ marginBottom: 0 }}>
              <summary
                className="small strong"
                style={{ cursor: "pointer", color: "var(--c-text-dim)", marginBottom: 8 }}
                onClick={(e) => { e.preventDefault(); setShowOriginal((s) => !s); }}
              >
                {t(showOriginal ? "explain.hideYours" : "explain.showYours")}
              </summary>
              <p
                style={{
                  background: "var(--c-inset)",
                  border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)",
                  padding: "12px 14px",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--c-text-dim)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {text}
              </p>
            </details>

            {aiConfigured && (
              <Button variant="ghost" size="sm" onClick={handleUseBuiltIn} style={{ marginTop: 12 }}>
                {t("explain.useBuiltIn")}
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* RESULT */}
      {phase === "result" && evaluation && topic && (
        <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
          <ExplanationResult
            evaluation={evaluation}
            beforeMastery={beforeMastery}
            afterMastery={afterMastery}
            statusAfter={statusAfter}
          />

          {/* The tutor's deeper critique comes BEFORE the next challenge —
              the learner should read the feedback on what they just wrote
              before being pushed on to the next thing. */}
          <AITutorPanel
            topic={topic}
            referenceAnswer={TOPIC_CONTENT[topicId]?.definition}
            learnerExplanation={text}
            evaluation={evaluation}
          />

          <NextChallengeCard
            evaluation={evaluation}
            topic={topic}
            onChallenge={() => navigate("learn", { topic: topicId })}
          />

          {evaluation.confidence === "heuristic" && (
            <div className="notice" style={{ margin: 0 }}>
              <span aria-hidden="true">🧩</span>
              <span>
                <strong>{t("explain.usedBuiltIn")}</strong>{" "}
                {evaluation.note || t("explain.aiUnavailable")}{" "}
                {aiConfigured && (
                  <button className="btn btn-ghost btn-sm" onClick={handleRetryAI} style={{ marginLeft: 6 }}>
                    {t("explain.retryAI")}
                  </button>
                )}
              </span>
            </div>
          )}

          {/* FORGETMENOT */}
          {recommendation && (
            <Card className="anim-rise">
              <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>
                  ForgetMeNot
                </h3>
                <Badge tone={recommendation.priorityScore >= 65 ? "amber" : "teal"}>{t(recommendation.levelKey)}</Badge>
              </div>
              <p className="small" style={{ margin: "0 0 6px" }}>
                {t("explain.revisitIn")} <strong>{tPlural("explain.days", recommendation.intervalDays)}</strong>.
              </p>
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                {t("explain.whySchedule")}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("review", { topic: topicId })}>
                {t("explain.reviewLater")}
              </Button>
            </Card>
          )}

          {/* NEXT STEP — one clear action */}
          {nextDecision && (
            <Card className="anim-rise" style={{ borderColor: "rgba(77,141,255,0.4)" }}>
              <span className="eyebrow" style={{ marginBottom: 6 }}>{t("explain.nextUp")}</span>
              <h3 style={{ fontSize: 18, margin: "0 0 4px" }}>
                {t(ACTIVITY_LABEL_KEYS[nextDecision.activityType] || nextDecision.activityType)}
              </h3>
              <p className="small muted" style={{ margin: "0 0 14px" }}>
                {t(nextDecision.reasonKey, nextDecision.reasonVars?.topicId
                  ? { ...nextDecision.reasonVars, topic: tOr(`topic.${nextDecision.reasonVars.topicId}.name`, nextDecision.reasonVars.topic) }
                  : nextDecision.reasonVars)}
              </p>
              <Button variant="primary" onClick={() => navigate("learn", { topic: topicId })}>
                {t("explain.startNext")}
              </Button>
            </Card>
          )}

          <div className="flex justify-center" style={{ marginTop: 4 }}>
            <Button variant="ghost" onClick={handleReset}>{t("explain.another")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
