/* ============================================================
   NimiqLearn — Learn Concept teaching backend
   ------------------------------------------------------------
   Holds ANTHROPIC_API_KEY server-side. NimiqLearn's frontend is a
   single-file static bundle (a Nimiq Pay Mini App) — any secret
   embedded there ships to every visitor's browser. This tiny
   Express server is the real fix: the frontend calls it over
   HTTPS, and only this process ever sees the API key.

   Per the official Nimiq Mini Apps skill: "Mini apps can and
   should call external APIs and use server-side backends... the
   backend must include the mini app's origin in its
   Access-Control-Allow-Origin response header." See
   TEACHING_ALLOWED_ORIGIN below.
   ============================================================ */

import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

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

app.listen(PORT, () => {
  console.log(`[teaching-server] Listening on port ${PORT} (configured: ${Boolean(client)})`);
});
