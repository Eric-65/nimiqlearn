/* ============================================================
   NimiqLearn — reference pure-JS scorer for the exported
   learner-state logistic regression (training/exports/learner_state/model.json)
   ------------------------------------------------------------
   NOT wired into the app. Demonstrates the trained-model path
   src/services/learnerStateService.js could add later without an
   architecture change — see ../README.md for the export contract.

   Feature order MUST match model.featureKeys:
     [attemptCount, recentFailures, topicMastery, recentRate, daysSinceReview]
   ============================================================ */

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * @param {object} model - parsed model.json (scalerMean, scalerScale, coef, intercept)
 * @param {{attemptCount:number, recentFailures:number, topicMastery:number, recentCorrectness:number[], timeSinceReviewMs:number|null}} input
 * @returns {number} probability the learner answers the next question correctly, 0-1
 */
export function scoreLearnerState(model, input) {
  const recentRate = input.recentCorrectness?.length
    ? input.recentCorrectness.reduce((a, b) => a + b, 0) / input.recentCorrectness.length
    : 0;
  const daysSinceReview = Math.min((input.timeSinceReviewMs || 0) / 86_400_000, 30);

  const raw = [input.attemptCount, input.recentFailures, input.topicMastery, recentRate, daysSinceReview];

  let z = model.intercept;
  for (let i = 0; i < raw.length; i++) {
    const scaled = (raw[i] - model.scalerMean[i]) / model.scalerScale[i];
    z += scaled * model.coef[i];
  }
  return sigmoid(z);
}
