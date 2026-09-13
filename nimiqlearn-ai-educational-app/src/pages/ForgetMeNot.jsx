import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { findTopic } from "../data/mockTopics.js";
import { buildReviewQueue } from "../services/forgetMeNotService.js";
import { generateActivityContent } from "../services/learnLoopService.js";
import LearningActivity from "../components/ai/LearningActivity.jsx";
import AIStatus from "../components/ai/AIStatus.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";

export default function ForgetMeNot() {
  const { route } = useNav();
  const { knowledge, recordReview, getEntry } = useLearner();
  const ai = useAiBackend();

  const [activeTopicId, setActiveTopicId] = useState(route.params?.topic || null);
  const [activity, setActivity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const queue = buildReviewQueue(knowledge);
  const due = queue.filter((r) => r.dueNow);
  const active = activeTopicId ? queue.find((r) => r.topicId === activeTopicId) : null;

  // Same session-only coverage tracking as Learn.jsx: "Review again" on the
  // same topic must ask something new, not re-ask the last question.
  const coveredRef = useRef({});

  const startReview = useCallback(
    async (topicId) => {
      const topic = findTopic(topicId);
      if (!topic) return;
      setActiveTopicId(topicId);
      setLastResult(null);
      setBusy(true);
      const covered = coveredRef.current[topicId] || { questions: [], angles: [] };
      const content = await generateActivityContent({
        type: "REVIEW",
        topic,
        level: "intermediate",
        previousQuestions: covered.questions,
        previousAngles: covered.angles,
      });
      // loadedAt keys <LearningActivity> so each review mounts fresh — see
      // the same note in Learn.jsx for the bug this prevents.
      setActivity({ ...content, activityType: "REVIEW", reason: "ForgetMeNot scheduled this for reinforcement.", loadedAt: Date.now() });
      setBusy(false);
      coveredRef.current[topicId] = {
        questions: content.question ? [...covered.questions, content.question].slice(-10) : covered.questions,
        angles: content.angle ? [...covered.angles, content.angle].slice(-10) : covered.angles,
      };
    },
    []
  );

  useEffect(() => {
    if (route.params?.topic) startReview(route.params.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (correct) => {
    if (!activeTopicId) return;
    const result = recordReview({
      topicId: activeTopicId,
      correct,
      optionCount: Array.isArray(activity?.options) ? activity.options.length : null,
    });
    setLastResult({ correct, topicId: activeTopicId, delta: result?.delta ?? 0, after: result?.after ?? 0 });
    setActivity(null);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">ForgetMeNot AI</h1>
          <p className="page-sub">Transparent spaced review. The app schedules reinforcement from your mastery, recency, and recent mistakes — the AI only writes the review content, never the timing.</p>
        </div>
        <AIStatus />
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* Review queue */}
        <div style={{ display: "grid", gap: 14 }}>
          {queue.length === 0 && (
            <Card><p className="small muted" style={{ margin: 0 }}>Nothing to review yet — evaluate a concept first.</p></Card>
          )}

          {queue.map((r) => (
            <Card key={r.topicId} hover style={{ padding: 16, borderColor: activeTopicId === r.topicId ? "rgba(77,141,255,0.5)" : undefined, opacity: r.mastery === 0 ? 0.75 : 1 }}>
              <div className="flex items-center justify-between wrap gap-12">
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div className="flex items-center gap-8 wrap">
                    <span className="strong" style={{ fontSize: 15 }}>{r.topicName}</span>
                    <Badge tone={r.priorityScore >= 80 ? "rose" : r.priorityScore >= 65 ? "amber" : r.priorityScore >= 40 ? "blue" : "teal"}>
                      {r.levelLabel}
                    </Badge>
                    {r.dueNow && <Badge tone="gold" dot>Due</Badge>}
                  </div>
                  <p className="tiny muted" style={{ margin: "6px 0 10px" }}>
                    {r.daysSinceReview}d since last review • next in {r.intervalDays}d • mastery {r.mastery}%
                  </p>
                  <ProgressBar value={r.priorityScore} tone="gold" ariaLabel={`Review priority ${r.priorityScore} percent`} />
                </div>
                <Button variant={r.dueNow ? "primary" : "outline"} size="sm" onClick={() => startReview(r.topicId)}>
                  Review now
                </Button>
              </div>
            </Card>
          ))}

          <div className="notice" style={{ margin: 0 }}>
            <span aria-hidden="true">🧮</span>
            <span>
              <strong>How priority is computed:</strong> 40% mastery gap + 30% overdue time + 20% recent failures − 10% review stability. Deterministic, visible, and owned by the app.
            </span>
          </div>
        </div>

        {/* Active review */}
        <div style={{ display: "grid", gap: 14, position: "sticky", top: 84 }}>
          {active && !activity && !lastResult && (
            <Card>
              <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>{active.topicName}</h3>
              <p className="small muted" style={{ margin: 0 }}>Priority {active.priorityScore}/100 — ready when you are.</p>
              <Button variant="primary" className="mt-16" onClick={() => startReview(active.topicId)}>Start review</Button>
            </Card>
          )}

          {activity && (
            <LearningActivity
              key={activity.loadedAt}
              activity={activity}
              onAnswer={handleAnswer}
              busy={busy}
              aiConfigured={ai.available}
              onRetryAI={() => startReview(activeTopicId)}
            />
          )}

          {busy && (
            <div className="flex items-center gap-12 muted small" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              Preparing review…
            </div>
          )}

          {!ai.checking && !ai.available && (
            <div className="notice warn anim-pop" role="status">
              <span aria-hidden="true">⚠️</span>
              <span>
                <strong>AI unavailable right now.</strong> Reviews use built-in recall prompts — your schedule is unaffected.
              </span>
            </div>
          )}

          {lastResult && (
            <div className={`notice ${lastResult.correct ? "success" : "warn"} anim-pop`} role="status">
              <span aria-hidden="true">{lastResult.correct ? "🧠" : "🔁"}</span>
              <span>
                <strong>{lastResult.correct ? "Recalled — interval extended." : "Needs another pass — priority raised."}</strong>{" "}
                {lastResult.delta > 0
                  ? `Mastery +${lastResult.delta} → ${lastResult.after}%.`
                  : lastResult.delta < 0
                  ? `Mastery ${lastResult.delta} → ${lastResult.after}%.`
                  : `Mastery stays at ${lastResult.after}%.`}{" "}
                The review schedule updated automatically.
              </span>
              <Button variant="outline" size="sm" onClick={() => startReview(lastResult.topicId)} style={{ marginLeft: "auto" }}>
                Review again
              </Button>
            </div>
          )}

          {due.length > 0 && (
            <Card style={{ background: "rgba(247,193,79,0.06)", borderColor: "rgba(247,193,79,0.3)" }}>
              <p className="small" style={{ margin: 0 }}>
                <strong>{due.length} topic{due.length > 1 ? "s" : ""} due now.</strong> A 3-minute review now beats a re-teach later.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
