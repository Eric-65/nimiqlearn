/* ============================================================
   NimiqLearn API — system prompts and response post-processing
   ------------------------------------------------------------
   Lifted verbatim out of the old single-file Express server when
   the routes became serverless functions. Shared by both
   transports so the prompts — which ARE the product here — exist
   in exactly one place and cannot drift between local dev and
   production.
   ============================================================ */

import { languageInstruction } from "./openai.js";

export function buildTutorSystemPrompt(topic, locale) {
  return [
    "You are NimiqLearn AI, an encouraging tutor built into the ExplainBack feature of the NimiqLearn educational app.",
    topic ? `The learner is explaining: ${topic}.` : "The learner is explaining a concept.",
    "The app's own rubric grader has already scored their explanation — you are given that score and its findings.",
    "Confirm what they got right, clearly name what's missing or wrong, and if their explanation is incomplete or partly incorrect, give a short, complete, correct explanation of the concept so they have something solid to compare against.",
    "Keep the whole reply under about 180 words, plain prose, no markdown headers or bullet lists.",
    "Never discuss wallets, payments, or blockchain transactions — that is a separate, unrelated part of the app.",
    languageInstruction(locale),
  ].join(" ");
}

export function buildAssessSystemPrompt(locale) {
  return [
    "You are NimiqLearn, a concise educational assessment assistant.",
    "You will be given a deterministic assessment signal (score, missing concepts, possible misconceptions) already computed for the learner's explanation. Use it as ground truth — do not contradict it.",
    "Your job is to turn it into warm, concrete, natural-language feedback and one next challenge.",
    'Return ONLY a JSON object with this exact shape: {"summary": "1-2 sentences", "strengths": ["..."], "missingConcepts": ["..."], "misconceptions": ["..."], "masteryEstimate": 0, "nextAction": "one sentence", "nextChallenge": "one question"}',
    "masteryEstimate MUST be a whole number from 0 to 100 (matching the scale of the rubric score you were given, e.g. 55 means 55/100) — never a 0-1 fraction.",
    languageInstruction(locale),
  ].join(" ");
}

/** Quiz-style activities: the question IS the whole activity. REVIEW is
 * included deliberately — a spaced review the learner can only self-rate
 * ("I recalled it") teaches nothing about whether they actually did. */
export const QUIZ_ACTIVITY_TYPES = new Set(["MULTIPLE_CHOICE", "PRACTICE", "REVIEW"]);

/** Teaching activities: explain the idea first, then check that it landed.
 * These previously rendered a question with nothing to answer it with —
 * the model produced a question, the UI showed it, and the only control
 * was "Got it — continue". */
export const EXPLANATION_ACTIVITY_TYPES = new Set(["SHORT_EXPLANATION", "ANALOGY", "EXAMPLE"]);

/** Everything that must come back with an answerable options array.
 * OPEN_RESPONSE and EXPLAIN_BACK are deliberately absent: those are
 * free-text by design and options would break them. */
export const ANSWERABLE_ACTIVITY_TYPES = new Set([...QUIZ_ACTIVITY_TYPES, ...EXPLANATION_ACTIVITY_TYPES]);

/** Cleans a list of short strings from the client for use inside a prompt. */
function cleanList(list, max, maxLen) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => typeof s === "string" && s.trim())
    .slice(-max)
    .map((s) => `"${s.trim().slice(0, maxLen)}"`);
}

