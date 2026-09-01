/* ============================================================
   NimiqLearn — LearnerContext
   ------------------------------------------------------------
   Application-owned learner model: knowledge state, review
   queue, history, XP. Persisted to localStorage. AI writes
   assessments; the app owns state transitions and scheduling.
   ============================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { makeKnowledgeEntry, INITIAL_LEARNER, LEARNER_STATE_SCHEMA_VERSION } from "../data/mockLearner.js";
import { findTopic } from "../data/mockTopics.js";
import { evaluateExplanation } from "../services/assessmentService.js";
import {
  updateKnowledgeAfterEvaluation,
  applyActivityResult,
  recordReview,
  refreshAllReviewPriorities,
  averageMastery,
  calculateConfidence,
} from "../services/knowledgeService.js";
import { buildReviewQueue, computeReviewRecommendation } from "../services/forgetMeNotService.js";
import { decideNextActivity } from "../services/learnLoopService.js";
import { logEvent } from "../services/eventLogService.js";
import { createEntitlement, hasEntitlement, createPendingPayment } from "../services/entitlementService.js";

const STORAGE_KEY = "nimiqlearn:learner:v1";

const LearnerContext = createContext(null);

/**
 * Upgrades a persisted blob to the current schema (see
 * LEARNER_STATE_SCHEMA_VERSION / makeKnowledgeEntry in mockLearner.js).
 * A blob with no `version` predates this field entirely — its knowledge
 * entries are missing confidence/correctAttempts/incorrectAttempts/
 * lastStudiedAt/nextReviewAt, which makeKnowledgeEntry's spread would
 * silently paper over with defaults (0/null) UNLESS we derive better
 * values from what the old blob actually recorded. Never breaks an
 * existing user's data by discarding it — only fills gaps.
 */
export function migrateLearnerState(persisted) {
  if (!persisted || !Array.isArray(persisted.knowledge)) return null;
  const fromVersion = persisted.version ?? 0;
  if (fromVersion >= LEARNER_STATE_SCHEMA_VERSION) return persisted;

  const knowledge = persisted.knowledge.map((entry) => {
    const recent = entry.recentPerformance ?? [];
    const hasCounters = typeof entry.correctAttempts === "number" || typeof entry.incorrectAttempts === "number";
    const correctAttempts = hasCounters ? entry.correctAttempts ?? 0 : recent.filter((r) => r === 1).length;
    const incorrectAttempts = hasCounters ? entry.incorrectAttempts ?? 0 : recent.filter((r) => r === 0).length;
    const derivedLastStudiedAt = Math.max(entry.lastEvaluatedAt || 0, entry.lastReviewedAt || 0) || null;
    const lastStudiedAt = entry.lastStudiedAt ?? derivedLastStudiedAt;

    const upgraded = {
      ...entry,
      correctAttempts,
      incorrectAttempts,
      attempts: correctAttempts + incorrectAttempts,
      lastStudiedAt,
    };
    return makeKnowledgeEntry(entry.topicId, entry.topicName, {
      ...upgraded,
      confidence: entry.confidence ?? calculateConfidence(upgraded),
    });
  });

  return { ...persisted, version: LEARNER_STATE_SCHEMA_VERSION, knowledge };
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.knowledge)) return null;
    return migrateLearnerState(parsed);
  } catch {
    return null;
  }
}

