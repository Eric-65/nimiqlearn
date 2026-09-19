import React, { useCallback, useEffect, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { LEAF_TOPICS, findTopic } from "../data/mockTopics.js";
import { decideNextActivity, generateActivityContent } from "../services/learnLoopService.js";
import { computeReviewRecommendation } from "../services/forgetMeNotService.js";
import { STATUS_META } from "../services/knowledgeService.js";
import { useI18n } from "../hooks/useI18n.js";
import LearningActivity from "../components/ai/LearningActivity.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import AIStatus from "../components/ai/AIStatus.jsx";
import TopicVideo from "../components/knowledge/TopicVideo.jsx";
import LessonQuestions from "../components/knowledge/LessonQuestions.jsx";

export default function Learn() {
  const { route, navigate } = useNav();
  const { knowledge, getEntry, recordActivityResult, recordActivityCoverage, learner } = useLearner();
  const ai = useAiBackend();
  const { t, tOr } = useI18n();

  const initialTopic = route.params?.topic || null;
  const [topicId, setTopicId] = useState(initialTopic);
  const [activity, setActivity] = useState(null);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  /* Watch-first mode. A learner who opened a course from Home came to
     WATCH it; generating an activity the moment they land would put a
     question on screen they cannot answer while the lesson plays — and
     spend an AI call on it. So while `watching` is set, no activity is
     requested at all (the request is never sent, which is stronger than
     asking the model to hold back). It clears when the video ends or the
     learner presses the button under it; either way the activity is then
     generated as normal. Switching topic by chip is the normal Learn flow
     and is never held. */
  const [watching, setWatching] = useState(() => route.params?.watch === "1" && Boolean(initialTopic));

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
    if (topicId && !watching) loadActivity(topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, watching]);

  /* Choosing another topic by chip leaves watch-first mode: that is the
     ordinary Learn flow, and the hold only ever applied to the course the
     learner arrived on. */
  const pickTopic = (id) => {
    setWatching(false);
    setTopicId(id);
  };

  const finishWatching = () => setWatching(false);

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
          <h1 className="page-title">{t("nav.learn")}</h1>
          <p className="page-sub">{t("learn.sub")}</p>
        </div>
        <AIStatus />
      </header>

      {/* Topic picker */}
      <div className="flex gap-8 wrap" style={{ marginBottom: 26 }}>
        {LEAF_TOPICS.map((leaf) => {
          const e = getEntry(leaf.id);
          const active = leaf.id === topicId;
          return (
            <button
              key={leaf.id}
              className={`chip ${active ? "active" : ""}`}
              onClick={() => pickTopic(leaf.id)}
              aria-pressed={active}
            >
              <span className="status-dot" style={{ background: STATUS_META[e?.status]?.color || "var(--st-new)" }} aria-hidden="true" />
              {tOr(`topic.${leaf.id}.name`, leaf.name)}
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
                <Badge tone="blue">
                  {topic.parentId ? tOr(`topic.${topic.parentId}.name`, topic.parentName) : t("learn.concept")}
                </Badge>
                <h2 style={{ fontSize: 20, margin: "8px 0 4px" }}>{tOr(`topic.${topic.id}.name`, topic.name)}</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {tOr(`topic.${topic.id}.description`, topic.description)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge tone={entry?.status === "MASTERED" ? "gold" : entry?.status === "STRONG" ? "teal" : entry?.status === "DEVELOPING" ? "blue" : entry?.status === "LEARNING" ? "amber" : "slate"}>
                  {t(`status.${String(entry?.status || "NEW").toLowerCase()}`)}
                </Badge>
                <p className="tiny muted" style={{ margin: "6px 0 0" }}>
                  {t("learn.appMastery", { pct: entry?.mastery ?? 0 })}
                </p>
              </div>
            </div>
            <div className="flex gap-12 wrap" style={{ marginTop: 14 }}>
              <Button variant="outline" size="sm" onClick={() => navigate("explain", { topic: topicId })}>
                🗣️ {t("learn.explainConcept")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("review", { topic: topicId })}>
                ⏳ {t("learn.reviewSchedule")}
              </Button>
            </div>
          </Card>

          {/* Above the activity on purpose: a learner who has one watches it
              and then answers. Renders nothing for the many topics with no
              verified video, so their page is unchanged. */}
          <TopicVideo topicId={topicId} onEnded={finishWatching} />

          {/* Watch-first: the lesson is playing, so no activity has been
              requested. The learner moves on when the video ends, or now. */}
          {watching && (
            <div className="notice info anim-pop" role="status" style={{ margin: 0 }}>
              <span aria-hidden="true">🎬</span>
              <span>
                <strong>{t("learn.watching.title")}</strong> {t("learn.watching.body")}
              </span>
              <Button variant="teal" size="sm" onClick={finishWatching} style={{ marginLeft: "auto" }}>
                {t("learn.watching.done")}
              </Button>
            </div>
          )}

          {/* Directly under the lesson, before the activity: a learner who
              watched and did not follow something asks here, then answers.
              Present for every topic, video or not — the tutor answers from
              the topic's reference content either way. */}
          <LessonQuestions topicId={topicId} />

          {!watching && decision && activity && (
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
                    <strong>{t(feedback.correct ? "learn.feedback.ok" : "learn.feedback.miss")}</strong>{" "}
                    {feedback.delta === 0
                      ? t("learn.mastery.same", { after: feedback.after })
                      : t("review.mastery.moved", {
                          delta: feedback.delta > 0 ? `+${feedback.delta}` : feedback.delta,
                          after: feedback.after,
                        })}
                  </span>
                  <Button variant="teal" size="sm" onClick={handleNext} style={{ marginLeft: "auto" }}>
                    {t("learn.nextActivity")}
                  </Button>
                </div>
              )}
            </>
          )}

          {busy && (
            <div className="flex items-center gap-12 muted small" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              {t("learn.preparing")}
            </div>
          )}

          {!ai.checking && !ai.available && (
            <div className="notice warn anim-pop" role="status">
              <span aria-hidden="true">⚠️</span>
              <span>
                <strong>{t("ai.unavailable")}</strong> {t("learn.aiFallback")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