export function buildActivitySystemPrompt({ type, level, topicName, topicDescription, targetMisconception, previousQuestions = [], previousAngles = [], locale }) {
  const needsChoices = ANSWERABLE_ACTIVITY_TYPES.has(type);
  const isExplanation = EXPLANATION_ACTIVITY_TYPES.has(type);
  const alreadyAsked = cleanList(previousQuestions, 8, 200);
  const anglesCovered = cleanList(previousAngles, 8, 80);
  const hasHistory = alreadyAsked.length > 0 || anglesCovered.length > 0;
  return [
    "You are NimiqLearn, an adaptive tutor. Generate a short, clear learning activity.",
    `Learner level: ${level}.`,
    `Activity type: ${type}.`,
    `Topic: ${topicName}.`,
    topicDescription ? `Description: ${topicDescription}.` : "",
    targetMisconception ? `Target the misconception: "${targetMisconception}".` : "",
    'Return ONLY a JSON object with this exact shape: {"angle": "the one specific sub-aspect of the topic this activity is about, 3-8 words", "prompt": "one-line instruction to the learner", "body": "optional 1-2 sentence content", "question": "the question or task", "options": ["answer choices"], "correctIndex": 0, "explanation": "brief explanation of the correct answer"}',
    "Every topic has many distinct sub-aspects: individual rules or formulas, each variable's role, edge cases, common mistakes, a worked numeric example, a real-world application, a comparison with a related idea, what happens when one quantity changes. Pick exactly ONE for this activity and name it in 'angle'.",
    isExplanation
      ? "Teach first: put the explanation itself in 'prompt' and 'body', focused on THIS activity's angle only. Then 'question' must check understanding of what you just explained — never ask about something the explanation did not cover."
      : "",
    needsChoices
      ? [
          "This activity type MUST include a real, answerable question about the topic plus an 'options' array of 3 or 4 answer choices.",
          "Exactly one option is correct; the rest must be plausible but genuinely wrong (a common misunderstanding makes the best wrong answer).",
          "'correctIndex' is the 0-based position of the correct option and MUST match it.",
          "Vary which position the correct answer sits in — do not always put it first.",
          "Keep each option to one short sentence, and never label options with letters or numbers.",
          "Never return a 'question' without a matching 'options' array — a question the learner cannot answer is worse than no question at all.",
        ].join(" ")
      : "This activity type is answered in free text; do not include an 'options' array.",
    hasHistory
      ? [
          "This learner has ALREADY done activities on this topic, so this one must be genuinely new — not a variation.",
          anglesCovered.length ? `Sub-aspects already covered: ${anglesCovered.join(", ")}. Choose an 'angle' that is NOT any of these and not a rewording of them.` : "",
          alreadyAsked.length ? `Questions already asked: ${alreadyAsked.join(", ")}. Do not repeat any of them or reword one with different phrasing.` : "",
          "Do NOT restate the topic's general definition again in 'body' — it has been taught. Teach only the new angle.",
          "Also change the FORMAT from earlier activities: if previous ones were conceptual, make this a concrete worked/numeric example, a real-world scenario, a compare-and-contrast, or a spot-the-mistake; if previous ones were examples, go conceptual.",
        ]
          .filter(Boolean)
          .join(" ")
      : "",
    languageInstruction(locale),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Moves the correct answer out of position 0.
 *
 * The prompt asks the model to vary where the correct option sits, but it
 * reliably puts it first anyway — and a quiz whose answer is always the
 * first option teaches position, not the topic. Enforced here in code
 * rather than trusted to the prompt, and rotated deterministically from
 * the question text so the same question keeps a stable layout instead of
 * reshuffling under the learner on a re-render. */
export function spreadCorrectAnswer(value, type) {
  if (!ANSWERABLE_ACTIVITY_TYPES.has(type)) return value;
  const options = value?.options;
  const correctIndex = value?.correctIndex;
  const valid =
    Array.isArray(options) &&
    options.length >= 2 &&
    Number.isInteger(correctIndex) &&
    correctIndex >= 0 &&
    correctIndex < options.length;
  if (!valid) return value;

  const seed = String(value.question || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const shift = seed % options.length;
  if (shift === 0) return value;

  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return {
    ...value,
    options: rotated,
    correctIndex: (correctIndex - shift + options.length) % options.length,
  };
}

/** Normalises a question for comparison: lowercase, no punctuation,
 * collapsed whitespace. */
function normaliseQuestion(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the previously-asked question this one repeats, or null.
 * Catches an exact match after normalisation, and also a near-rewording
 * (Jaccard word overlap >= 0.8) so "net force" -> "force applied" swaps
 * don't slip through as "different". */
export function findRepeatedQuestion(question, previousQuestions) {
  const current = normaliseQuestion(question);
  if (!current) return null;
  const currentWords = new Set(current.split(" "));
  for (const prev of previousQuestions) {
    const normPrev = normaliseQuestion(prev);
    if (!normPrev) continue;
    if (normPrev === current) return prev;
    const prevWords = new Set(normPrev.split(" "));
    let shared = 0;
    for (const w of currentWords) if (prevWords.has(w)) shared++;
    const jaccard = shared / (currentWords.size + prevWords.size - shared);
    if (jaccard >= 0.8) return prev;
  }
  return null;
}
