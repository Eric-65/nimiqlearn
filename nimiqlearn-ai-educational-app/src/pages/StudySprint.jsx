import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useAiBackend } from "../hooks/useAiBackend.js";
import { useI18n } from "../hooks/useI18n.js";
import { findTopic } from "../data/mockTopics.js";
import { decideNextActivity, generateActivityContent } from "../services/learnLoopService.js";
import { computeReviewRecommendation } from "../services/forgetMeNotService.js";
import { recommendNextAction, difficultyFor } from "../services/coachService.js";
import {
  STAGE_LABEL_KEYS,
  STAGE_COLORS,
  nextEvidenceNeeded,
  deriveMasteryStage,
  STAGE_RANK,
} from "../services/masteryService.js";
import { selectVideo } from "../services/videoService.js";
import LearningActivity from "../components/ai/LearningActivity.jsx";
import TopicVideo from "../components/knowledge/TopicVideo.jsx";
import NimiqVideo from "../components/knowledge/NimiqVideo.jsx";
import NimiqPractical, { hasPracticalActivity } from "../components/knowledge/NimiqPractical.jsx";
import { primaryVideoForTopic } from "../data/nimiqVideos.js";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";

/**
 * Study Sprint — one short, complete pass at a concept.
 *
 * The app already had all the pieces (a video, a generated activity,
 * ExplainBack, a review schedule) and made the learner assemble them by
 * navigating between four pages. A sprint is those pieces in the order
 * that teaches, on one screen, ending with what actually changed.
 *
 * WHAT IT CONTAINS IS NOT FIXED. The coach says which demonstration this
 * concept needs next, and the sprint includes only the steps that serve
 * it: a learner who can already recall something does not sit through the
 * video again, and one who has never seen it is not asked to explain it
 * back. Every sprint ends with the ledger check, because "what changed" is
 * the whole reason to have spent the five minutes.
 *
 * Content comes from NimiqLearn AI through the existing backend
 * (generateActivityContent -> /api/learn/activity, evaluateExplanation ->
 * /api/assess/feedback). Nothing here calls a model directly and nothing
 * here holds a key; when the backend is unreachable both fall back to the
 * deterministic templates that were already there, so a sprint always
 * completes.
 */

const STEPS = {
  LESSON: "lesson",
  ACTIVITY: "activity",
  EXPLAIN: "explain",
  /* Only the Nimiq track has one of these today: a safe, real wallet
     interaction. It sits AFTER the question, not before — doing the thing
     lands better once you have had to retrieve what it is. */
  PRACTICAL: "practical",
  DONE: "done",
};

