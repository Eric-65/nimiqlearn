/* ============================================================
   NimiqLearn backend — holds the OpenAI API key server-side
   ------------------------------------------------------------
   NimiqLearn's frontend is a single-file static bundle (a Nimiq
   Pay Mini App); any secret embedded there ships to every
   visitor's browser. This tiny Express server is the real fix:
   the frontend calls it over HTTPS, and only this process ever
   sees the API key.

   Consolidated on OpenAI only (previously this also held a
   separate Claude-backed /api/teach route and, before that, a
   Hugging Face/GLM-5.3 route — both removed; see git history if
   that's ever useful). Three routes, one provider, one key:

     /api/tutor/health,
     /api/tutor/feedback   — the opt-in "Ask the AI Tutor" critique
                              on an ExplainBack result. See
                              docs/explainback-ai-tutor.md.
     /api/assess/feedback  — the PRIMARY ExplainBack grading call
                              (replaces the old on-device SmolLM2
                              model — see docs/ai-architecture.md).
     /api/learn/activity   — Learn tab content generation (same
                              replacement, for learnLoopService.js).

   All three share one configured-or-not check (OPENAI_API_KEY)
   and one error-handling helper below.

   Per the official Nimiq Mini Apps skill: "Mini apps can and
   should call external APIs and use server-side backends... the
   backend must include the mini app's origin in its
   Access-Control-Allow-Origin response header." See
   TEACHING_ALLOWED_ORIGIN below (applies to the whole app — one
   Mini App origin, one CORS policy, for every route here).
   ============================================================ */

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Loads server/.env into process.env — Node does NOT do this on its own.
// Uses Node's native loadEnvFile() (no extra dependency needed) rather than
// relying on the working directory, so `npm start` works the same whether
// it's launched from server/ or anywhere else. Missing .env is expected
// and fine in a real deployment, where the platform injects env vars
// directly instead of shipping a physical file.
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));
} catch {
  /* no .env file present — env vars may be set another way */
}

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.TEACHING_ALLOWED_ORIGIN || "*";
const MAX_MESSAGE_LENGTH = 4000;

/* ------------------ Reply language ------------------
   The learner picks a language in the app; every /api route accepts it and
   instructs the model to answer in it.

   Two rules here matter:

   1. The language is chosen from a SERVER-SIDE allow-list keyed by locale
      tag — the request's own `languageName` is never passed through to the
      prompt. That string arrives from the client, and text that reaches a
      system prompt unchecked is a prompt-injection vector: a crafted
      `languageName` ("English. Ignore all previous instructions and …")
      would otherwise be read by the model as instructions.

   2. An unknown or missing locale falls back to English rather than
      erroring. A learner should never lose AI feedback because a locale
      tag was not recognised.

   Keep in sync with src/i18n/locales.js. */
const REPLY_LANGUAGES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ko: "Korean",
  ja: "Japanese",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese (as used in Taiwan)",
};

const DEFAULT_REPLY_LANGUAGE = "English";

function replyLanguage(locale) {
  return (typeof locale === "string" && REPLY_LANGUAGES[locale]) || DEFAULT_REPLY_LANGUAGE;
}

/* Appended to every system prompt. Spelled out at length because the failure
   mode is specific: given English source material and an English rubric, a
   model will often answer in English regardless of a short "reply in X" —
   and half-translated feedback reads worse than none. JSON KEYS must stay
   English or the response stops parsing. */
function languageInstruction(locale) {
  const language = replyLanguage(locale);
  if (language === DEFAULT_REPLY_LANGUAGE) return "Write your reply in English.";
  return [
    `Write every piece of text you return in ${language}.`,
    `This applies to all of it — explanations, questions, answer choices, feedback and summaries — even though the topic material and the instructions above are in English.`,
    `Do NOT reply in English, and do not translate JSON keys: keys stay exactly as specified in English, only their string VALUES are in ${language}.`,
    `Use natural, everyday ${language} as a teacher would speak it, not a word-for-word translation of English phrasing.`,
  ].join(" ");
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openaiApiKey = process.env.OPENAI_API_KEY || null;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

if (!openaiApiKey) {
  console.warn(
    "[nimiqlearn-server] OPENAI_API_KEY is not set. The server will run, but " +
      "every /api route will report itself as not configured rather than " +
      "silently failing or faking a response."
  );
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "256kb" }));

/** Shared across all three routes — same key, same "is it configured" fact. */
app.get("/api/tutor/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(openaiClient) });
});

/** Shared error handling for every OpenAI call below — one place that
 * distinguishes a real auth problem, a real rate limit, and a real
 * upstream failure, instead of collapsing all three into one message. */
