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

function buildTutorSystemPrompt(topic) {
  return [
    "You are NimiqLearn AI, an encouraging tutor built into the ExplainBack feature of the NimiqLearn educational app.",
    topic ? `The learner is explaining: ${topic}.` : "The learner is explaining a concept.",
    "The app's own rubric grader has already scored their explanation — you are given that score and its findings.",
    "Confirm what they got right, clearly name what's missing or wrong, and if their explanation is incomplete or partly incorrect, give a short, complete, correct explanation of the concept so they have something solid to compare against.",
    "Keep the whole reply under about 180 words, plain prose, no markdown headers or bullet lists.",
    "Never discuss wallets, payments, or blockchain transactions — that is a separate, unrelated part of the app.",
  ].join(" ");
}

app.post("/api/tutor/feedback", async (req, res) => {
  if (!openaiClient) {
    res.status(503).json({ ok: false, error: "The AI Tutor is not configured on this server. Set OPENAI_API_KEY and restart." });
    return;
  }

  const { topic, referenceAnswer, learnerExplanation, assessment } = req.body || {};

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
        { role: "system", content: buildTutorSystemPrompt(topic) },
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

function buildAssessSystemPrompt() {
  return [
    "You are NimiqLearn, a concise educational assessment assistant.",
    "You will be given a deterministic assessment signal (score, missing concepts, possible misconceptions) already computed for the learner's explanation. Use it as ground truth — do not contradict it.",
    "Your job is to turn it into warm, concrete, natural-language feedback and one next challenge.",
    'Return ONLY a JSON object with this exact shape: {"summary": "1-2 sentences", "strengths": ["..."], "missingConcepts": ["..."], "misconceptions": ["..."], "masteryEstimate": 0, "nextAction": "one sentence", "nextChallenge": "one question"}',
    "masteryEstimate MUST be a whole number from 0 to 100 (matching the scale of the rubric score you were given, e.g. 55 means 55/100) — never a 0-1 fraction.",
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
        { role: "system", content: buildAssessSystemPrompt() },
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

function buildActivitySystemPrompt({ type, level, topicName, topicDescription, targetMisconception }) {
  return [
    "You are NimiqLearn, an adaptive tutor. Generate a short, clear learning activity.",
    `Learner level: ${level}.`,
    `Activity type: ${type}.`,
    `Topic: ${topicName}.`,
    topicDescription ? `Description: ${topicDescription}.` : "",
    targetMisconception ? `Target the misconception: "${targetMisconception}".` : "",
    'Return ONLY a JSON object with this exact shape: {"prompt": "one-line instruction to the learner", "body": "optional 1-2 sentence content", "question": "the question or task", "options": ["array of options - only for MULTIPLE_CHOICE and PRACTICE"], "correctIndex": 0, "explanation": "brief explanation of the correct answer"}',
  ]
    .filter(Boolean)
    .join(" ");
}

app.post("/api/learn/activity", async (req, res) => {
  if (!openaiClient) {
    res.status(503).json({ ok: false, error: "Learn activity generation is not configured on this server. Set OPENAI_API_KEY and restart." });
    return;
  }

  const { type, topicName, topicDescription, topicContent, level, targetMisconception } = req.body || {};

  if (typeof type !== "string" || !type.trim() || typeof topicName !== "string" || !topicName.trim()) {
    res.status(400).json({ ok: false, error: "'type' and 'topicName' are required strings." });
    return;
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildActivitySystemPrompt({ type, level: level || "beginner", topicName, topicDescription, targetMisconception }) },
        { role: "user", content: `Topic content reference: ${JSON.stringify(topicContent || {}).slice(0, 2000)}` },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      res.status(502).json({ ok: false, error: "Activity generation returned unreadable output." });
      return;
    }
    res.json({ ok: true, value });
  } catch (err) {
    respondToOpenAiError(err, res, "Activity generation");
  }
});

app.listen(PORT, () => {
  console.log(`[nimiqlearn-server] Listening on port ${PORT} (OpenAI configured: ${Boolean(openaiClient)})`);
});