export function LearnerProvider({ children }) {
  const [learner, setLearner] = useState(() => {
    const persisted = loadPersisted();
    if (persisted) {
      return {
        ...INITIAL_LEARNER,
        ...persisted,
        knowledge: refreshAllReviewPriorities(persisted.knowledge),
      };
    }
    return { ...INITIAL_LEARNER, knowledge: refreshAllReviewPriorities(INITIAL_LEARNER.knowledge) };
  });
  const saveTimer = useRef(null);
  const learnerRef = useRef(learner);
  learnerRef.current = learner;

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(learner));
      } catch {
        /* storage full / private mode — ignore */
      }
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [learner]);

  const addHistory = (entry) =>
    setLearner((l) => ({
      ...l,
      history: [entry, ...(l.history || [])].slice(0, 60),
    }));

  const patchKnowledge = (topicId, patchFn) =>
    setLearner((l) => ({
      ...l,
      knowledge: l.knowledge.map((k) => (k.topicId === topicId ? patchFn(k) : k)),
    }));

  const getEntry = (topicId) => learner.knowledge.find((k) => k.topicId === topicId) || null;

  /* ---------------- Actions ---------------- */

  /**
   * The full ExplainBack submission pipeline (see docs/learning-engine.md):
   *
   *   validateInput -> evaluateExplanation -> updateLearnerState
   *   -> updateKnowledgeMap -> calculateReview -> recommendNextActivity
   *
   * In this app updateLearnerState and updateKnowledgeMap are the SAME
   * step, deliberately: the Knowledge Map is a view over the one
   * canonical learner-state tree (`learner.knowledge`), not a separate
   * store — a second store would itself be the "duplicated state across
   * unrelated components" this pipeline is meant to avoid. Everything
   * below (the review recommendation, the next-activity decision) is
   * computed HERE, once, from the just-updated state — callers (e.g.
   * ExplainBack.jsx) consume the result rather than recomputing it, so
   * there is exactly one place this logic can drift from what actually
   * got saved.
   */
  const evaluateExplanationAction = useCallback(
    async ({ topicId, learnerExplanation, learnerLevel = "beginner", preferAI = true, onToken = null }) => {
      // 1. validateInput
      const topic = findTopic(topicId);
      if (!topic) throw new Error("Unknown topic.");
      if (!learnerExplanation || !learnerExplanation.trim()) {
        throw new Error("An explanation is required before evaluation.");
      }

      // 2. evaluateExplanation (deterministic rubric + SmolLM2 feedback —
      //    see assessmentService.js; already returns the normalized result
      //    contract: conceptId/score/masteryEstimate/strengths/
      //    missingConcepts/misconceptions/feedback/nextAction)
      logEvent({ eventType: "EXPLANATION_SUBMITTED", topicId });
      const evaluation = await evaluateExplanation({ topic, learnerExplanation, learnerLevel, preferAI, onToken });
      logEvent({ eventType: "EXPLANATION_EVALUATED", topicId, score: evaluation.masteryEstimate });

      // 3/4. updateLearnerState / updateKnowledgeMap — compute from the
      // latest COMMITTED state (learnerRef, not React state which updates
      // asynchronously) so the value returned to the caller is never
      // ahead of what setLearner below actually persists.
      const latest = learnerRef.current;
      const baseEntry = latest.knowledge.find((k) => k.topicId === topicId) || makeKnowledgeEntry(topicId, topic.name);
      const updatedEntry = updateKnowledgeAfterEvaluation(baseEntry, evaluation);

      setLearner((l) => {
        const entry = l.knowledge.find((k) => k.topicId === topicId);
        const updated = updateKnowledgeAfterEvaluation(entry, evaluation);
        return {
          ...l,
          knowledge: l.knowledge.map((k) => (k.topicId === topicId ? updated : k)),
          xp: l.xp + 12,
          history: [
            { type: "EXPLAIN_BACK", topicId, at: Date.now(), detail: "AI evaluation completed" },
            ...(l.history || []),
          ].slice(0, 60),
        };
      });

      // 5. calculateReview — deterministic, never the LLM (see
      // forgetMeNotService.js). Computed from updatedEntry, so it reflects
      // the state that was just saved, not the state before this submission.
      const reviewRecommendation = computeReviewRecommendation(updatedEntry);

      // 6. recommendNextActivity — mastery + recent performance + review
      // priority all feed in (see learnLoopService.js), so the learner
      // does not keep receiving the same activity regardless of progress.
      const nextDecision = decideNextActivity({
        topic,
        knowledge: updatedEntry,
        history: latest.history.filter((h) => h.topicId === topicId).slice(0, 12),
        reviewDue: reviewRecommendation.dueNow,
        reviewPriority: reviewRecommendation.priorityScore,
      });

      return { evaluation, topic, updatedEntry, reviewRecommendation, nextDecision };
    },
    []
  );

  const recordActivityResultAction = useCallback(
    ({ topicId, correct, activityType = "ACTIVITY" }) => {
      logEvent({
        eventType: activityType === "EXPLAIN_BACK" ? "CHALLENGE_COMPLETED" : "ANSWER_SUBMITTED",
        topicId,
        activityId: activityType,
        correct,
      });
      patchKnowledge(topicId, (entry) => applyActivityResult(entry, { correct, activityType }));
      setLearner((l) => ({
        ...l,
        xp: l.xp + (correct ? 10 : 3),
        history: [
          { type: activityType, topicId, at: Date.now(), detail: correct ? "Correct" : "Incorrect" },
          ...(l.history || []),
        ].slice(0, 60),
      }));
    },
    []
  );

  const recordReviewAction = useCallback(({ topicId, correct }) => {
    logEvent({ eventType: "REVIEW_COMPLETED", topicId, correct });
    patchKnowledge(topicId, (entry) => recordReview(entry, { correct }));
    setLearner((l) => ({
      ...l,
      xp: l.xp + (correct ? 8 : 2),
      history: [
        { type: "REVIEW", topicId, at: Date.now(), detail: correct ? "Recalled" : "Needs another pass" },
        ...(l.history || []),
      ].slice(0, 60),
    }));
  }, []);

  const unlockPackAction = useCallback(({ productId, purchaserAddress, transactionId, simulated }) => {
    setLearner((l) => {
      if (hasEntitlement(l.unlockedPacks, productId)) return l;
      return {
        ...l,
        unlockedPacks: [...(l.unlockedPacks || []), createEntitlement({ productId, purchaserAddress, transactionId, simulated })],
        pendingPayments: (l.pendingPayments || []).filter((p) => p.productId !== productId),
      };
    });
  }, []);

  /** Item 22 — records an unresolved (UNKNOWN) payment so the same
   * product cannot be purchased again until the learner explicitly
   * acknowledges checking their own wallet (clearPendingPaymentAction). */
  const recordPendingPaymentAction = useCallback(({ productId }) => {
    setLearner((l) => {
      if ((l.pendingPayments || []).some((p) => p.productId === productId)) return l;
      return { ...l, pendingPayments: [...(l.pendingPayments || []), createPendingPayment({ productId })] };
    });
  }, []);

  const clearPendingPaymentAction = useCallback(({ productId }) => {
    setLearner((l) => ({
      ...l,
      pendingPayments: (l.pendingPayments || []).filter((p) => p.productId !== productId),
    }));
  }, []);

  const resetLearnerAction = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLearner({ ...INITIAL_LEARNER, knowledge: refreshAllReviewPriorities(INITIAL_LEARNER.knowledge) });
  }, []);

  const value = useMemo(() => {
    const knowledge = learner.knowledge;
    const reviewQueue = buildReviewQueue(knowledge);
    const dueNow = reviewQueue.filter((r) => r.dueNow);
    return {
      learner,
      knowledge,
      reviewQueue,
      dueNow,
      averageMastery: averageMastery(knowledge),
      getEntry,
      evaluateExplanation: evaluateExplanationAction,
      recordActivityResult: recordActivityResultAction,
      recordReview: recordReviewAction,
      unlockPack: unlockPackAction,
      recordPendingPayment: recordPendingPaymentAction,
      clearPendingPayment: clearPendingPaymentAction,
      resetLearner: resetLearnerAction,
    };
  }, [
    learner,
    evaluateExplanationAction,
    recordActivityResultAction,
    recordReviewAction,
    unlockPackAction,
    recordPendingPaymentAction,
    clearPendingPaymentAction,
    resetLearnerAction,
  ]);

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearnerContext() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error("useLearnerContext must be used inside <LearnerProvider>");
  return ctx;
}