function respondToOpenAiError(err, res, label) {
  if (err instanceof OpenAI.AuthenticationError) {
    console.error(`[nimiqlearn-server] OpenAI authentication error (${label}):`, err.message);
    res.status(500).json({ ok: false, error: `${label} authentication failed. Check the server's OPENAI_API_KEY.` });
  } else if (err instanceof OpenAI.RateLimitError) {
    res.status(429).json({ ok: false, error: "Too many requests right now — please try again in a moment." });
  } else if (err instanceof OpenAI.APIError) {
    console.error(`[nimiqlearn-server] OpenAI API error (${label}):`, err.status, err.message);
    res.status(502).json({ ok: false, error: `${label} could not complete this request.` });
  } else {
    console.error(`[nimiqlearn-server] Unexpected OpenAI error (${label}):`, err);
    res.status(500).json({ ok: false, error: "An unexpected error occurred." });
  }
}

/* ---------------- ExplainBack AI Tutor (opt-in critique) ---------------- */

function buildTutorSystemPrompt(topic, locale) {
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

app.post("/api/tutor/feedback", async (req, res) => {
  if (!openaiClient) {
    res.status(503).json({ ok: false, error: "The AI Tutor is not configured on this server. Set OPENAI_API_KEY and restart." });
    return;
  }

  const { topic, referenceAnswer, learnerExplanation, assessment, locale } = req.body || {};

  if (typeof learnerExplanation !== "string" || !learnerExplanation.trim()) {
    res.status(400).json({ ok: false, error: "A non-empty 'learnerExplanation' string is required." });
    return;
  }
  if (learnerExplanation.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ ok: false, error: `'learnerExplanation' exceeds ${MAX_MESSAGE_LENGTH} characters.` });
    return;
  }
  if (referenceAnswer !== undefined && referenceAnswer !== null && typeof referenceAnswer !== "string") {
    res.status(400).json({ ok: false, error: "'referenceAnswer' must be a string when provided." });
    return;
  }

  const assessmentSummary =
    assessment && typeof assessment === "object"
      ? [
          typeof assessment.score === "number" ? `Rubric score: ${assessment.score}/100.` : null,
          Array.isArray(assessment.missingConcepts) && assessment.missingConcepts.length
            ? `Flagged as missing: ${assessment.missingConcepts.join("; ")}.`
            : null,
          Array.isArray(assessment.misconceptions) && assessment.misconceptions.length
            ? `Possible misconception: ${assessment.misconceptions.join("; ")}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const userMessage = [
    referenceAnswer ? `Reference explanation: ${referenceAnswer}` : null,
    `Learner's explanation: ${learnerExplanation}`,
    assessmentSummary ? `App's own grading: ${assessmentSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: "system", content: buildTutorSystemPrompt(topic, locale) },
        { role: "user", content: userMessage },
      ],
    });
    res.json({ ok: true, feedback: completion.choices?.[0]?.message?.content || "" });
  } catch (err) {
    respondToOpenAiError(err, res, "The AI Tutor");
  }
});

/* ---------------- ExplainBack primary grading ---------------- */
/* Replaces the old on-device SmolLM2 call — same job (turn a deterministic
   rubric signal into natural-language feedback + a structured score),
   different transport (server call instead of a multi-hundred-MB
   in-browser model download, which was the actual source of the delay
   this replaced). */

function buildAssessSystemPrompt(locale) {
  return [
    "You are NimiqLearn, a concise educational assessment assistant.",
    "You will be given a deterministic assessment signal (score, missing concepts, possible misconceptions) already computed for the learner's explanation. Use it as ground truth — do not contradict it.",
    "Your job is to turn it into warm, concrete, natural-language feedback and one next challenge.",
    'Return ONLY a JSON object with this exact shape: {"summary": "1-2 sentences", "strengths": ["..."], "missingConcepts": ["..."], "misconceptions": ["..."], "masteryEstimate": 0, "nextAction": "one sentence", "nextChallenge": "one question"}',
    "masteryEstimate MUST be a whole number from 0 to 100 (matching the scale of the rubric score you were given, e.g. 55 means 55/100) — never a 0-1 fraction.",
    languageInstruction(locale),
  ].join(" ");
}

app.post("/api/assess/feedback", async (req, res) => {
  if (!openaiClient) {
    res.status(503).json({ ok: false, error: "ExplainBack grading is not configured on this server. Set OPENAI_API_KEY and restart." });
    return;
  }

  const { topic, learnerExplanation, learnerLevel, baseline } = req.body || {};

  if (typeof learnerExplanation !== "string" || !learnerExplanation.trim()) {
    res.status(400).json({ ok: false, error: "A non-empty 'learnerExplanation' string is required." });
    return;
  }
  if (learnerExplanation.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ ok: false, error: `'learnerExplanation' exceeds ${MAX_MESSAGE_LENGTH} characters.` });
    return;
  }

  const signalBlock =
    baseline && typeof baseline === "object"
      ? `Assessment score: ${baseline.score ?? "unknown"}/100\nMissing concepts: ${(baseline.missingConcepts || []).join(" | ") || "none detected"}\nPossible misconceptions: ${(baseline.misconceptions || []).join(" | ") || "none detected"}`
      : "";

  const userMessage = [
    `Concept: ${topic || "unspecified"}`,
    `Level: ${learnerLevel || "beginner"}`,
    `Learner explanation: ${learnerExplanation}`,
    signalBlock,
    "Give concise educational feedback and one next challenge. Return the JSON assessment.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildAssessSystemPrompt(req.body?.locale) },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      res.status(502).json({ ok: false, error: "ExplainBack grading returned unreadable output." });
      return;
    }
    // The rubric score is deterministic ground truth (see prompt above) —
    // never trust the model to echo it back correctly at the right scale.
    // Overridden server-side rather than merely asked for, since a prompt
    // instruction is not a guarantee.
    if (baseline && typeof baseline === "object" && typeof baseline.score === "number") {
      value.masteryEstimate = baseline.score;
    }
    res.json({ ok: true, value });
  } catch (err) {
    respondToOpenAiError(err, res, "ExplainBack grading");
  }
});

/* ---------------- Learn tab activity content ---------------- */
/* Replaces the old on-device SmolLM2 call in learnLoopService.js. LearnLoop
   itself still decides WHICH activity comes next (unchanged, deterministic)
   — this only generates the content for the activity already chosen. */

/** Quiz-style activities: the question IS the whole activity. REVIEW is
 * included deliberately — a spaced review the learner can only self-rate
 * ("I recalled it") teaches nothing about whether they actually did. */
const QUIZ_ACTIVITY_TYPES = new Set(["MULTIPLE_CHOICE", "PRACTICE", "REVIEW"]);

/** Teaching activities: explain the idea first, then check that it landed.
 * These previously rendered a question with nothing to answer it with —
 * the model produced a question, the UI showed it, and the only control
 * was "Got it — continue". */
const EXPLANATION_ACTIVITY_TYPES = new Set(["SHORT_EXPLANATION", "ANALOGY", "EXAMPLE"]);

/** Everything that must come back with an answerable options array.
 * OPEN_RESPONSE and EXPLAIN_BACK are deliberately absent: those are
 * free-text by design and options would break them. */
const ANSWERABLE_ACTIVITY_TYPES = new Set([...QUIZ_ACTIVITY_TYPES, ...EXPLANATION_ACTIVITY_TYPES]);

/** Cleans a list of short strings from the client for use inside a prompt. */
function cleanList(list, max, maxLen) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => typeof s === "string" && s.trim())
    .slice(-max)
    .map((s) => `"${s.trim().slice(0, maxLen)}"`);
}

function buildActivitySystemPrompt({ type, level, topicName, topicDescription, targetMisconception, previousQuestions = [], previousAngles = [], locale }) {
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
function spreadCorrectAnswer(value, type) {
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

app.post("/api/learn/activity", async (req, res) => {
  if (!openaiClient) {
    res.status(503).json({ ok: false, error: "Learn activity generation is not configured on this server. Set OPENAI_API_KEY and restart." });
    return;
  }

  const { type, topicName, topicDescription, topicContent, level, targetMisconception, previousQuestions, previousAngles } = req.body || {};

  if (typeof type !== "string" || !type.trim() || typeof topicName !== "string" || !topicName.trim()) {
    res.status(400).json({ ok: false, error: "'type' and 'topicName' are required strings." });
    return;
  }

  const prevQs = Array.isArray(previousQuestions) ? previousQuestions : [];
  const prevAngles = Array.isArray(previousAngles) ? previousAngles : [];
  const systemPrompt = buildActivitySystemPrompt({
    type,
    level: level || "beginner",
    topicName,
    topicDescription,
    targetMisconception,
    previousQuestions: prevQs,
    previousAngles: prevAngles,
    locale: req.body?.locale,
  });
  const userMessage = `Topic content reference: ${JSON.stringify(topicContent || {}).slice(0, 2000)}`;

  const generate = async (extraInstruction, temperature) => {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: extraInstruction ? `${systemPrompt} ${extraInstruction}` : systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  try {
    let value = await generate("", 0.4);
    if (!value) {
      res.status(502).json({ ok: false, error: "Activity generation returned unreadable output." });
      return;
    }

    // The prompt tells the model not to repeat a question, and it still
    // does — verbatim, under a freshly-worded "angle" — often enough to
    // matter. So it's checked here rather than trusted: one retry at a
    // higher temperature with the specific repeat called out. (Same
    // principle as spreadCorrectAnswer(): verify what a prompt only asks
    // for.)
    const repeated = findRepeatedQuestion(value?.question, prevQs);
    if (repeated) {
      const retry = await generate(
        `IMPORTANT: your previous attempt repeated an already-asked question: "${repeated}". That is not acceptable. Choose a completely different sub-aspect of ${topicName} and ask something that shares no more than a couple of words with any question listed above.`,
        0.75
      );
      if (retry && !findRepeatedQuestion(retry?.question, prevQs)) value = retry;
    }

    res.json({ ok: true, value: spreadCorrectAnswer(value, type) });
  } catch (err) {
    respondToOpenAiError(err, res, "Activity generation");
  }
});

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
function findRepeatedQuestion(question, previousQuestions) {
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

app.listen(PORT, () => {
  console.log(`[nimiqlearn-server] Listening on port ${PORT} (OpenAI configured: ${Boolean(openaiClient)})`);
});
