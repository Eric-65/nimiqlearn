/* ============================================================
   NimiqLearn — LearnLoop AI: decides the next learning activity
   ------------------------------------------------------------
   The LOOP decision is deterministic application logic (rules
   over the knowledge model). The AI generates the *content* of
   the chosen activity. This keeps behaviour predictable and
   honest while still using the model where it shines.
   ============================================================ */

import { generateActivityContentRemote, isActivityBackendConfigured } from "./learnActivityService.js";
import { TOPIC_CONTENT, findTopic, ALL_TOPICS } from "../data/mockTopics.js";
import { MASTERY_BANDS, REVIEW_PRIORITY, REVIEW_INSERTION_MIN_STUDY_MINUTES } from "../config/learningThresholds.js";

export const ACTIVITY_TYPES = [
  "SHORT_EXPLANATION",
  "ANALOGY",
  "EXAMPLE",
  "MULTIPLE_CHOICE",
  "OPEN_RESPONSE",
  "EXPLAIN_BACK",
  "PRACTICE",
  "REVIEW",
];

export const ACTIVITY_LABELS = {
  SHORT_EXPLANATION: "Short explanation",
  ANALOGY: "Analogy",
  EXAMPLE: "Worked example",
  MULTIPLE_CHOICE: "Quick check",
  OPEN_RESPONSE: "Open response",
  EXPLAIN_BACK: "Explain it back",
  PRACTICE: "Targeted practice",
  REVIEW: "Spaced review",
};

/* ------------------ Decision engine ------------------ */

/** The most recently completed activity's type.
 *
 * Learner history is stored NEWEST FIRST (see LearnerContext), and each
 * entry records the activity under `type`. This previously read the last
 * array element (the OLDEST entry) and looked for `activityType` (a key
 * that is never written), so it always came back undefined and the
 * "don't repeat the last activity" logic below never actually fired. */
const mostRecentActivityType = (history) => {
  const newest = history && history.length ? history[0] : null;
  return newest?.type ?? newest?.activityType ?? null;
};

export function decideNextActivity({
  topic,
  knowledge, // knowledge entry for the topic
  history = [], // recent activity history
  reviewDue = false,
  reviewPriority = 0,
  studyMinutes = 10,
}) {
  const mastery = knowledge?.mastery ?? 0;
  const status = knowledge?.status ?? "NEW";
  const lastActivity = mostRecentActivityType(history);
  const recentPerformance = knowledge?.recentPerformance ?? [];

  const pick = (options, avoid) => {
    const filtered = options.filter((o) => o !== avoid);
    const pool = filtered.length ? filtered : options;
    // deterministic alternation: index by history length
    return pool[history.length % pool.length];
  };

  // 1. Concept brand new → teach first
  if (status === "NEW" || mastery === 0) {
    return {
      activityType: "SHORT_EXPLANATION",
      reason: "This concept is new to you — let's start with the core idea.",
      tier: "NEW",
    };
  }

  // 2. Review due and priority high → reinforce memory
  if (reviewDue && reviewPriority >= REVIEW_PRIORITY.DUE_SOON && studyMinutes >= REVIEW_INSERTION_MIN_STUDY_MINUTES) {
    return {
      activityType: "REVIEW",
      reason: "ForgetMeNot flagged this concept for reinforcement.",
      tier: "REVIEW",
    };
  }

  // 3. Recent failure with a known misconception → targeted challenge
  const lastResult = recentPerformance.at(-1);
  const hasMisconception = (knowledge?.misconceptions?.length ?? 0) > 0;
  if (lastResult === 0 && hasMisconception) {
    return {
      activityType: "PRACTICE",
      reason: "You just slipped on this — let's attack the exact misconception.",
      targetMisconception: knowledge.misconceptions[0],
      tier: "MISCONCEPTION",
    };
  }

  // 4. Weak → teach it from several directions, not the same two forever
  if (mastery < MASTERY_BANDS.MID) {
    return {
      activityType: pick(["SHORT_EXPLANATION", "ANALOGY", "EXAMPLE", "MULTIPLE_CHOICE"], lastActivity),
      reason: "Building the foundation before we go deeper.",
      tier: "LOW",
    };
  }

  // 5. Developing → apply it in varied formats
  if (mastery < MASTERY_BANDS.HIGH) {
    return {
      activityType: pick(["EXAMPLE", "MULTIPLE_CHOICE", "PRACTICE", "ANALOGY"], lastActivity),
      reason: "You get the idea — now let's apply it.",
      tier: "MID",
    };
  }

  // 6. Strong → push into explanation (highest retention)
  if (mastery < MASTERY_BANDS.MASTERED) {
    return {
      activityType: pick(["EXPLAIN_BACK", "OPEN_RESPONSE", "MULTIPLE_CHOICE"], lastActivity),
      reason: "You're strong here. Explaining it back will lock it in.",
      tier: "HIGH",
    };
  }

  // 7. Mastered → advance to the next concept
  const nextTopic = suggestNextTopic(topic);
  return {
    activityType: "EXPLAIN_BACK",
    reason: nextTopic
      ? `Mastered! Time to level up to ${nextTopic.name}.`
      : "Mastered! Keep it fresh with a final explanation.",
    nextTopic,
    tier: "MASTERED",
  };
}

