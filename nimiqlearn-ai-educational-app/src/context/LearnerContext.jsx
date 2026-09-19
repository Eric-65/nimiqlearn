/* ============================================================
   NimiqLearn — LearnerContext
   ------------------------------------------------------------
   Application-owned learner model: knowledge state, review
   queue, history, XP. Persisted to localStorage. AI writes
   assessments; the app owns state transitions and scheduling.
   ============================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { makeKnowledgeEntry, INITIAL_LEARNER, LEARNER_STATE_SCHEMA_VERSION, createWalletLearner } from "../data/mockLearner.js";
import { subscribeToWalletChanges } from "../services/nimiqWalletService.js";
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

/* ---------------- one profile per wallet ----------------
   The guest profile lives under the original key, so nothing that was
   saved before wallet profiles existed is lost or moved. A learner who
   signs in with Nimiq Pay gets a profile of their own, keyed by the
   AUTHENTICATED address — the one they proved by signing a message, not
   merely the one the wallet reported on connect. That profile is their
   account: sign in on any device with the same wallet and it comes back;
   sign out and the app returns to the guest profile, untouched. */
const GUEST_KEY = "nimiqlearn:learner:v1";
const walletKey = (address) => `${GUEST_KEY}:${String(address).replace(/\s+/g, "")}`;

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

function loadPersisted(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.knowledge)) return null;
    return migrateLearnerState(parsed);
  } catch {
    return null;
  }
}

function writePersisted(key, learner) {
  try {
    localStorage.setItem(key, JSON.stringify(learner));
  } catch {
    /* storage full / private mode — ignore */
  }
}

/* Whether a guest has actually done anything, as opposed to still holding
   the untouched demo learner. Decides what a first sign-in starts from. */
function hasRealProgress(learner) {
  return Array.isArray(learner?.history) && learner.history.length > 0;
}

function loadGuest() {
  const persisted = loadPersisted(GUEST_KEY);
  if (persisted) {
    return { ...INITIAL_LEARNER, ...persisted, knowledge: refreshAllReviewPriorities(persisted.knowledge) };
  }
  return { ...INITIAL_LEARNER, knowledge: refreshAllReviewPriorities(INITIAL_LEARNER.knowledge) };
}

/* The profile for an authenticated address. Three cases, in order:
   1. It has been here before → its own saved progress.
   2. First sign-in, and the guest has real progress → the guest's work
      is ADOPTED as this wallet's starting point, so nobody loses what
      they did in the ten minutes before they decided to sign in. The
      guest profile itself is left as it was.
   3. First sign-in, untouched demo guest → a blank profile. The demo
      learner's invented mastery must never be filed under a real
      address as if the learner had earned it. */
function loadOrCreateWallet(address, guest) {
  const persisted = loadPersisted(walletKey(address));
  if (persisted) {
    return { ...createWalletLearner(address), ...persisted, knowledge: refreshAllReviewPriorities(persisted.knowledge) };
  }
  if (hasRealProgress(guest)) {
    const blank = createWalletLearner(address);
    /* Everything the guest earned, under the wallet's identity. */
    return { ...blank, ...guest, id: blank.id, walletAddress: blank.walletAddress, name: blank.name, createdAt: blank.createdAt, adoptedFromGuest: true };
  }
  return createWalletLearner(address);
}

