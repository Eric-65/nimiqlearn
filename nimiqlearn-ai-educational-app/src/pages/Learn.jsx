import React, { useCallback, useEffect, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { LEAF_TOPICS, findTopic } from "../data/mockTopics.js";
import { decideNextActivity, generateActivityContent } from "../services/learnLoopService.js";
import { computeReviewRecommendation } from "../services/forgetMeNotService.js";
import { STATUS_META } from "../services/knowledgeService.js";
import LearningActivity from "../components/ai/LearningActivity.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import AIStatus from "../components/ai/AIStatus.jsx";

export default function Learn() {
  const { route, navigate } = useNav();
  const { knowledge, getEntry, recordActivityResult, recordActivityCoverage, learner } = useLearner();
  const ai = useAiBackend();

  const initialTopic = route.params?.topic || null;
  const [topicId, setTopicId] = useState(initialTopic);
  const [activity, setActivity] = useState(null);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const topic = topicId ? findTopic(topicId) : null;
  const entry = topicId ? getEntry(topicId) : null;

  const loadActivity = useCallback(
    async (tid) => {
      const t = findTopic(tid);
      const e = getEntry(tid);
      if (!t) return;
      const rec = computeReviewRecommendation(e);
      const d = decideNextActivity({
        topic: t,
        knowledge: e,
        history: learner.history.filter((h) => h.topicId === tid).slice(0, 12),
        reviewDue: rec.dueNow,
        reviewPriority: rec.priorityScore,
        studyMinutes: Math.max(3, Math.round(learner.studyMinutes / 60)),
      });
      setDecision(d);
      setFeedback(null);
      setBusy(true);
      // What this learner has already been asked on this topic — both the
      // questions and the sub-aspect ("angle") each activity taught — so
      // "Next activity" covers genuinely new ground. Persisted on the
      // knowledge entry (not a session-only ref): a returning learner
      // reopening the app the next day should not get the same activity
      // they already had last time.
      const content = await generateActivityContent({
        type: d.activityType,
        topic: t,
        level: entry?.mastery < 40 ? "beginner" : "intermediate",
        targetMisconception: d.targetMisconception,
        previousQuestions: e?.coveredQuestions || [],
        previousAngles: e?.coveredAngles || [],
      });
      // loadedAt keys the <LearningActivity> below so React MOUNTS A FRESH
      // ONE per activity. Without it the same instance is reused, and its
      // internal "which option did I pick" state carries over — every
      // activity after the first rendered already-answered: options
      // disabled, one pre-ticked, no way to answer, no Next button.
      setActivity({ ...d, ...content, loadedAt: Date.now() });
      setBusy(false);
      recordActivityCoverage({ topicId: tid, question: content.question, angle: content.angle });
    },
    [learner.history, getEntry, recordActivityCoverage]
  );

  useEffect(() => {
    if (topicId) loadActivity(topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const handleAnswer = (correct, text) => {
    if (!topicId) return;
    if (activity?.activityType === "EXPLAIN_BACK") {
      // Hand off to the full ExplainBack evaluation — mastery updates there.
      navigate("explain", { topic: topicId });
      return;
    }
    const result = recordActivityResult({
      topicId,
      correct,
      activityType: activity?.activityType,
      optionCount: Array.isArray(activity?.options) ? activity.options.length : null,
    });
    setFeedback({ correct, text, delta: result?.delta ?? 0, after: result?.after ?? 0 });
  };

  const handleNext = () => {
    setFeedback(null);
    loadActivity(topicId);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Learn</h1>
          <p className="page-sub">LearnLoop picks the next activity from your knowledge state. The AI generates the content; the loop decides the move.</p>
        </div>
        <AIStatus />
      </header>

      {/* Topic picker */}
      <div className="flex gap-8 wrap" style={{ marginBottom: 26 }}>
        {LEAF_TOPICS.map((t) => {
          const e = getEntry(t.id);
          const active = t.id === topicId;
          return (
            <button
              key={t.id}
              className={`chip ${active ? "active" : ""}`}
              onClick={() => setTopicId(t.id)}
              aria-pressed={active}
            >
              <span className="status-dot" style={{ background: STATUS_META[e?.status]?.color || "var(--st-new)" }} aria-hidden="true" />
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Gated on the topic only, never on `entry`: a topic the learner has
          never opened has no knowledge entry yet, and requiring one here
          left every not-yet-started topic rendering a blank page. */}
      {topic && (
        <div style={{ display: "grid", gap: 18 }}>
          <Card>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <Badge tone="blue">{topic.parentName || "Concept"}</Badge>
                <h2 style={{ fontSize: 20, margin: "8px 0 4px" }}>{topic.name}</h2>
                <p className="small muted" style={{ margin: 0 }}>{topic.description}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge tone={entry?.status === "MASTERED" ? "gold" : entry?.status === "STRONG" ? "teal" : entry?.status === "DEVELOPING" ? "blue" : entry?.status === "LEARNING" ? "amber" : "slate"}>
                  {STATUS_META[entry?.status]?.label || "New"}
                </Badge>
                <p className="tiny muted" style={{ margin: "6px 0 0" }}>App mastery: {entry?.mastery ?? 0}%</p>
              </div>
            </div>
            <div className="flex gap-12 wrap" style={{ marginTop: 14 }}>
              <Button variant="outline" size="sm" onClick={() => navigate("explain", { topic: topicId })}>
                🗣️ Explain this concept
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("review", { topic: topicId })}>
                ⏳ Review schedule
              </Button>
            </div>
          </Card>

          {decision && activity && (
            <>
              <LearningActivity
                key={activity.loadedAt}
                activity={activity}
                onAnswer={handleAnswer}
                busy={busy}
                aiConfigured={ai.available}
                onRetryAI={() => loadActivity(topicId)}
              />

              {feedback && (
                <div className={`notice ${feedback.correct ? "success" : "warn"} anim-pop`} role="status">
                  <span aria-hidden="true">{feedback.correct ? "✅" : "🔁"}</span>
                  <span>
                    <strong>{feedback.correct ? "Nice — that's locked in." : "Good try — the loop will target this."}</strong>{" "}
                    {feedback.delta > 0
                      ? `Mastery +${feedback.delta} → ${feedback.after}%.`
                      : feedback.delta < 0
                      ? `Mastery ${feedback.delta} → ${feedback.after}%.`
                      : `Mastery stays at ${feedback.after}% — nothing to lose yet.`}
                  </span>
                  <Button variant="teal" size="sm" onClick={handleNext} style={{ marginLeft: "auto" }}>
                    Next activity →
                  </Button>
                </div>
              )}
            </>
          )}

          {busy && (
            <div className="flex items-center gap-12 muted small" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              Preparing your next activity…
            </div>
          )}

          {!ai.checking && !ai.available && (
            <div className="notice warn anim-pop" role="status">
              <span aria-hidden="true">⚠️</span>
              <span>
                <strong>AI unavailable right now.</strong> Activities are using built-in templates — everything keeps working.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
