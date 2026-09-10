/* ============================================================
   NimiqLearn backend — holds every AI provider secret server-side
   ------------------------------------------------------------
   NimiqLearn's frontend is a single-file static bundle (a Nimiq
   Pay Mini App); any secret embedded there ships to every
   visitor's browser. This tiny Express server is the real fix:
   the frontend calls it over HTTPS, and only this process ever
   sees an API key. Two independent AI features live here, each
   with its own key and its own configured-or-not check:

     /api/health, /api/teach     — Claude, ANTHROPIC_API_KEY
                                    (Learn Concept, currently unused
                                    by any page — see docs/learn-concept.md)
     /api/tutor/health,
     /api/tutor/feedback         — OpenAI (ChatGPT), OPENAI_API_KEY —
                                    the ExplainBack AI Tutor, see
                                    docs/explainback-ai-tutor.md

   Per the official Nimiq Mini Apps skill: "Mini apps can and
   should call external APIs and use server-side backends... the
   backend must include the mini app's origin in its
   Access-Control-Allow-Origin response header." See
   TEACHING_ALLOWED_ORIGIN below (applies to the whole app — one
   Mini App origin, one CORS policy, for every route here).
   ============================================================ */

import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
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
const MODEL = "claude-opus-5";
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

const apiKey = process.env.ANTHROPIC_API_KEY || null;
const client = apiKey ? new Anthropic({ apiKey }) : null;

if (!apiKey) {
  console.warn(
    "[teaching-server] ANTHROPIC_API_KEY is not set. The server will run, " +
      "but /api/teach will report itself as not configured rather than " +
      "silently failing or faking a response."
  );
}

// OpenAI (ChatGPT) — same secret-handling shape as the Claude client
// above, never bundled into the frontend. OPENAI_MODEL is configurable
// rather than hard-coded to one snapshot, since the right model for a
// given account/credits can change; defaults to a current, cost-effective
// chat model suited to short tutoring replies.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openaiApiKey = process.env.OPENAI_API_KEY || null;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

if (!openaiApiKey) {
  console.warn(
    "[teaching-server] OPENAI_API_KEY is not set. The server will run, but " +
      "/api/tutor/feedback will report itself as not configured rather " +
      "than silently failing or faking a response."
  );
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(client) });
});

function buildSystemPrompt(topic) {
  return [
    "You are a patient, encouraging tutor inside NimiqLearn, an educational app.",
    topic ? `The learner wants to learn: ${topic}.` : "The learner has an open question.",
    "Explain concepts clearly and step by step, using concrete examples before abstract notation.",
    "Keep responses focused — a few short paragraphs or a short worked example, not an exhaustive textbook chapter.",
    "If the learner seems confused, check their understanding with a quick question before moving on.",
    "Never discuss anything about wallets, payments, or blockchain transactions — that is a separate, unrelated part of the app.",
  ].join(" ");
}

app.post("/api/teach", async (req, res) => {
  if (!client) {
    res.status(503).json({
      ok: false,
      error: "Claude teaching is not configured on this server. Set ANTHROPIC_API_KEY and restart.",
    });
    return;
  }

  const { topic, message, history } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ ok: false, error: "A non-empty 'message' string is required." });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ ok: false, error: `'message' exceeds ${MAX_MESSAGE_LENGTH} characters.` });
    return;
  }
  if (history !== undefined && !Array.isArray(history)) {
    res.status(400).json({ ok: false, error: "'history' must be an array when provided." });
    return;
  }

  const cleanHistory = (history || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY_MESSAGES);

  const messages = [...cleanHistory.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(topic),
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    res.json({ ok: true, reply: textBlock?.text || "", stopReason: response.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[teaching-server] Anthropic authentication error:", err.message);
      res.status(500).json({ ok: false, error: "Teaching service authentication failed. Check the server's ANTHROPIC_API_KEY." });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ ok: false, error: "Too many requests right now — please try again in a moment." });
    } else if (err instanceof Anthropic.APIError) {
      console.error("[teaching-server] Anthropic API error:", err.status, err.message);
      res.status(502).json({ ok: false, error: "The teaching service could not complete this request." });
    } else {
      console.error("[teaching-server] Unexpected error:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred." });
    }
  }
});

/* ---------------- ExplainBack AI Tutor (OpenAI / ChatGPT) ---------------- */

app.get("/api/tutor/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(openaiClient) });
});

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
    res.status(503).json({
      ok: false,
      error: "The AI Tutor is not configured on this server. Set OPENAI_API_KEY and restart.",
    });
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

    const feedback = completion.choices?.[0]?.message?.content || "";
    res.json({ ok: true, feedback });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      console.error("[teaching-server] OpenAI authentication error:", err.message);
      res.status(500).json({ ok: false, error: "AI Tutor authentication failed. Check the server's OPENAI_API_KEY." });
    } else if (err instanceof OpenAI.RateLimitError) {
      res.status(429).json({ ok: false, error: "Too many requests right now — please try again in a moment." });
    } else if (err instanceof OpenAI.APIError) {
      console.error("[teaching-server] OpenAI API error:", err.status, err.message);
      res.status(502).json({ ok: false, error: "The AI Tutor could not complete this request." });
    } else {
      console.error("[teaching-server] Unexpected OpenAI Tutor error:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred." });
    }
  }
});

app.listen(PORT, () => {
  console.log(
    `[teaching-server] Listening on port ${PORT} (Claude teaching configured: ${Boolean(client)}, OpenAI AI Tutor configured: ${Boolean(openaiClient)})`
  );
});
