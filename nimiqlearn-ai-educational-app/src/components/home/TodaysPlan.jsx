import React, { useMemo, useState } from "react";
import { useNav } from "../../context/NavContext.jsx";
import { useLearner } from "../../hooks/useLearner.js";
import { useI18n } from "../../hooks/useI18n.js";
import { recommendNextAction, coachSummary } from "../../services/coachService.js";
import { STAGE_LABEL_KEYS, STAGE_COLORS } from "../../services/masteryService.js";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";

/**
 * Today's Plan — the one card that answers "what should I do next?".
 *
 * This is the app's answer to its own biggest usability problem: a learner
 * who opens NimiqLearn and has to choose between Learn, ExplainBack,
 * ForgetMeNot and the Knowledge Map before they have done anything. Those
 * are four ways of asking the learner to do the system's job. The coach
 * picks, and the learner presses one button.
 *
 * Deliberately the ONLY thing with this visual weight on Home. The strip
 * below it is three numbers, not three more cards — anything given equal
 * weight competes with the recommendation and puts the decision back on
 * the learner.
 *
 * "Why this?" is not decoration either. A system that tells you what to do
 * without saying why is one you either obey or ignore; the reason is read
 * off the evidence ledger, so it can name the actual attempt that caused
 * it ("you explained this on Tuesday but haven't applied it yet") rather
 * than a plausible sentence written after the fact.
 */
export default function TodaysPlan() {
  const { navigate } = useNav();
  const { knowledge, dueNow, learner } = useLearner();
  const { t, tOr, tPlural } = useI18n();
  const [showWhy, setShowWhy] = useState(false);

  const plan = useMemo(
    () => recommendNextAction({ knowledge, dueNow, learner, goalTopicId: learner?.goal?.topicId || null }),
    [knowledge, dueNow, learner]
  );
  const summary = useMemo(() => coachSummary({ knowledge, dueNow, learner }), [knowledge, dueNow, learner]);

  if (!plan) return null;

  const topicName = tOr(`topic.${plan.topicId}.name`, plan.topicName);
  const stageLabel = t(STAGE_LABEL_KEYS[plan.stage] || STAGE_LABEL_KEYS.NEW);

  /* The reason sentence. Every branch interpolates the concept's own
     details, so no two recommendations read identically. */
  const reasonVars = {
    topic: topicName,
    stage: stageLabel,
    needed: t(`evidence.${String(plan.neededEvidence || "RECALL").toLowerCase()}`),
    misconception: plan.reasonVars?.misconception || "",
  };
  /* The review reason carries a day count, so it goes through the plural
     machinery rather than rendering "1 days ago". Every other reason has
     no count and uses plain t(). */
  const why =
    plan.reasonKey === "coach.reason.reviewDue"
      ? tPlural(plan.reasonKey, plan.reasonVars?.days ?? 1, reasonVars)
      : t(plan.reasonKey, reasonVars);

  return (
    <section className="todays-plan" aria-labelledby="todays-plan-title">
      <div className="todays-plan-head">
        <p className="todays-plan-kicker" id="todays-plan-title">
          {t("coach.todaysPlan")}
        </p>
        <Badge tone={plan.kind === "REVIEW" ? "amber" : plan.kind === "REPAIR" ? "rose" : "teal"}>
          {t(`coach.kind.${plan.kind.toLowerCase()}`)}
        </Badge>
      </div>

      <h2 className="todays-plan-topic">{topicName}</h2>

      <p className="todays-plan-session">
        {t("coach.sessionLine", {
          minutes: plan.estimatedMinutes,
          activity: t(`activity.${activityKey(plan.activityType)}`),
        })}
      </p>

      {/* The stage ladder, as a sentence rather than a chart: where this
          concept is, and the single demonstration that would move it on. */}
      <p className="todays-plan-stage">
        <span className="todays-plan-dot" style={{ background: STAGE_COLORS[plan.stage] }} aria-hidden="true" />
        {plan.targetStage
          ? t("coach.stageLine", { stage: stageLabel, target: t(STAGE_LABEL_KEYS[plan.targetStage]) })
          : t("coach.stageLineDone", { stage: stageLabel })}
      </p>

      <div className="todays-plan-actions">
        <Button variant="teal" onClick={() => navigate(plan.route, plan.routeParams)}>
          {t("coach.continue")}
        </Button>
        <button
          type="button"
          className="todays-plan-why"
          aria-expanded={showWhy}
          onClick={() => setShowWhy((v) => !v)}
        >
          {t("coach.whyThis")}
        </button>
      </div>

      {showWhy && (
        <p className="todays-plan-reason anim-pop" role="note">
          {why}
        </p>
      )}

      {/* Three numbers, read in a glance. Reviews first because it is the
          only one with a deadline. */}
      <dl className="todays-plan-stats">
        <Stat label={t("coach.stat.reviewsDue")} value={summary.reviewsDue} urgent={summary.reviewsDue > 0} />
        <Stat label={t("coach.stat.inProgress")} value={summary.inProgress} />
        <Stat label={t("coach.stat.mastered")} value={summary.mastered} />
      </dl>
    </section>
  );
}

function Stat({ label, value, urgent = false }) {
  return (
    <div className="todays-plan-stat">
      <dt>{label}</dt>
      <dd className={urgent ? "urgent" : ""}>{value}</dd>
    </div>
  );
}

/* learnLoopService's ACTIVITY_LABEL_KEYS are camelCase suffixes of the
   SCREAMING_SNAKE type; this maps one to the other without importing the
   whole table for a single lookup. */
function activityKey(type) {
  return String(type || "MULTIPLE_CHOICE")
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
