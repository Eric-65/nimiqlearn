import React, { useCallback, useEffect, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { useI18n } from "../hooks/useI18n.js";
import { findTopic } from "../data/mockTopics.js";
import { buildReviewQueue, buildReviewSections } from "../services/forgetMeNotService.js";
import { STAGE_LABEL_KEYS, STAGE_COLORS, deriveMasteryStage } from "../services/masteryService.js";
import { generateActivityContent } from "../services/learnLoopService.js";
import LearningActivity from "../components/ai/LearningActivity.jsx";
import AIStatus from "../components/ai/AIStatus.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";

/**
 * One row of the queue.
 *
 * Carries the concept's mastery STAGE, not just a percentage: "Can
 * explain, review due" tells a learner what they are protecting, where
 * "62%" tells them a number. And it says WHY it is here — a misconception
 * reads differently from a fading memory, and they are not repaired the
 * same way.
 */
function ReviewRow({ row, stage, active, onStart, primary = false, t, tOr, tPlural }) {
  return (
    <Card hover style={{ padding: 16, borderColor: active ? "rgba(77,141,255,0.5)" : undefined }}>
      <div className="flex items-center justify-between wrap gap-12">
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="flex items-center gap-8 wrap">
            <span className="status-dot" style={{ background: STAGE_COLORS[stage] }} aria-hidden="true" />
            <span className="strong" style={{ fontSize: 15 }}>{tOr(`topic.${row.topicId}.name`, row.topicName)}</span>
            <Badge tone={stage === "MASTERED" ? "gold" : stage === "CAN_APPLY" || stage === "CAN_EXPLAIN" ? "teal" : stage === "CAN_RECALL" ? "blue" : "slate"}>
              {t(STAGE_LABEL_KEYS[stage] || STAGE_LABEL_KEYS.NEW)}
            </Badge>
            {row.hasMisconception && <Badge tone="rose">{t("review.badge.misconception")}</Badge>}
          </div>

          <p className="small" style={{ margin: "8px 0 4px", color: "var(--c-text-dim)" }}>
            {/* The day count goes through the plural machinery as a
                phrase ("3 days ago" / "1 day ago") rather than as a bare
                number dropped into a sentence — the "1 days" bug. */}
            {t(row.reasonKey, { ago: tPlural("date.daysAgo", row.daysSinceReview || 0) })}
          </p>
          <p className="tiny muted" style={{ margin: "0 0 10px" }}>
            {t("review.meta", { days: row.daysSinceReview, next: row.intervalDays, mastery: row.mastery })}
          </p>
          <ProgressBar value={row.priorityScore} tone="gold" ariaLabel={t("review.priorityAria", { score: row.priorityScore })} />
        </div>
        <Button variant={primary ? "primary" : "outline"} size="sm" onClick={onStart}>
          {t("review.now")}
        </Button>
      </div>
    </Card>
  );
}

export default function ForgetMeNot() {
  const { route } = useNav();
  const { knowledge, recordReview, recordActivityCoverage, getEntry } = useLearner();
  const ai = useAiBackend();
  const { t, tPlural, tOr } = useI18n();

  const [activeTopicId, setActiveTopicId] = useState(route.params?.topic || null);
  const [activity, setActivity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  /* Three sections rather than one ranked list — see buildReviewSections.
     `queue` stays flat only to find the active row by id. */
  const sections = buildReviewSections(knowledge);
  const queue = buildReviewQueue(knowledge);
  const due = sections.due;
  const active = activeTopicId ? queue.find((r) => r.topicId === activeTopicId) : null;
  const stageOf = (topicId) => {
    const entry = knowledge.find((k) => k.topicId === topicId);
    return entry?.masteryStage || deriveMasteryStage(entry || {});
  };

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
          {!sections.due.length && !sections.upcoming.length && (
            <Card><p className="small muted" style={{ margin: 0 }}>{t("review.empty")}</p></Card>
          )}

          {/* DUE — the only section that is work. Anything a learner can
              act on right now, most costly first. */}
          {sections.due.length > 0 && (
            <>
              <h2 className="review-section-heading">{t("review.section.due", { count: sections.due.length })}</h2>
              {sections.due.map((r) => (
                <ReviewRow
                  key={r.topicId}
                  row={r}
                  stage={stageOf(r.topicId)}
                  active={activeTopicId === r.topicId}
                  onStart={() => startReview(r.topicId)}
                  primary
                  t={t}
                  tOr={tOr}
                  tPlural={tPlural}
                />
              ))}
            </>
          )}

          {/* UPCOMING — the schedule, soonest first. Visible so the learner
              can see the system working, but deliberately quiet: reviewing
              something before its window undoes the spacing that makes it
              work. */}
          {sections.upcoming.length > 0 && (
            <>
              <h2 className="review-section-heading">{t("review.section.upcoming")}</h2>
              {sections.upcoming.slice(0, 6).map((r) => (
                <ReviewRow
                  key={r.topicId}
                  row={r}
                  stage={stageOf(r.topicId)}
                  active={activeTopicId === r.topicId}
                  onStart={() => startReview(r.topicId)}
                  t={t}
                  tOr={tOr}
                  tPlural={tPlural}
                />
              ))}
            </>
          )}

          {/* UNSTARTED — not reviews. Named, not listed: a queue that
              offers to "review" something never opened is why the old flat
              list disagreed with Today's Plan. */}
          {sections.unstarted.length > 0 && (
            <p className="tiny muted" style={{ margin: 0 }}>
              {t("review.unstarted", { count: sections.unstarted.length })}
            </p>
          )}

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
