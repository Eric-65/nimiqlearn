import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAI, AI_STATUS } from "../hooks/useAI.js";
import { LEAF_TOPICS, findTopic, findTopicPath } from "../data/mockTopics.js";
import { ACTIVITY_LABELS } from "../services/learnLoopService.js";
import { STATUS_META } from "../services/knowledgeService.js";
import { getAIState } from "../services/aiService.js";
import AIStatus from "../components/ai/AIStatus.jsx";
import AIModelLoader from "../components/ai/AIModelLoader.jsx";
import ExplanationResult from "../components/ai/ExplanationResult.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export default function ExplainBack() {
  const { route, navigate } = useNav();
  const { getEntry, evaluateExplanation } = useLearner();
  const ai = useAI();

  const [topicId, setTopicId] = useState(route.params?.topic || "newtons-second-law");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("input"); // input | loading | analyzing | result
  const [evaluation, setEvaluation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [nextDecision, setNextDecision] = useState(null);
  const [beforeMastery, setBeforeMastery] = useState(0);
  const [streamText, setStreamText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [latencyNote, setLatencyNote] = useState(null);
  const [showOriginal, setShowOriginal] = useState(true);

  const useBuiltInRef = useRef(false);
  const generatingRef = useRef(false);
  const activeTopicRef = useRef(topicId);
  const topicIdRef = useRef(topicId);
  topicIdRef.current = topicId;
  const submitTsRef = useRef(0);
  const debounceRef = useRef(null);
  // Guards every async continuation below: if the learner navigates away
  // (unmounting this page) while AI init/generation is still in flight,
  // no further state updates are attempted on the unmounted component.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const topic = findTopic(topicId);
  const entry = getEntry(topicId);
  const level = entry?.mastery < 40 ? "beginner" : entry?.mastery < 75 ? "intermediate" : "advanced";
  const path = topic ? findTopicPath(topic.id) : [];
  const words = wordCount(text);

  /* -------- PREWARM TRIGGERS (all converge on the singleton) -------- */

  // Trigger: entering ExplainBack → start AI preparation immediately.
  useEffect(() => {
    ai.prewarm();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger: the learner begins typing → ensure preparation is running.
  useEffect(() => {
    if (!text.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => ai.prewarm(), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  /** Shared evaluation runner. useAI=false forces the deterministic engine.
   * The review recommendation and next-activity decision are computed
   * once, inside evaluateExplanationAction (LearnerContext.jsx), from the
   * state that was actually just saved — this just displays them rather
   * than recomputing them from a possibly-stale local copy. */
  const runEvaluation = useCallback(
    async (useAI, onToken) => {
      const { evaluation: ev, reviewRecommendation, nextDecision: decision } = await evaluateExplanation({
        topicId: activeTopicRef.current,
        learnerExplanation: text,
        learnerLevel: level,
        preferAI: useAI,
        onToken: onToken || null,
      });
      if (!mountedRef.current) return false;
      if (activeTopicRef.current !== topicIdRef.current) return false;

      setEvaluation(ev);
      setRecommendation(reviewRecommendation);
      setNextDecision(decision);
      setPhase("result");

      const freshMetrics = getAIState().metrics;
      const genStart = freshMetrics?.generationStartAtMs;
      if (useAI && genStart) {
        setLatencyNote({
          submitToGenStartMs: Math.max(0, Math.round(genStart - submitTsRef.current)),
          genMs: freshMetrics?.lastGenerationMs ?? null,
          firstTokenMs: freshMetrics?.firstTokenMs ?? null,
        });
      }
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, level]
  );

  /**
   * SUBMIT — "Check My Understanding →".
   * - AI ready    → analyze immediately (no warm-up, ever).
   * - AI preparing→ join the SAME singleton promise (genuine cold start).
   * - AI error    → deterministic engine instantly + Retry AI.
   */
  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    useBuiltInRef.current = false;
    activeTopicRef.current = topicId;
    submitTsRef.current = performance.now();
    setStreamText("");
    setLatencyNote(null);
    setShowOriginal(true);
    setBeforeMastery(getEntry(topicId)?.mastery ?? 0);

    const withStream = (chunk) => { if (mountedRef.current) setStreamText((prev) => prev + chunk); };

    try {
      if (ai.isReady) {
        setPhase("analyzing");
        await runEvaluation(true, withStream);
      } else if (ai.preparing) {
        setPhase("loading");
        const pipe = await ai.initialize();
        if (!mountedRef.current || useBuiltInRef.current) return;
        if (pipe) {
          setPhase("analyzing");
          await runEvaluation(true, withStream);
        } else {
          await runEvaluation(false);
        }
      } else {
        setPhase(ai.isUnavailable ? "analyzing" : "loading");
        const pipe = await ai.initialize();
        if (!mountedRef.current || useBuiltInRef.current) return;
        if (pipe) {
          setPhase("analyzing");
          await runEvaluation(true, withStream);
        } else {
          await runEvaluation(false);
        }
      }
    } finally {
      generatingRef.current = false;
      if (mountedRef.current) setIsGenerating(false);
    }
  }, [ai.isReady, ai.preparing, ai.isUnavailable, topicId, text, runEvaluation, getEntry]);

  const handleUseBuiltIn = async () => {
    useBuiltInRef.current = true;
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
    setLatencyNote(null);
    setStreamText("");
    setText("");
  };

  const switchTopic = (id) => {
    setTopicId(id);
    setPhase("input");
    setEvaluation(null);
    setRecommendation(null);
    setNextDecision(null);
    setLatencyNote(null);
    setStreamText("");
    setText("");
  };

  const analyzing = phase === "analyzing";
  const afterMastery = getEntry(topicId)?.mastery ?? beforeMastery;
  const statusAfter = getEntry(topicId)?.status;

  return (
    <div>
      {/* HEADER */}
      <header className="page-header">
        <div>
          <h1 className="page-title">ExplainBack</h1>
          <p className="page-sub">Teach the concept back in your own words.</p>
        </div>
        <AIStatus />
      </header>

      {/* CONCEPT PICKER */}
      <div className="flex gap-8 wrap" style={{ marginBottom: 24 }}>
        {LEAF_TOPICS.map((t) => {
          const e = getEntry(t.id);
          const active = t.id === topicId;
          return (
            <button
              key={t.id}
              className={`chip ${active ? "active" : ""}`}
              onClick={() => switchTopic(t.id)}
              aria-pressed={active}
              disabled={isGenerating}
            >
              <span className="status-dot" style={{ background: STATUS_META[e?.status]?.color || "var(--st-new)" }} aria-hidden="true" />
              {t.name}
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
                  <span className="tiny muted">{path.map((p) => p.name).join(" • ")}</span>
                </div>
                <h2 style={{ fontSize: 24, margin: 0 }}>{topic.name}</h2>
              </div>
              <div className="flex items-center gap-8">
                <Badge tone={entry?.status === "MASTERED" ? "gold" : entry?.status === "STRONG" ? "teal" : entry?.status === "DEVELOPING" ? "blue" : entry?.status === "LEARNING" ? "amber" : "slate"}>
                  {STATUS_META[entry?.status]?.label || "New"} {entry?.mastery > 0 ? `• ${entry.mastery}%` : ""}
                </Badge>
              </div>
            </div>
          </Card>

          {/* LEARNER PROMPT + TEXTAREA */}
          <Card className="anim-rise delay-1" style={{ padding: "24px 24px 20px" }}>
            <p className="small" style={{ margin: "0 0 14px", color: "var(--c-text-dim)", fontSize: 14.5 }}>
              Imagine you're teaching this to a friend who has never seen it before.
            </p>

            <label className="label" htmlFor="explain-text" style={{ marginBottom: 8 }}>
              Your explanation
            </label>
            <textarea
              id="explain-text"
              className="textarea"
              placeholder="Start explaining here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              style={{ minHeight: 180, fontSize: 16, lineHeight: 1.7 }}
            />

            <div className="flex items-center justify-between wrap gap-12" style={{ marginTop: 12 }}>
              <div className="flex items-center gap-12">
                <span className="tiny muted" aria-live="polite">
                  {words} {words === 1 ? "word" : "words"}
                </span>
                <span className="tiny muted" aria-hidden="true">·</span>
                {ai.preparing ? (
                  <span className="tiny" style={{ color: "var(--c-amber)" }} role="status">
                    ◌ Preparing your AI tutor…
                  </span>
                ) : ai.isReady ? (
                  <span className="tiny" style={{ color: "var(--c-teal)" }} role="status">
                    ● AI ready
                  </span>
                ) : ai.isUnavailable ? (
                  <span className="tiny" style={{ color: "var(--c-rose)" }} role="status">
                    AI unavailable — built-in assessment will be used
                  </span>
                ) : null}
              </div>
              <Button
                variant="teal"
                size="lg"
                onClick={handleAnalyze}
                disabled={!text.trim() || isGenerating}
              >
                Check My Understanding →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* GENUINE COLD START — only when the model was still preparing at submit */}
      {phase === "loading" && (
        <div className="anim-fade" style={{ display: "grid", gap: 18, maxWidth: 640, margin: "0 auto" }}>
          <AIModelLoader
            status={ai.status}
            progress={ai.progress}
            model={ai.model}
            wasCached={ai.wasCached}
            webgpu={ai.webgpu}
            onRetry={handleRetryAI}
            onUseFallback={handleUseBuiltIn}
          />
          <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
            This only happens on a genuine first load. The rest of NimiqLearn stays fully usable while the AI prepares.
          </p>
        </div>
      )}

      {/* ANALYZING — generation is live; stream real tokens when available */}
      {phase === "analyzing" && topic && (
        <div className="anim-fade" style={{ display: "grid", gap: 18, maxWidth: 720, margin: "0 auto" }}>
          <Card>
            <div className="flex items-center gap-12" style={{ marginBottom: 14 }}>
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              <h3 style={{ margin: 0, fontSize: 17 }}>Analyzing your explanation…</h3>
            </div>

            {/* keep the learner's original text visible for comparison */}
            <details open={showOriginal} style={{ marginBottom: streamText ? 14 : 0 }}>
              <summary
                className="small strong"
                style={{ cursor: "pointer", color: "var(--c-text-dim)", marginBottom: 8 }}
                onClick={(e) => { e.preventDefault(); setShowOriginal((s) => !s); }}
              >
                {showOriginal ? "Hide your explanation" : "Show your explanation"}
              </summary>
              <p
                style={{
                  background: "rgba(10,15,30,0.5)",
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

            {streamText ? (
              <div
                aria-live="polite"
                style={{
                  background: "rgba(10,15,30,0.6)",
                  border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)",
                  padding: "12px 14px",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "var(--c-text-dim)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {streamText}
              </div>
            ) : (
              <div className="flex items-center gap-12 muted small">
                <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
                Checking your understanding…
              </div>
            )}

            {!ai.isReady && (
              <Button variant="ghost" size="sm" onClick={handleUseBuiltIn} style={{ marginTop: 12 }}>
                Use built-in assessment now
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
            topic={topic}
            beforeMastery={beforeMastery}
            afterMastery={afterMastery}
            statusAfter={statusAfter}
            onChallenge={() => navigate("learn", { topic: topicId })}
          />

          {latencyNote && evaluation.confidence === "model" && (
            <p className="tiny muted" style={{ margin: 0, textAlign: "center" }} aria-hidden="true">
              ⚡ Prepared ahead of time — analysis began {latencyNote.submitToGenStartMs}ms after you pressed the button
              {latencyNote.genMs ? ` and completed in ${(latencyNote.genMs / 1000).toFixed(1)}s` : ""}.
            </p>
          )}

          {evaluation.confidence === "heuristic" && (
            <div className="notice" style={{ margin: 0 }}>
              <span aria-hidden="true">🧩</span>
              <span>
                <strong>This assessment used the built-in engine.</strong>{" "}
                {evaluation.aiPending
                  ? "The AI is still loading — you can get a model assessment in a moment."
                  : "The local AI model is unavailable right now."}{" "}
                <button className="btn btn-ghost btn-sm" onClick={handleRetryAI} style={{ marginLeft: 6 }}>
                  {evaluation.aiPending ? "Retry with AI →" : "Retry AI →"}
                </button>
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
                <Badge tone={recommendation.priorityScore >= 65 ? "amber" : "teal"}>{recommendation.levelLabel}</Badge>
              </div>
              <p className="small" style={{ margin: "0 0 6px" }}>
                You should revisit this concept in <strong>{recommendation.intervalDays} day{recommendation.intervalDays === 1 ? "" : "s"}</strong>.
              </p>
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                Why? Your mastery improved, but one important concept is still developing. The schedule is computed by the app — the AI only creates review content.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("review", { topic: topicId })}>
                Review later
              </Button>
            </Card>
          )}

          {/* NEXT STEP — one clear action */}
          {nextDecision && (
            <Card className="anim-rise" style={{ borderColor: "rgba(77,141,255,0.4)" }}>
              <span className="eyebrow" style={{ marginBottom: 6 }}>Next up</span>
              <h3 style={{ fontSize: 18, margin: "0 0 4px" }}>
                {ACTIVITY_LABELS[nextDecision.activityType]}
              </h3>
              <p className="small muted" style={{ margin: "0 0 14px" }}>{nextDecision.reason}</p>
              <Button variant="primary" onClick={() => navigate("learn", { topic: topicId })}>
                Start next challenge →
              </Button>
            </Card>
          )}

          <div className="flex justify-center" style={{ marginTop: 4 }}>
            <Button variant="ghost" onClick={handleReset}>Explain another concept</Button>
          </div>
        </div>
      )}
    </div>
  );
}
