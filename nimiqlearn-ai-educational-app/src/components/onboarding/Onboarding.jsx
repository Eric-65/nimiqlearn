import React, { useState } from "react";
import { useLearner } from "../../hooks/useLearner.js";
import { useNav } from "../../context/NavContext.jsx";
import { useI18n } from "../../hooks/useI18n.js";
import { GOALS, FAMILIARITY, SESSION_LENGTHS, diagnosticLength } from "../../services/onboardingService.js";
import Button from "../ui/Button.jsx";

/**
 * First run. Four taps, then a short diagnostic.
 *
 * Every question here is asked before the learner has seen anything work,
 * which is the worst moment to ask one — so each has to change what the
 * app does next or it does not belong. Goal picks the curriculum branch;
 * familiarity sets the starting difficulty and the diagnostic's level;
 * session length is what "sprint" means for this person. A name field
 * would change nothing, so there isn't one.
 *
 * Skippable at every step, and skipping is recorded rather than left
 * blank: "never answered" and "declined" have to be different facts, or
 * the app asks again on every reload.
 *
 * One question per screen on purpose. A form with four fields on a phone
 * is a scroll and a keyboard; four screens of big targets is four taps.
 */
export default function Onboarding({ onClose }) {
  const { setGoal, skipOnboarding } = useLearner();
  const { navigate } = useNav();
  const { t } = useI18n();

  const [step, setStep] = useState(0);
  const [goalId, setGoalId] = useState(null);
  const [familiarity, setFamiliarity] = useState(null);
  const [sessionMinutes, setSessionMinutes] = useState(10);

  const skip = () => {
    skipOnboarding();
    onClose?.();
  };

  const finish = (withDiagnostic) => {
    setGoal({ goalId, familiarity: familiarity || "new", sessionMinutes });
    onClose?.();
    if (withDiagnostic) navigate("diagnostic", { goal: goalId });
  };

  const STEPS = [
    {
      key: "goal",
      title: t("onboarding.goalTitle"),
      sub: t("onboarding.goalSub"),
      body: (
        <div className="onboarding-options">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`onboarding-option ${goalId === g.id ? "selected" : ""}`}
              onClick={() => {
                setGoalId(g.id);
                setStep(1);
              }}
            >
              <span aria-hidden="true">{g.emoji}</span>
              {t(g.labelKey)}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "familiarity",
      title: t("onboarding.familiarTitle"),
      sub: t("onboarding.familiarSub"),
      body: (
        <div className="onboarding-options">
          {FAMILIARITY.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`onboarding-option ${familiarity === f.id ? "selected" : ""}`}
              onClick={() => {
                setFamiliarity(f.id);
                setStep(2);
              }}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "session",
      title: t("onboarding.sessionTitle"),
      sub: t("onboarding.sessionSub"),
      body: (
        <div className="onboarding-options">
          {SESSION_LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              className={`onboarding-option ${sessionMinutes === m ? "selected" : ""}`}
              onClick={() => {
                setSessionMinutes(m);
                setStep(3);
              }}
            >
              {t("onboarding.minutes", { minutes: m })}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "diagnostic",
      title: t("onboarding.diagnosticTitle"),
      sub: t("onboarding.diagnosticSub", { count: diagnosticLength(goalId) }),
      body: (
        <div className="onboarding-actions">
          <Button variant="teal" onClick={() => finish(true)}>
            {t("onboarding.startDiagnostic")}
          </Button>
          <button type="button" className="todays-plan-why" onClick={() => finish(false)}>
            {t("onboarding.skipDiagnostic")}
          </button>
        </div>
      ),
    },
  ];

  const current = STEPS[step];

  return (
    <div className="onboarding-scrim" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-sheet anim-rise">
        <div className="onboarding-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.key} className={i <= step ? "on" : ""} />
          ))}
        </div>

        <h2 className="onboarding-title" id="onboarding-title">{current.title}</h2>
        <p className="onboarding-sub">{current.sub}</p>

        {current.body}

        <div className="onboarding-foot">
          {step > 0 && (
            <button type="button" className="todays-plan-why" onClick={() => setStep(step - 1)}>
              {t("onboarding.back")}
            </button>
          )}
          <button type="button" className="todays-plan-why" onClick={skip} style={{ marginLeft: "auto" }}>
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
