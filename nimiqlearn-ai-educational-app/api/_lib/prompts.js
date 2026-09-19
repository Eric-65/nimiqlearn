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

/* ------------------------------------------------------------------
   Nimiq grounding
   ------------------------------------------------------------------
   The curriculum now teaches Nimiq itself, so the model has to be RIGHT
   about it rather than fluent. These facts come from the official Nimiq
   Mini Apps documentation and are the only Nimiq specifics the model is
   licensed to state as fact.

   This is grounding, not retrieval: the model cannot read nimiq.dev, X
   or the live web from here, and inventing supply figures, prices,
   roadmap dates or partnership claims is exactly how a confident
   educational app teaches something false. Hence the closing rule —
   anything outside this block is either reasoned from it or declined.
   ------------------------------------------------------------------ */
const NIMIQ_FACTS = [
  "Nimiq is the blockchain; NIM is its native coin. They are not interchangeable names.",
  "NIM's smallest unit is the Luna: 1 NIM = 100,000 Luna. Provider transaction methods take Luna, not NIM.",
  "Nimiq is proof-of-stake — validators stake NIM to produce blocks; there is no proof-of-work mining.",
  "Nimiq addresses are human-readable, begin with NQ, and are printed in nine groups of four characters.",
  "A client can read the block height without consensus, but must not trust a balance until consensus is established.",
  "Nimiq Pay is a mobile wallet that also hosts mini apps: web apps in a WebView that reach the wallet through injected providers.",
  "A mini app never sees a private key. Account access, message signing and transactions each need the person's explicit approval in a native dialog; reading chain state does not.",
  "Mini apps reach NIM through the Mini App SDK and EVM chains through window.ethereum. USDT and USDC use 6 decimals, not 18.",
  "Nimiq has a testnet, where free test NIM is available, so payment flows can be demonstrated without real funds.",
].map((f) => `- ${f}`).join("\n");

/* Matches the Nimiq branch of the curriculum tree in
   src/data/mockTopics.js. Kept as ids, not a name substring, so a maths
   topic that merely mentions a wallet is never mistaken for one. */
const NIMIQ_TOPIC_IDS = new Set(["nimiq", "nimiq-essentials", "nimiq-blockchain", "nim-token", "nimiq-pay"]);

export function isNimiqTopic(topicId) {
  return typeof topicId === "string" && NIMIQ_TOPIC_IDS.has(topicId);
}

/* Beginner and advanced are genuinely different lessons about the same
   fact, not the same lesson at two reading speeds. */
function levelGuidance(level) {
  const l = String(level || "").toLowerCase();
  if (l.startsWith("adv")) {
    return "Pitch this at an ADVANCED learner: use the precise term, give the exact mechanism or unit, and name the edge case or failure mode a practitioner would actually hit. Do not pad with reassurance.";
  }
  return "Pitch this at a BEGINNER: one idea at a time, concrete before abstract, and define a term the first time it appears. Never assume prior blockchain or programming knowledge.";
}

function nimiqGrounding(level) {
  return [
    "This topic is about Nimiq itself, so the following are the authoritative facts. Teach from them and do not contradict them:",
    NIMIQ_FACTS,
    levelGuidance(level),
    "If the learner asks something these facts do not cover — token price, market data, supply figures, roadmap, team or partnerships — say plainly that you do not have that information and point them at the official Nimiq documentation, rather than guessing.",
  ].join("\n");
}

export function buildTutorSystemPrompt(topic, locale, { topicId, level } = {}) {
  const nimiq = isNimiqTopic(topicId);
  return [
    "You are NimiqLearn AI, an encouraging tutor built into the ExplainBack feature of the NimiqLearn educational app.",
    topic ? `The learner is explaining: ${topic}.` : "The learner is explaining a concept.",
    "The app's own rubric grader has already scored their explanation — you are given that score and its findings.",
    "Confirm what they got right, clearly name what's missing or wrong, and if their explanation is incomplete or partly incorrect, give a short, complete, correct explanation of the concept so they have something solid to compare against.",
    "Keep the whole reply under about 180 words, plain prose, no markdown headers or bullet lists.",
    /* The blanket ban had to go conditional once Nimiq became something the
       app teaches: on a Nimiq topic it would gag the tutor on the very
       subject being explained. On every other topic it still holds — a
       learner explaining quadratics has no business being sold a wallet. */
    nimiq
      ? nimiqGrounding(level)
      : "Never discuss wallets, payments, or blockchain transactions — that is a separate, unrelated part of the app.",
    languageInstruction(locale),
  ].join(" ");
}

/**
 * "Ask about this lesson": a free question from a learner who has a topic
 * open, answered from the topic's own content. Same grounding rules as
 * the tutor — the Nimiq-topic exception included — plus two of its own:
 * stay on THIS topic (a question about something else gets a one-line
 * redirect, not a lecture), and if the question cannot be answered from
 * the reference content, say so rather than improvise.
 */
export function buildQuestionSystemPrompt({ topicName, topicId, level, locale }) {
  const nimiq = isNimiqTopic(topicId);
  return [
    "You are NimiqLearn AI, a tutor built into the NimiqLearn educational app.",
    `The learner has the lesson "${topicName}" open and has asked a question about it.`,
    "Answer the question directly and correctly, then — only if it helps — add one short example or one thing to watch out for.",
    "Ground the answer in the topic reference you are given. If the reference does not cover it and you are not certain, say plainly what you do not know rather than guessing.",
    `If the question is not about "${topicName}", say in one sentence that this box is for questions about this lesson and suggest the Learn tab for other topics. Do not answer the off-topic question.`,
    "Keep the whole reply under about 160 words, plain prose, no markdown headers or bullet lists.",
    nimiq
      ? nimiqGrounding(level)
      : "Never discuss wallets, payments, or blockchain transactions — that is a separate, unrelated part of the app.",
    levelGuidance(level),
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

export function buildActivitySystemPrompt({ type, level, topicId, topicName, topicDescription, targetMisconception, previousQuestions = [], previousAngles = [], locale }) {
  const needsChoices = ANSWERABLE_ACTIVITY_TYPES.has(type);
  const isExplanation = EXPLANATION_ACTIVITY_TYPES.has(type);
  const alreadyAsked = cleanList(previousQuestions, 8, 200);
  const anglesCovered = cleanList(previousAngles, 8, 80);
  const hasHistory = alreadyAsked.length > 0 || anglesCovered.length > 0;
  return [
    "You are NimiqLearn, an adaptive tutor. Generate a short, clear learning activity.",
    `Learner level: ${level}.`,
    levelGuidance(level),
    `Activity type: ${type}.`,
    `Topic: ${topicName}.`,
    topicDescription ? `Description: ${topicDescription}.` : "",
    isNimiqTopic(topicId) ? nimiqGrounding(level) : "",
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