export function LearnerProvider({ children }) {
  /* The storage key and the learner it belongs to are ONE piece of state,
     changed together. Kept apart, a pending debounced save could fire
     after the key had switched but before the new learner had loaded —
     and write the guest's data over a wallet profile, or one wallet's
     over another's. Bundled, the save effect can only ever see a matched
     pair. */
  const [session, setSession] = useState(() => ({ key: GUEST_KEY, learner: loadGuest() }));
  const learner = session.learner;
  const setLearner = useCallback(
    (next) => setSession((s) => ({ ...s, learner: typeof next === "function" ? next(s.learner) : next })),
    []
  );
  const saveTimer = useRef(null);
  const learnerRef = useRef(learner);
  learnerRef.current = learner;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writePersisted(session.key, session.learner), 250);
    return () => clearTimeout(saveTimer.current);
  }, [session]);

  /* Follow the wallet: an authenticated address selects its profile; losing
     authentication (sign-out, disconnect, session expiry) returns to the
     guest. Whatever profile is current is flushed to storage first, so a
     save still sitting in the 250 ms debounce is not lost in the switch. */
  useEffect(() => {
    return subscribeToWalletChanges((wallet) => {
      const address = wallet?.authenticated?.address || null;
      const nextKey = address ? walletKey(address) : GUEST_KEY;
      const current = sessionRef.current;
      if (nextKey === current.key) return;
      clearTimeout(saveTimer.current);
      writePersisted(current.key, current.learner);
      const guest = current.key === GUEST_KEY ? current.learner : loadGuest();
      setSession({ key: nextKey, learner: address ? loadOrCreateWallet(address, guest) : guest });
    });
  }, []);

  const addHistory = (entry) =>
    setLearner((l) => ({
      ...l,
      history: [entry, ...(l.history || [])].slice(0, 60),
    }));

  /** Applies patchFn to a topic's knowledge entry, creating that entry if the
   * learner is touching the topic for the first time. Without the create
   * branch, map() would match nothing for a brand-new topic and the update
   * would be silently dropped — the learner would answer questions and see
   * no mastery movement at all. */
  const patchKnowledge = (topicId, patchFn) =>
    setLearner((l) => {
      const existing = l.knowledge.find((k) => k.topicId === topicId);
      const patched = patchFn(existing || makeKnowledgeEntry(topicId, findTopic(topicId)?.name || topicId));
      return {
        ...l,
        knowledge: existing
          ? l.knowledge.map((k) => (k.topicId === topicId ? patched : k))
          : [...l.knowledge, patched],
      };
    });

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
    async ({ topicId, learnerExplanation, learnerLevel = "beginner", preferAI = true }) => {
      // 1. validateInput
      const topic = findTopic(topicId);
      if (!topic) throw new Error("Unknown topic.");
      if (!learnerExplanation || !learnerExplanation.trim()) {
        throw new Error("An explanation is required before evaluation.");
      }

      // 2. evaluateExplanation (deterministic rubric + OpenAI feedback —
      //    see assessmentService.js; already returns the normalized result
      //    contract: conceptId/score/masteryEstimate/strengths/
      //    missingConcepts/misconceptions/feedback/nextAction)
      logEvent({ eventType: "EXPLANATION_SUBMITTED", topicId });
      const evaluation = await evaluateExplanation({ topic, learnerExplanation, learnerLevel, preferAI });
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
        // Same first-touch case as patchKnowledge: a topic with no entry yet
        // must be appended, not mapped over, or the evaluation is lost.
        const updated = updateKnowledgeAfterEvaluation(entry || makeKnowledgeEntry(topicId, topic.name), evaluation);
        return {
          ...l,
          knowledge: entry
            ? l.knowledge.map((k) => (k.topicId === topicId ? updated : k))
            : [...l.knowledge, updated],
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
    ({ topicId, correct, activityType = "ACTIVITY", optionCount = null }) => {
      logEvent({
        eventType: activityType === "EXPLAIN_BACK" ? "CHALLENGE_COMPLETED" : "ANSWER_SUBMITTED",
        topicId,
        activityId: activityType,
        correct,
      });
      // Computed once from the latest committed state (learnerRef) so the
      // caller gets the REAL before/after mastery to show the learner,
      // instead of a hardcoded "+3" that had nothing to do with the model.
      const latest = learnerRef.current;
      const base =
        latest.knowledge.find((k) => k.topicId === topicId) ||
        makeKnowledgeEntry(topicId, findTopic(topicId)?.name || topicId);
      const updated = applyActivityResult(base, { correct, activityType, optionCount });
      patchKnowledge(topicId, () => updated);
      setLearner((l) => ({
        ...l,
        xp: l.xp + (correct ? 10 : 3),
        history: [
          { type: activityType, topicId, at: Date.now(), detail: correct ? "Correct" : "Incorrect" },
          ...(l.history || []),
        ].slice(0, 60),
      }));
      const before = base.mastery ?? 0;
      return { before, after: updated.mastery, delta: updated.mastery - before };
    },
    []
  );

  /**
   * Remembers a generated activity's question + angle against the topic so
   * future prompts (Learn.jsx, ForgetMeNot.jsx) can tell the AI what's
   * already been covered — persisted on the knowledge entry, not a
   * component ref, so it survives closing the app and coming back. Capped
   * at 30 of each: far more than the ~8 any single prompt sends (see
   * cleanList in server/index.js), so a topic studied over many sessions
   * still has real history to draw on rather than only "since I last
   * reopened the tab".
   */
  const recordActivityCoverageAction = useCallback(({ topicId, question, angle }) => {
    if (!question && !angle) return;
    patchKnowledge(topicId, (entry) => ({
      ...entry,
      coveredQuestions: question ? [...(entry.coveredQuestions || []), question].slice(-30) : entry.coveredQuestions || [],
      coveredAngles: angle ? [...(entry.coveredAngles || []), angle].slice(-30) : entry.coveredAngles || [],
    }));
  }, []);

  /** Saves a lesson question and its answer on the topic's entry, newest
   * first. Part of the profile, so a wallet learner's questions come back
   * with their account on any device. Capped at 20 per topic. */
  const recordLessonQuestionAction = useCallback(({ topicId, question, answer }) => {
    if (!question || !answer) return;
    logEvent({ eventType: "LESSON_QUESTION_ASKED", topicId });
    patchKnowledge(topicId, (entry) => ({
      ...entry,
      questions: [{ question, answer, at: Date.now() }, ...(entry.questions || [])].slice(0, 20),
    }));
  }, []);

  const recordReviewAction = useCallback(({ topicId, correct, optionCount = null }) => {
    logEvent({ eventType: "REVIEW_COMPLETED", topicId, correct });
    const latest = learnerRef.current;
    const base =
      latest.knowledge.find((k) => k.topicId === topicId) ||
      makeKnowledgeEntry(topicId, findTopic(topicId)?.name || topicId);
    const updated = recordReview(base, { correct, optionCount });
    patchKnowledge(topicId, () => updated);
    setLearner((l) => ({
      ...l,
      xp: l.xp + (correct ? 8 : 2),
      history: [
        { type: "REVIEW", topicId, at: Date.now(), detail: correct ? "Recalled" : "Needs another pass" },
        ...(l.history || []),
      ].slice(0, 60),
    }));
    const before = base.mastery ?? 0;
    return { before, after: updated.mastery, delta: updated.mastery - before };
  }, []);

  const unlockPackAction = useCallback(({ productId, purchaserAddress, transactionHash, simulated }) => {
    setLearner((l) => {
      if (hasEntitlement(l.unlockedPacks, productId)) return l;
      return {
        ...l,
        unlockedPacks: [...(l.unlockedPacks || []), createEntitlement({ productId, purchaserAddress, transactionHash, simulated })],
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

  /* Resets whichever profile is current — a wallet profile back to blank
     under that wallet, the guest back to the demo learner. Never touches
     any other profile. */
  const resetLearnerAction = useCallback(() => {
    const { key, learner: current } = sessionRef.current;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    const fresh = current.walletAddress
      ? createWalletLearner(current.walletAddress)
      : { ...INITIAL_LEARNER, knowledge: refreshAllReviewPriorities(INITIAL_LEARNER.knowledge) };
    setSession({ key, learner: fresh });
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
      /* Which profile this is: the address it is filed under, or null for
         the guest. Components use it to say "saved to your wallet". */
      profileAddress: learner.walletAddress || null,
      isWalletProfile: Boolean(learner.walletAddress),
      averageMastery: averageMastery(knowledge),
      getEntry,
      evaluateExplanation: evaluateExplanationAction,
      recordActivityResult: recordActivityResultAction,
      recordActivityCoverage: recordActivityCoverageAction,
      recordLessonQuestion: recordLessonQuestionAction,
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
    recordActivityCoverageAction,
    recordLessonQuestionAction,
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
