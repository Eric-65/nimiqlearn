/* ============================================================
   NimiqLearn local dev server
   ------------------------------------------------------------
   In PRODUCTION the API is not this file. The four routes are
   Vercel serverless functions living in
   ../nimiqlearn-ai-educational-app/api/, deployed alongside the
   frontend on the same origin, so the browser calls /api/... with
   no separate backend to run, host or point at.

   This file exists for local development only: `npm run dev` in
   the app directory serves the frontend on one port and does not
   run the functions, so this puts the same routes on :8787.

   It is deliberately thin. Every prompt, every validation rule
   and every error mapping lives in the shared api/_lib/ modules
   that the serverless functions also import — so what you test
   locally is the same code that runs in production, not a
   lookalike that can drift.
   ============================================================ */

import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Loads server/.env into process.env — Node does NOT do this on its own.
// Uses Node's native loadEnvFile() (no extra dependency needed) rather than
// relying on the working directory, so `npm start` works the same whether
// it's launched from server/ or anywhere else. Missing .env is expected
// and fine in a real deployment, where the platform injects env vars
// directly instead of shipping a physical file.
//
// This runs before the dynamic import below on purpose: a static `import`
// would be evaluated BEFORE this line, and the shared modules would then
// read an OPENAI_API_KEY that had not been loaded yet. (They also build
// their OpenAI client lazily, so either guard alone would do — but the
// order here is the one that is obvious to a reader.)
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));
} catch {
  /* no .env file present — env vars may be set another way */
}

const { handleHealth, handleTutorFeedback, handleAssessFeedback, handleLearnActivity, handleLessonQuestion } = await import(
  "../nimiqlearn-ai-educational-app/api/_lib/handlers.js"
);

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.TEACHING_ALLOWED_ORIGIN || "*";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "256kb" }));

/** Adapts a shared { status, json } handler to Express. */
function route(handler) {
  return async (req, res) => {
    try {
      const { status, json } = await handler(req.body || {});
      res.status(status).json(json);
    } catch (err) {
      console.error(`[nimiqlearn-server] Unhandled error in ${req.path}:`, err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred." });
    }
  };
}

app.get("/api/tutor/health", route(async () => handleHealth()));
app.post("/api/tutor/feedback", route(handleTutorFeedback));
app.post("/api/assess/feedback", route(handleAssessFeedback));
app.post("/api/learn/activity", route(handleLearnActivity));
app.post("/api/learn/question", route(handleLessonQuestion));

app.listen(PORT, () => {
  console.log(
    `[nimiqlearn-server] Listening on port ${PORT} (OpenAI configured: ${Boolean(process.env.OPENAI_API_KEY)})`
  );
});
