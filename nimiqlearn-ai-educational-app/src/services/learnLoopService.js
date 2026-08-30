/* ============================================================
   NimiqLearn — LearnLoop AI: decides the next learning activity
   ------------------------------------------------------------
   The LOOP decision is deterministic application logic (rules
   over the knowledge model). The AI generates the *content* of
   the chosen activity. This keeps behaviour predictable and
   honest while still using the model where it shines.
   ============================================================ */

import { generateLearningResponse, isAIReady, initializeAI } from "./aiService.js";
import { TOPIC_CONTENT, findTopic, ALL_TOPICS } from "../data/mockTopics.js";

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

const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);

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
  const lastActivity = last(history)?.activityType;
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
    };
  }

  // 2. Review due and priority high → reinforce memory
  if (reviewDue && reviewPriority >= 65 && studyMinutes >= 3) {
    return {
      activityType: "REVIEW",
      reason: "ForgetMeNot flagged this concept for reinforcement.",
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
    };
  }

  // 4. Weak → simple explanation or analogy
  if (mastery < 40) {
    return {
      activityType: pick(["SHORT_EXPLANATION", "ANALOGY"], lastActivity),
      reason: "Building the foundation before we go deeper.",
    };
  }

  // 5. Developing → example + quick check
  if (mastery < 65) {
    return {
      activityType: pick(["EXAMPLE", "MULTIPLE_CHOICE"], lastActivity),
      reason: "You get the idea — now let's apply it.",
    };
  }

  // 6. Strong → push into explanation (highest retention)
  if (mastery < 85) {
    return {
      activityType: pick(["EXPLAIN_BACK", "OPEN_RESPONSE", "MULTIPLE_CHOICE"], lastActivity),
      reason: "You're strong here. Explaining it back will lock it in.",
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

function cannedContent(type, topic, { targetMisconception } = {}) {
  const content = TOPIC_CONTENT[topic.id] || {};
  switch (type) {
    case "SHORT_EXPLANATION":
      return {
        prompt: content.definition || `Here is a short explanation of ${topic.name}.`,
        body: content.definition || `${topic.name}: ${topic.description}`,
        points: content.keyPoints || [],
      };
    case "ANALOGY":
      return {
        prompt: `Think of ${topic.name} like this…`,
        body: content.analogy || "Let's find a familiar everyday situation that behaves the same way.",
      };
    case "EXAMPLE":
      return {
        prompt: `Work through this example of ${topic.name}:`,
        body: content.example || "Try a simple example and check each step.",
      };
    case "MULTIPLE_CHOICE":
      return {
        prompt: "Quick check:",
        question: `Which statement about ${topic.name} is correct?`,
        options: [
          (content.keyPoints?.[0] || "The core definition holds."),
          (content.misconception || "A common but incorrect statement."),
          "It is impossible to tell without more information.",
          "None of the above.",
        ],
        correctIndex: 0,
        explanation: content.definition || "Check the core definition above.",
      };
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
    case "PRACTICE":
      return {
        prompt: "Targeted practice:",
        question: targetMisconception
          ? `Which statement fixes this misunderstanding: "${targetMisconception}"?`
          : `Choose the correct statement about ${topic.name}.`,
        options: [
          "The corrected, accurate statement.",
          "The common misconception.",
          "A partially right statement.",
          "An unrelated claim.",
        ],
        correctIndex: 0,
        explanation: content.definition || "Compare each option against the core definition.",
      };
    case "REVIEW":
      return {
        prompt: "Spaced review:",
        question: `Recall: what is the single most important idea in ${topic.name}?`,
        body: content.definition || "",
      };
    default:
      return { prompt: `Let's study ${topic.name}.` };
  }
}

export async function generateActivityContent({ type, topic, level = "beginner", targetMisconception } = {}) {
  const fallback = cannedContent(type, topic, { targetMisconception });

  // CRITICAL: never block the learning UI on model initialization.
  // If the AI is not ready, serve the deterministic template immediately
  // and warm the model in the background (fire-and-forget, never awaited).
  if (!isAIReady()) {
    initializeAI().catch(() => {});
    return { ...fallback, source: "template" };
  }

  try {
    const instruction = `You are NimiqLearn, an adaptive tutor. Generate a short, clear learning activity.
Learner level: ${level}.
Activity type: ${type}.
Topic: ${topic.name}.
Description: ${topic.description || ""}.
${targetMisconception ? `Target the misconception: "${targetMisconception}".` : ""}

Return ONLY valid JSON matching this shape:
${JSON.stringify({
  prompt: "one-line instruction to the learner",
  body: "optional 1-2 sentence content",
  question: "the question or task",
  options: ["array of options — only for MULTIPLE_CHOICE and PRACTICE"],
  correctIndex: 0,
  explanation: "brief explanation of the correct answer",
})}
No markdown, no text outside JSON.`;

    const raw = await generateLearningResponse({
      systemPrompt: instruction,
      userPrompt: `Topic content reference: ${JSON.stringify(TOPIC_CONTENT[topic.id] || {})}`,
      maxNewTokens: 320,
      temperature: 0.4,
    });
    const parsed = extractActivityJson(raw);
    if (parsed && (parsed.prompt || parsed.question)) {
      return {
        ...fallback,
        ...parsed,
        options: Array.isArray(parsed.options) && parsed.options.length >= 2 ? parsed.options : fallback.options,
        correctIndex: Number.isFinite(parsed.correctIndex) ? parsed.correctIndex : fallback.correctIndex,
        source: "model",
      };
    }
    return { ...fallback, source: "template" };
  } catch {
    return { ...fallback, source: "template" };
  }
}

function extractActivityJson(text) {
  if (!text) return null;
  const clean = String(text).replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}