export function suggestNextTopic(topic) {
  // Sibling-first advancement within the same branch
  const siblings = ALL_TOPICS.filter((t) => t.parentId === topic.parentId && t.depth === 2);
  const idx = siblings.findIndex((t) => t.id === topic.id);
  if (idx !== -1 && siblings[idx + 1]) return siblings[idx + 1];
  // fall back to any leaf topic
  return ALL_TOPICS.find((t) => t.depth === 2 && t.id !== topic.id) || null;
}

/* ------------------ Content generation ------------------ */

/** Builds a multiple-choice set whose correct answer is not always first.
 * Rotation is derived from the topic id rather than Math.random() so the
 * same topic always renders the same layout — a learner revisiting a
 * question sees a stable one, and nothing shifts under them on re-render. */
function buildChoiceSet(correct, distractors, seedKey) {
  const options = [correct, ...distractors.filter(Boolean)].slice(0, 4);
  const seed = String(seedKey || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const shift = options.length ? seed % options.length : 0;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { options: rotated, correctIndex: rotated.indexOf(correct) };
}

function cannedContent(type, topic, { targetMisconception } = {}) {
  const content = TOPIC_CONTENT[topic.id] || {};
  switch (type) {
    /* The three teaching activities below explain first, then check that it
       landed. They carry options for the same reason the quiz types do: a
       question with nothing to answer it with is a dead end. */
    case "SHORT_EXPLANATION": {
      const correct = content.keyPoints?.[0] || content.definition || `The core idea behind ${topic.name}.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          content.misconception,
          `${topic.name} only matters in theory, never in practice.`,
          "None of the above.",
        ],
        `${topic.id}-short`
      );
      return {
        prompt: content.definition || `Here is a short explanation of ${topic.name}.`,
        body: content.definition || `${topic.name}: ${topic.description}`,
        points: content.keyPoints || [],
        question: `Which statement best captures ${topic.name}?`,
        options,
        correctIndex,
        explanation: content.definition || "",
      };
    }
    case "ANALOGY": {
      const correct = content.analogy || `${topic.name} behaves like a familiar everyday process.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          content.misconception,
          `${topic.name} has no everyday equivalent at all.`,
          "The analogy only works for advanced cases.",
        ],
        `${topic.id}-analogy`
      );
      return {
        prompt: `Think of ${topic.name} like this…`,
        body: content.analogy || "Let's find a familiar everyday situation that behaves the same way.",
        question: `Which comparison best describes ${topic.name}?`,
        options,
        correctIndex,
        explanation: content.analogy || "",
      };
    }
    case "EXAMPLE": {
      const correct = content.example || `A worked example of ${topic.name} follows the core rule step by step.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          content.misconception,
          `In this example, ${topic.name} can be skipped entirely.`,
          "The steps can be applied in any order.",
        ],
        `${topic.id}-example`
      );
      return {
        prompt: `Work through this example of ${topic.name}:`,
        body: content.example || "Try a simple example and check each step.",
        question: `Which statement correctly describes this example of ${topic.name}?`,
        options,
        correctIndex,
        explanation: content.example || "",
      };
    }
    case "MULTIPLE_CHOICE": {
      const correct = content.keyPoints?.[0] || content.definition || `The core definition of ${topic.name} holds.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          content.misconception,
          `${topic.name} only applies in theory, never to real situations.`,
          "It is impossible to tell without more information.",
        ],
        topic.id
      );
      return {
        prompt: "Quick check:",
        question: `Which statement about ${topic.name} is correct?`,
        options,
        correctIndex,
        explanation: content.definition || "Check the core definition above.",
      };
    }
    case "OPEN_RESPONSE":
      return {
        prompt: "Open response:",
        question: `In your own words, how would you apply ${topic.name} to solve a real problem?`,
      };
    case "EXPLAIN_BACK":
      return {
        prompt: "Explain it back:",
        question: `Explain ${topic.name} as if teaching a friend. Include the most important idea first.`,
      };
    case "PRACTICE": {
      const correct = content.keyPoints?.[0] || content.definition || `The accurate statement about ${topic.name}.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          targetMisconception || content.misconception,
          `${topic.name} works the opposite way round.`,
          "None of these can be determined.",
        ],
        `${topic.id}-practice`
      );
      return {
        prompt: "Targeted practice:",
        question: targetMisconception
          ? `Which statement fixes this misunderstanding: "${targetMisconception}"?`
          : `Choose the correct statement about ${topic.name}.`,
        options,
        correctIndex,
        explanation: content.definition || "Compare each option against the core definition.",
      };
    }
    case "REVIEW": {
      const correct = content.keyPoints?.[0] || content.definition || `The core idea behind ${topic.name}.`;
      const { options, correctIndex } = buildChoiceSet(
        correct,
        [
          content.misconception,
          `${topic.name} has no effect on the outcome.`,
          `There is no reliable way to describe ${topic.name}.`,
        ],
        `${topic.id}-review`
      );
      return {
        prompt: "Spaced review:",
        question: `Which statement about ${topic.name} is correct?`,
        body: "",
        options,
        correctIndex,
        explanation: content.definition || "",
      };
    }
    default:
      return { prompt: `Let's study ${topic.name}.` };
  }
}

