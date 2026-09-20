import React, { useCallback, useEffect, useRef, useState } from "react";
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
import NimiqVideo from "../components/knowledge/NimiqVideo.jsx";
import { selectVideo } from "../services/videoService.js";
import { primaryVideoForTopic } from "../data/nimiqVideos.js";
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

  /* THE LESSON LOOP — two phases, and never both at once.
     ------------------------------------------------------------------
       "watching"   — the video and its "I've watched it" button, alone.
                      No activity is requested and the question box is not
                      rendered. Not requesting is a stronger guarantee
                      than asking the model to hold back, and it spends no
                      AI call on a question nobody can answer mid-video.
       "practising" — the activity and the question box, alone. No video.

     There is no third state. A video and a question on screen together
     ask the learner to do two things at once, and whichever they start
     the other is a distraction sitting under it — which is exactly what
     the Learn tab was doing.

     WHERE THE VIDEO FALLS depends on how they arrived, because the two
     entry points mean different things:

       from a course card (?watch=1) — they came TO watch. Video first,
         then the loop.
       from a topic chip             — they came to practise. A question
         first; the video arrives after the first one is answered, as the
         teaching that explains what they have just been asked. Then the
         loop continues.

     After the video has been shown once for a topic it does not
     interrupt again in this visit; the loop is question → question →
     question from there. */
  const [lessonPhase, setLessonPhase] = useState(() =>
    route.params?.watch === "1" && initialTopic ? "watching" : "practising"
  );
  const watching = lessonPhase === "watching";
  const practising = lessonPhase === "practising";
  /* The spoken language of the card the learner came from, so the video
     shown here is the one they chose — a German course opened from an
     English UI must not silently become "no video" or an English one. */
  const chosenLanguage = route.params?.lang || null;

  /* Topics whose video has already been shown in this visit. A ref, not
     state: changing it must never re-render on its own, it only ever
     answers "has this already interrupted them?" at the moment the
     learner asks for the next activity. */
  const videoShown = useRef(new Set());
  const answered = useRef(0);

  /* Which video, if any, this concept has. Nimiq concepts carry official
     Nimiq ones; the rest carry the verified Wikimedia library. Both are
     gated on verification, so most topics have none and the loop is
     simply question → question. */
  const nimiqVideo = topicId ? primaryVideoForTopic(topicId) : null;
  const hasVideo = Boolean(nimiqVideo || (topicId && selectVideo(topicId, undefined)));

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

  /* A chip is someone choosing to practise a concept, so that is where
     they land — the video comes after their first answer. The counters
     reset because this is a new concept's loop, not a continuation. */
  const pickTopic = (id) => {
    answered.current = 0;
    setFeedback(null);
    setLessonPhase("practising");
    setTopicId(id);
  };

  /* "I've watched it — practise". Removes the video immediately and hands
     the screen back to the loop; the effect above then requests the next
     activity, because `watching` has just become false. Marking the topic
     stops the video interrupting again this visit. */
  const startPractising = () => {
    if (topicId) videoShown.current.add(topicId);
    setLessonPhase("practising");
  };

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

  /* The loop's hinge. After an answer, the learner either gets the video
     (once, and only if the concept has one) or the next question — never
     the two together. */
  const handleNext = () => {
    setFeedback(null);
    if (hasVideo && !videoShown.current.has(topicId)) {
      /* Clearing the activity is what makes the swap total: the question
         leaves the screen in the same moment the video arrives. */
      setActivity(null);
      setDecision(null);
      setLessonPhase("watching");
      return;
    }
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

          {/* WATCHING — the video and its button, and nothing else. No
              activity is requested in this phase and the question box is
              not rendered, so there is never a second thing on screen
              competing with the lesson. */}
          {watching && (
            <>
              {nimiqVideo ? (
                <NimiqVideo topicId={topicId} />
              ) : (
                <TopicVideo topicId={topicId} audioLanguage={chosenLanguage} />
              )}

              <div className="notice info anim-pop" role="status" style={{ margin: 0 }}>
                <span aria-hidden="true">🎬</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{t("learn.watching.title")}</strong> {t("learn.watching.body")}
                  {/* Below the text, not beside it: beside it, a phone
                      squeezed the button into a four-line column. */}
                  <div style={{ marginTop: 12 }}>
                    <Button variant="teal" size="sm" onClick={startPractising}>
                      {t("learn.watching.done")}
                    </Button>
                  </div>
                </span>
              </div>
            </>
          )}

          {/* PRACTISING — the question, and the place to ask about it.
              Both belong to the same moment: the learner is working on
              something and may want to ask about the thing they are
              working on. Neither is on screen while the video is. */}
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

              {/* A learner part-way through a question who did not follow
                  something asks here. Present for every topic, video or
                  not — the tutor answers from the concept's reference
                  content either way. */}
              <LessonQuestions topicId={topicId} />

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
