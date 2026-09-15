# NimiqLearn — OpenAI backend (ExplainBack grading, AI Tutor, Learn activities)

> **Deployment note.** In production these routes are Vercel serverless
> functions in `api/`, not the Express server in `../server/` — that one is
> for local development only. Both import the same handlers from
> `api/_lib/`. See [deploying-to-vercel.md](./deploying-to-vercel.md).

NimiqLearn's AI is entirely OpenAI-backed now, via one small Express server
(`server/`). Three routes, one key, one provider:

- **`POST /api/assess/feedback`** — ExplainBack's PRIMARY grading call.
  Turns a learner's explanation into a score, strengths, missing concepts,
  misconceptions, and a next challenge. Runs on every "Check My
  Understanding" submission.
- **`POST /api/tutor/feedback`** — the opt-in "Ask the AI Tutor" critique on
  an ExplainBack result (`src/components/ai/AITutorPanel.jsx`). A second,
  separate, user-triggered look at the same explanation.
- **`POST /api/learn/activity`** — Learn tab content generation
  (`learnLoopService.js`). LearnLoop's own activity-selection logic stays
  deterministic; this only fills in the content once a choice is made.

All three share `GET /api/tutor/health` for their "is this configured"
check, since it's the same `OPENAI_API_KEY` either way.

## History: this replaced two other systems, not just GLM-5.3

This backend was built in three passes:

1. First, an opt-in "AI Tutor" was added to ExplainBack, calling GLM-5.3 via
   Hugging Face's router (a 320B-parameter model — the only technically
   viable path at the time, since it can't run on-device).
2. Then swapped to OpenAI, because that's the provider with a real, funded
   API key.
3. Then **ExplainBack's primary grading and the Learn tab's activity
   generation were also moved onto this same OpenAI backend**, replacing:
   - **An on-device SmolLM2-135M model** (`src/services/aiService.js`,
     removed), which ran entirely in-browser via Transformers.js/WebGPU —
     no backend needed, but a multi-hundred-MB model had to download and
     run locally first. On a WASM fallback (no WebGPU) that could take
     30–90+ seconds, which is what made "Analyzing your explanation…" slow.
   - **A pair of trained TF-IDF models** (regressor + classifier,
     `src/services/explainBackTrainedModel.js`, removed) that were blended
     30% into the rubric score. The `training/` pipeline that produced them
     is untouched — it's just no longer wired into the live app.
   - **A separate Claude-backed `/api/teach` route** (`server/index.js`,
     removed), which powered an unused, already-deleted "Learn Concept"
     page. Removed along with the `@anthropic-ai/sdk` dependency.

   Net effect: the production bundle dropped from ~1.7MB to ~370KB (the
   23.5MB ONNX WASM runtime is gone entirely), and every AI call in the app
   is now a short server round-trip instead of a client-side model
   download/inference.

The deterministic rubric (`computeRubricBaseline()` in
`assessmentService.js`) and LearnLoop's cannedContent() templates are
UNCHANGED — they're not "models," they're the zero-cost, zero-network
foundation every AI call still falls back to if OpenAI is unconfigured,
unreachable, or errors.

## Configuration

- **Frontend**: `VITE_EXPLAINBACK_TUTOR_API_URL` in `.env` — the backend's
  URL, safe to expose client-side, shared by all three routes above. Unset
  by default; every AI feature falls back to its deterministic engine
  until it's set (see `src/config/explainBackTutorConfig.js`).
- **Backend**: `OPENAI_API_KEY` in `server/.env` — create one at
  platform.openai.com/api-keys. Never prefix it with `VITE_`, and never
  paste it into a chat message or anywhere that gets committed — it goes
  in `server/.env` only, which is gitignored.
- **Model**: `OPENAI_MODEL` in `server/.env`, optional — defaults to
  `gpt-4o-mini`.

```bash
cd server
cp .env.example .env   # fill in OPENAI_API_KEY
npm install
npm start               # listens on :8787 by default

cd ../nimiqlearn-ai-educational-app
echo 'VITE_EXPLAINBACK_TUTOR_API_URL=http://localhost:8787' >> .env
npm run dev
```

## Why the AI Tutor stays opt-in (the other two don't)

`/api/assess/feedback` and `/api/learn/activity` run automatically, same as
the on-device model they replaced — grading an explanation or generating
an activity are core, expected parts of using the app. The AI Tutor is
different: it's a *second*, additional critique on top of grading that
already happened, so it stays a deliberate button press rather than firing
automatically, since it's an extra paid call the learner may not want
every time.

## Honesty model

Every route is either not configured (falls back silently and instantly to
the deterministic engine — rubric for grading, canned templates for
activities) or shows a real result — never a fake reply. The AI Tutor
panel is the one exception that surfaces failures directly to the learner
(with a "Retry" button) rather than falling back, since it's an explicit,
single-purpose action with nothing to silently substitute. The backend
distinguishes real error shapes via the `openai` SDK's typed errors
(`AuthenticationError`, `RateLimitError`, `APIError`) — never collapsed
into one generic message, and `masteryEstimate` in grading responses is
always overridden server-side to match the deterministic rubric score
exactly, never left to whatever scale the model happened to return it in
(a real bug caught during testing: the model returned `0.55` instead of
`55` for one request).

## Verified live, on a real desktop with real OpenAI access

Unlike earlier passes of this backend (built in a cloud sandbox with no
route to `api.openai.com` at all), this was tested with a real,
funded `OPENAI_API_KEY` on an actual desktop:

- `GET /api/tutor/health` → `{ ok: true, configured: true }`.
- `POST /api/assess/feedback` → a real graded response (summary,
  strengths, missing concepts, a next challenge, and a masteryEstimate
  correctly matching the rubric's own scale).
- `POST /api/learn/activity` → a real generated activity (prompt, question,
  multiple-choice options, explanation).
- The full frontend build succeeds with the on-device model and trained
  models removed; every touched page compiles cleanly through Vite's dev
  transform.

**Not yet verified**: a full interactive click-through in an actual
browser — this environment's network blocks downloading a headless
browser to drive one automatically. That's the one remaining check to do
manually.

## Security

- No key ever reaches the frontend bundle or a browser network request —
  the frontend never imports the OpenAI SDK and only calls NimiqLearn's own
  backend.
- The backend's system prompts explicitly instruct the model not to
  discuss wallets, payments, or transactions.
- Input is bounded (`MAX_MESSAGE_LENGTH`) so one request can't be
  unbounded in size.
- CORS is restricted via `TEACHING_ALLOWED_ORIGIN` (one setting, applies
  to every route on this server) — the `*` default in `.env.example` is a
  local-dev convenience only.

## What's next

- A real interactive click-through in a browser (see "Not yet verified").
- Any UI to let a learner see when a piece of feedback came from the
  deterministic fallback vs. OpenAI, beyond the existing "This assessment
  used the built-in engine" notice.
