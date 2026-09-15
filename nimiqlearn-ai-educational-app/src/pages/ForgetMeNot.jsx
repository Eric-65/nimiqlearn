import React, { useCallback, useEffect, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { useI18n } from "../hooks/useI18n.js";
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
  const { knowledge, recordReview, recordActivityCoverage, getEntry } = useLearner();
  const ai = useAiBackend();
  const { t, tPlural, tOr } = useI18n();

  const [activeTopicId, setActiveTopicId] = useState(route.params?.topic || null);
  const [activity, setActivity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const queue = buildReviewQueue(knowledge);
  const due = queue.filter((r) => r.dueNow);
  const active = activeTopicId ? queue.find((r) => r.topicId === activeTopicId) : null;

  const startReview = useCallback(
    async (topicId) => {
      const topic = findTopic(topicId);
      if (!topic) return;
      setActiveTopicId(topicId);
      setLastResult(null);
      setBusy(true);
      // Same persisted coverage as Learn.jsx: "Review again" on the same
      // topic must ask something new, not re-ask the last question — and
      // that memory has to survive a closed tab, not just this session.
      const e = getEntry(topicId);
      const content = await generateActivityContent({
        type: "REVIEW",
        topic,
        level: "intermediate",
        previousQuestions: e?.coveredQuestions || [],
        previousAngles: e?.coveredAngles || [],
      });
      // loadedAt keys <LearningActivity> so each review mounts fresh — see
      // the same note in Learn.jsx for the bug this prevents.
      setActivity({ ...content, activityType: "REVIEW", reasonKey: "review.reason", loadedAt: Date.now() });
      setBusy(false);
      recordActivityCoverage({ topicId, question: content.question, angle: content.angle });
    },
    [getEntry, recordActivityCoverage]
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
          <h1 className="page-title">{t("review.title")}</h1>
          <p className="page-sub">{t("review.sub")}</p>
        </div>
        <AIStatus />
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        {/* Review queue */}
        <div style={{ display: "grid", gap: 14 }}>
          {queue.length === 0 && (
            <Card><p className="small muted" style={{ margin: 0 }}>{t("review.empty")}</p></Card>
          )}

          {queue.map((r) => (
            <Card key={r.topicId} hover style={{ padding: 16, borderColor: activeTopicId === r.topicId ? "rgba(77,141,255,0.5)" : undefined, opacity: r.mastery === 0 ? 0.75 : 1 }}>
              <div className="flex items-center justify-between wrap gap-12">
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div className="flex items-center gap-8 wrap">
                    <span className="strong" style={{ fontSize: 15 }}>{tOr(`topic.${r.topicId}.name`, r.topicName)}</span>
                    <Badge tone={r.priorityScore >= 80 ? "rose" : r.priorityScore >= 65 ? "amber" : r.priorityScore >= 40 ? "blue" : "teal"}>
                      {t(r.levelKey)}
                    </Badge>
                    {r.dueNow && <Badge tone="gold" dot>{t("review.due")}</Badge>}
                  </div>
                  <p className="tiny muted" style={{ margin: "6px 0 10px" }}>
                    {t("review.meta", { days: r.daysSinceReview, next: r.intervalDays, mastery: r.mastery })}
                  </p>
                  <ProgressBar value={r.priorityScore} tone="gold" ariaLabel={t("review.priorityAria", { score: r.priorityScore })} />
                </div>
                <Button variant={r.dueNow ? "primary" : "outline"} size="sm" onClick={() => startReview(r.topicId)}>
                  {t("review.now")}
                </Button>
              </div>
            </Card>
          ))}

          <div className="notice" style={{ margin: 0 }}>
            <span aria-hidden="true">🧮</span>
            <span>
              <strong>{t("review.howTitle")}</strong> {t("review.howBody")}
            </span>
          </div>
        </div>

        {/* Active review */}
        <div style={{ display: "grid", gap: 14, position: "sticky", top: 84 }}>
          {active && !activity && !lastResult && (
            <Card>
              <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>{tOr(`topic.${active.topicId}.name`, active.topicName)}</h3>
              <p className="small muted" style={{ margin: 0 }}>{t("review.priorityReady", { score: active.priorityScore })}</p>
              <Button variant="primary" className="mt-16" onClick={() => startReview(active.topicId)}>{t("review.start")}</Button>
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
              {t("review.preparing")}
            </div>
          )}

          {!ai.checking && !ai.available && (
            <div className="notice warn anim-pop" role="status">
              <span aria-hidden="true">⚠️</span>
              <span>
                <strong>{t("ai.unavailable")}</strong> {t("review.aiFallback")}
              </span>
            </div>
          )}

          {lastResult && (
            <div className={`notice ${lastResult.correct ? "success" : "warn"} anim-pop`} role="status">
              <span aria-hidden="true">{lastResult.correct ? "🧠" : "🔁"}</span>
              <span>
                <strong>{t(lastResult.correct ? "review.result.ok" : "review.result.again")}</strong>{" "}
                {lastResult.delta === 0
                  ? t("review.mastery.same", { after: lastResult.after })
                  : t("review.mastery.moved", {
                      delta: lastResult.delta > 0 ? `+${lastResult.delta}` : lastResult.delta,
                      after: lastResult.after,
                    })}{" "}
                {t("review.scheduleUpdated")}
              </span>
              <Button variant="outline" size="sm" onClick={() => startReview(lastResult.topicId)} style={{ marginLeft: "auto" }}>
                {t("review.again")}
              </Button>
            </div>
          )}

          {due.length > 0 && (
            <Card style={{ background: "rgba(247,193,79,0.06)", borderColor: "rgba(247,193,79,0.3)" }}>
              <p className="small" style={{ margin: 0 }}>
                <strong>{tPlural("review.dueNow", due.length)}</strong> {t("review.dueNow.hint")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