/** Never blocks the learning UI: if the AI backend isn't configured, is
 * unreachable, or returns something unusable, the deterministic template
 * (cannedContent()) is returned immediately — the learner is never stuck
 * waiting on a network call that might not resolve. */
export async function generateActivityContent({ type, topic, level = "beginner", targetMisconception, previousQuestions = [], previousAngles = [] } = {}) {
  const fallback = cannedContent(type, topic, { targetMisconception });

  if (!isActivityBackendConfigured()) {
    return { ...fallback, source: "template" };
  }

  const result = await generateActivityContentRemote({
    type,
    topic,
    level,
    targetMisconception,
    topicContent: TOPIC_CONTENT[topic.id] || {},
    // What this learner has already been asked, and which sub-aspects were
    // already taught, so the next activity covers new ground instead of
    // rewording the last question or re-teaching the same definition.
    previousQuestions,
    previousAngles,
  });

  if (result.ok && result.value && (result.value.prompt || result.value.question)) {
    const parsed = result.value;
    // Options and their answer key are validated as ONE unit: a generated
    // option list paired with the template's correctIndex (or vice versa)
    // would mark the wrong answer correct, which is worse than falling
    // back to the template entirely.
    const optionsValid =
      Array.isArray(parsed.options) &&
      parsed.options.length >= 2 &&
      Number.isInteger(parsed.correctIndex) &&
      parsed.correctIndex >= 0 &&
      parsed.correctIndex < parsed.options.length;

    const merged = { ...fallback, ...parsed, source: "model" };
    if (!optionsValid) {
      // The question, its options, its answer key and its explanation are
      // one unit. Keeping a generated question while falling back to the
      // template's options would put the wrong answers under the right
      // question, so the whole set reverts together.
      merged.question = fallback.question;
      merged.options = fallback.options;
      merged.correctIndex = fallback.correctIndex;
      merged.explanation = fallback.explanation;
    }
    return merged;
  }
  return { ...fallback, source: "template" };
}