export default function StudySprint() {
  const { route, navigate } = useNav();
  const { knowledge, dueNow, learner, getEntry, recordActivityResult, recordActivityCoverage, evaluateExplanation } = useLearner();
  const ai = useAiBackend();
  const { t, tOr } = useI18n();

  /* The topic comes from the route when Today's Plan sent us here; with no
     topic we ask the coach ourselves, so the page is never a dead end. */
  const routeTopic = route.params?.topic || null;
  const plan = useMemo(
    () => (routeTopic ? null : recommendNextAction({ knowledge, dueNow, learner })),
    [routeTopic, knowledge, dueNow, learner]
  );
  const topicId = routeTopic || plan?.topicId || null;
  const topic = topicId ? findTopic(topicId) : null;

  /* The entry as it was when the sprint OPENED. The ending screen compares
     against this, so "what changed" is this session's change and not a
     running total. */
  const openedWith = useRef(null);
  const entry = topicId ? getEntry(topicId) : null;
  if (topicId && openedWith.current?.topicId !== topicId) {
    openedWith.current = { topicId, stage: entry?.masteryStage || deriveMasteryStage(entry || {}), mastery: entry?.mastery ?? 0 };
  }

  const needed = nextEvidenceNeeded(entry || {});
  /* Two libraries, one question: is there a lesson video for this concept?
     Curriculum topics have Wikimedia ones; Nimiq topics have official
     Nimiq ones embedded from YouTube. Both are gated on verification, so
     "no video" is the common case and the sprint is built for it. */
  const nimiqVideo = topicId ? primaryVideoForTopic(topicId) : null;
  const hasVideo = Boolean(nimiqVideo || (topicId && selectVideo(topicId, undefined)));

  const [step, setStep] = useState(null);
  const [activity, setActivity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [explainResult, setExplainResult] = useState(null);
  const [explainError, setExplainError] = useState(null);

  /* Which steps this sprint runs, decided once from the concept's state.
     A sprint is short because it leaves out what the learner has already
     shown, not because it does less of everything. */
  const steps = useMemo(() => {
    if (!topicId) return [];
    const stage = entry?.masteryStage || deriveMasteryStage(entry || {});
    const list = [];
    if (hasVideo && STAGE_RANK[stage] < STAGE_RANK.CAN_RECALL) list.push(STEPS.LESSON);
    list.push(STEPS.ACTIVITY);
    if (needed.kind === "EXPLAIN") list.push(STEPS.EXPLAIN);
    if (hasPracticalActivity(topicId)) list.push(STEPS.PRACTICAL);
    list.push(STEPS.DONE);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    if (steps.length && step === null) setStep(steps[0]);
  }, [steps, step]);

  const advance = () => {
    const i = steps.indexOf(step);
    setStep(steps[Math.min(i + 1, steps.length - 1)]);
  };

  /* One AI call per sprint, made when the activity step is reached — never
     on arrival, so a learner who watches the lesson first does not have a
     question generated they may never see. */
  const loadActivity = useCallback(async () => {
    if (!topic) return;
    const e = getEntry(topicId);
    const rec = computeReviewRecommendation(e);
    const decision = decideNextActivity({
      topic,
      knowledge: e,
      history: (learner.history || []).filter((h) => h.topicId === topicId).slice(0, 12),
      reviewDue: rec.dueNow,
      reviewPriority: rec.priorityScore,
      studyMinutes: Math.max(3, Math.round((learner.studyMinutes || 30) / 60)),
    });
    setBusy(true);
    /* Difficulty comes from the evidence, not from the last answer alone —
       see difficultyFor(). FOUNDATION/STANDARD/CHALLENGE map onto the
       levels the backend prompt already understands. */
    const level = { FOUNDATION: "beginner", STANDARD: "intermediate", CHALLENGE: "advanced" }[difficultyFor(e)] || "beginner";
    const content = await generateActivityContent({
      type: decision.activityType,
      topic,
      level,
      targetMisconception: decision.targetMisconception,
      previousQuestions: e?.coveredQuestions || [],
      previousAngles: e?.coveredAngles || [],
    });
    setActivity({ ...decision, ...content, loadedAt: Date.now() });
    setBusy(false);
    recordActivityCoverage({ topicId, question: content.question, angle: content.angle });
  }, [topic, topicId, getEntry, learner.history, learner.studyMinutes, recordActivityCoverage]);

  useEffect(() => {
    if (step === STEPS.ACTIVITY && !activity && !busy) loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleAnswer = (correct) => {
    const result = recordActivityResult({
      topicId,
      correct,
      activityType: activity?.activityType,
      optionCount: Array.isArray(activity?.options) ? activity.options.length : null,
    });
    setAnswered({ correct, ...result });
  };

  const submitExplanation = async () => {
    if (!explanation.trim()) return;
    setBusy(true);
    setExplainError(null);
    try {
      const res = await evaluateExplanation({ topicId, learnerExplanation: explanation });
      /* The action returns the whole pipeline result; the graded assessment
         itself is under `evaluation` (see LearnerContext). Reading the
         wrapper directly silently found no misconceptions, because they
         were one level down. */
      setExplainResult(res?.evaluation || null);
      advance();
    } catch (err) {
      /* The learner's words are never thrown away on a failed request —
         `explanation` is untouched, so Retry resubmits exactly what they
         wrote rather than asking them to type it again. */
      setExplainError(err?.message || t("sprint.explainFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!topic) {
    return (
      <div>
        <header className="page-header">
          <h1 className="page-title">{t("sprint.title")}</h1>
        </header>
        <Card>
          <p className="muted">{t("sprint.noTopic")}</p>
          <Button variant="teal" size="sm" onClick={() => navigate("learn")}>{t("sprint.browse")}</Button>
        </Card>
      </div>
    );
  }

  const topicName = tOr(`topic.${topicId}.name`, topic.name);
  const stageNow = entry?.masteryStage || deriveMasteryStage(entry || {});
  const position = Math.max(1, steps.indexOf(step) + 1);

  return (
    <div className="sprint">
      <header className="page-header">
        <div>
          <p className="page-sub" style={{ margin: 0 }}>{t("sprint.title")}</p>
          <h1 className="page-title" style={{ margin: "2px 0 0" }}>{topicName}</h1>
        </div>
        <Badge tone="slate">{t("sprint.step", { n: position, total: steps.length })}</Badge>
      </header>

      {/* A plain bar, not a chart: how far through the sprint they are. */}
      <div className="sprint-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={position}>
        <span style={{ width: `${(position / steps.length) * 100}%` }} />
      </div>

      {step === STEPS.LESSON && (
        <div className="sprint-step">
          {/* An official Nimiq video when the concept has one, otherwise
              the curriculum's own. Never both: a lesson opens with one
              thing to watch. */}
          {nimiqVideo ? <NimiqVideo topicId={topicId} /> : <TopicVideo topicId={topicId} />}
          <Card>
            <p style={{ margin: "0 0 12px" }}>{t("sprint.lessonBody")}</p>
            <Button variant="teal" onClick={advance}>{t("sprint.lessonDone")}</Button>
          </Card>
        </div>
      )}

      {step === STEPS.ACTIVITY && (
        <div className="sprint-step">
          {busy && !activity && (
            <div className="flex items-center gap-12 muted small" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              {t("learn.preparing")}
            </div>
          )}
          {activity && (
            <LearningActivity
              key={activity.loadedAt}
              activity={activity}
              onAnswer={handleAnswer}
              busy={busy}
              aiConfigured={ai.available}
              onRetryAI={loadActivity}
            />
          )}
          {answered && (
            <div className={`notice ${answered.correct ? "success" : "warn"} anim-pop`} role="status">
              <span aria-hidden="true">{answered.correct ? "✅" : "🔁"}</span>
              <span>
                <strong>{t(answered.correct ? "learn.feedback.ok" : "learn.feedback.miss")}</strong>{" "}
                {answered.delta === 0
                  ? t("learn.mastery.same", { after: answered.after })
                  : t("review.mastery.moved", {
                      delta: answered.delta > 0 ? `+${answered.delta}` : answered.delta,
                      after: answered.after,
                    })}
              </span>
              <Button variant="teal" size="sm" onClick={advance} style={{ marginLeft: "auto" }}>
                {t("sprint.next")}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === STEPS.EXPLAIN && (
        <div className="sprint-step">
          <Card title={t("sprint.explainTitle")} sub={t("sprint.explainSub", { topic: topicName })}>
            <textarea
              className="input"
              rows={5}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={t("sprint.explainPlaceholder")}
              aria-label={t("sprint.explainTitle")}
            />
            <div className="flex gap-12 wrap" style={{ marginTop: 12 }}>
              <Button variant="teal" onClick={submitExplanation} disabled={busy || !explanation.trim()}>
                {busy ? t("sprint.grading") : t("sprint.submitExplanation")}
              </Button>
              <Button variant="outline" size="sm" onClick={advance}>{t("sprint.skip")}</Button>
            </div>
            {explainError && (
              <div className="notice warn" role="status" style={{ marginTop: 12 }}>
                <span aria-hidden="true">⚠️</span>
                <span>{explainError} {t("sprint.explainKept")}</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {step === STEPS.PRACTICAL && (
        <div className="sprint-step">
          <NimiqPractical topicId={topicId} onDone={advance} />
          <Button variant="outline" size="sm" onClick={advance}>{t("sprint.skip")}</Button>
        </div>
      )}

      {step === STEPS.DONE && (
        <SprintSummary
          topicId={topicId}
          topicName={topicName}
          before={openedWith.current}
          stageNow={stageNow}
          entry={entry}
          explainResult={explainResult}
          onAgain={() => navigate("sprint", {})}
          onHome={() => navigate("home")}
        />
      )}
    </div>
  );
}

/**
 * WHAT CHANGED — the ending screen.
 *
 * Motivating but factual, in that order of difficulty: it is easy to write
 * a celebration and hard to make one true. So every line here is read off
 * the ledger. A sprint where nothing moved says so, because a learner who
 * is told "great progress!" after getting a question wrong learns to stop
 * reading the screen.
 */
function SprintSummary({ topicId, topicName, before, stageNow, entry, explainResult, onAgain, onHome }) {
  const { t, tPlural } = useI18n();
  const rose = STAGE_RANK[stageNow] > STAGE_RANK[before?.stage || "NEW"];
  const masteryDelta = (entry?.mastery ?? 0) - (before?.mastery ?? 0);
  const rec = computeReviewRecommendation(entry);
  const nextReview = rec?.nextReviewAt ? new Date(rec.nextReviewAt) : null;
  const days = nextReview ? Math.max(0, Math.round((nextReview - Date.now()) / 86400000)) : null;

  const LADDER = ["CAN_RECALL", "CAN_EXPLAIN", "CAN_APPLY"];

  return (
    <Card className="sprint-summary anim-pop">
      <p className="todays-plan-kicker">{t("sprint.whatChanged")}</p>
      <h2 style={{ fontSize: 20, margin: "6px 0 16px" }}>{topicName}</h2>

      <ul className="sprint-ladder">
        {LADDER.map((rung) => {
          const reached = STAGE_RANK[stageNow] >= STAGE_RANK[rung];
          return (
            <li key={rung} className={reached ? "reached" : ""}>
              <span aria-hidden="true">{reached ? "✓" : "○"}</span>
              {t(STAGE_LABEL_KEYS[rung])}
            </li>
          );
        })}
      </ul>

      <p className="small" style={{ marginTop: 14 }}>
        <span className="todays-plan-dot" style={{ background: STAGE_COLORS[stageNow] }} aria-hidden="true" />
        {rose
          ? t("sprint.stageRose", { stage: t(STAGE_LABEL_KEYS[stageNow]) })
          : t("sprint.stageSame", { stage: t(STAGE_LABEL_KEYS[stageNow]) })}
      </p>

      {masteryDelta !== 0 && (
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          {t("sprint.masteryMoved", {
            delta: masteryDelta > 0 ? `+${masteryDelta}` : masteryDelta,
            after: entry?.mastery ?? 0,
          })}
        </p>
      )}

      {/* The AI's own sentence about this explanation — the learner-facing
          half of ExplainBack. One line, not the full report: a wall of
          assessment after a five-minute sprint does not get read. */}
      {explainResult?.feedback && (
        <p className="small" style={{ margin: "12px 0 0" }}>
          💬 {explainResult.feedback}
        </p>
      )}

      {explainResult?.misconceptions?.length > 0 && (
        <p className="small" style={{ margin: "10px 0 0" }}>
          🔍 {t("sprint.misconceptionFound", { misconception: explainResult.misconceptions[0] })}
        </p>
      )}

      {explainResult?.missingConcepts?.length > 0 && (
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          ○ {t("sprint.stillMissing", { concept: explainResult.missingConcepts[0] })}
        </p>
      )}

      {days !== null && (
        <p className="small muted" style={{ margin: "10px 0 0" }}>
          {/* Through the plural machinery: "in 1 days" is the giveaway
              that a count was dropped into a sentence unexamined. */}
          ⏳ {days === 0 ? t("sprint.reviewToday") : tPlural("sprint.reviewIn", days, { days })}
        </p>
      )}

      <div className="flex gap-12 wrap" style={{ marginTop: 18 }}>
        <Button variant="teal" onClick={onAgain}>{t("sprint.nextSprint")}</Button>
        <Button variant="outline" onClick={onHome}>{t("sprint.done")}</Button>
      </div>
    </Card>
  );
}
