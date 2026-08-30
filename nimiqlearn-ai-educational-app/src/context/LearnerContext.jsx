/* ============================================================
   NimiqLearn — LearnerContext
   ------------------------------------------------------------
   Application-owned learner model: knowledge state, review
   queue, history, XP. Persisted to localStorage. AI writes
   assessments; the app owns state transitions and scheduling.
   ============================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { makeKnowledgeEntry } from "../data/mockLearner.js";
import { INITIAL_LEARNER } from "../data/mockLearner.js";
import { findTopic } from "../data/mockTopics.js";
import { evaluateExplanation } from "../services/explainBackService.js";
import {
  updateKnowledgeAfterEvaluation,
  applyActivityResult,
  recordReview,
  refreshAllReviewPriorities,
  averageMastery,
} from "../services/knowledgeService.js";
import { buildReviewQueue } from "../services/forgetMeNotService.js";

const STORAGE_KEY = "nimiqlearn:learner:v1";

const LearnerContext = createContext(null);

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.knowledge)) return null;
    return parsed;
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

  const evaluateExplanationAction = useCallback(
    async ({ topicId, learnerExplanation, learnerLevel = "beginner", preferAI = true, onToken = null }) => {
      const topic = findTopic(topicId);
      if (!topic) throw new Error("Unknown topic.");

      const evaluation = await evaluateExplanation({ topic, learnerExplanation, learnerLevel, preferAI, onToken });

      // Compute the updated entry from the latest committed state so the
      // caller can use it immediately (React state updates are async).
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

      return { evaluation, topic, updatedEntry };
    },
    []
  );

  const recordActivityResultAction = useCallback(
    ({ topicId, correct, activityType = "ACTIVITY" }) => {
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

  const unlockPackAction = useCallback(({ packId, simulated }) => {
    setLearner((l) => {
      const already = (l.unlockedPacks || []).some((p) => p.packId === packId);
      return {
        ...l,
        unlockedPacks: already
          ? l.unlockedPacks
          : [...(l.unlockedPacks || []), { packId, simulated, unlockedAt: Date.now() }],
      };
    });
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
      resetLearner: resetLearnerAction,
    };
  }, [learner, evaluateExplanationAction, recordActivityResultAction, recordReviewAction, unlockPackAction, resetLearnerAction]);

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearnerContext() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error("useLearnerContext must be used inside <LearnerProvider>");
  return ctx;
}
