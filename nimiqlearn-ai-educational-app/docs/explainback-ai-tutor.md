# NimiqLearn — ExplainBack AI Tutor (OpenAI / ChatGPT)

An opt-in "NimiqLearn AI Tutor" panel shown after an ExplainBack result
(`src/components/ai/AITutorPanel.jsx`, wired into `src/pages/ExplainBack.jsx`).
The learner presses "Ask the AI Tutor →"; OpenAI's chat model then critiques
their explanation against the app's own rubric grading
(`assessmentService.js`) and, if it's incomplete or wrong, gives a short,
corrected explanation.

This is the ExplainBack "AI Tutor" direction flagged (but not built) in
`docs/learn-concept.md` — the two features share the same backend process
(`server/`) but are otherwise independent: different route, different
secret, different provider.

**Provider history**: this route originally called GLM-5.3 via Hugging
Face's router (a 320B-parameter model, chosen and verified as the only
technically viable path at the time — see git history if that reasoning is
useful). It was swapped to OpenAI because that's the provider the project
actually has a funded API key for; the backend/frontend architecture below
is unchanged from that pass, only the provider client and its secret name
are different.

## Why this needs a backend

`src/services/aiService.js` already runs SmolLM2-135M entirely on-device
via Transformers.js — no backend, no network call per generation. OpenAI's
models don't have that option: they're cloud-only, so the same problem the
Claude teaching backend solved (`docs/learn-concept.md`) applies here too,
for the same reason — NimiqLearn ships as a single static HTML file, so an
API key embedded in it is visible to every visitor. `server/index.js`
exposes:

- `GET /api/tutor/health` → `{ ok, configured }` — whether `OPENAI_API_KEY`
  is set.
- `POST /api/tutor/feedback` → `{ topic, referenceAnswer, learnerExplanation,
  assessment }` in, `{ ok, feedback }` out. Calls
  `openaiClient.chat.completions.create()` server-side (model
  `OPENAI_MODEL`, default `gpt-4o-mini`) with a system prompt that gives it
  the app's own rubric score/findings and asks for a short critique plus a
  corrected explanation when needed — never discussing wallets or payments.

`src/services/explainBackTutorService.js` only ever calls this backend
over `fetch()` — it never imports the OpenAI SDK and never sees a key.

## Configuration

- **Frontend**: `VITE_EXPLAINBACK_TUTOR_API_URL` in `.env` (see
  `.env.example`) — the backend's URL, safe to expose client-side. Unset
  by default; the AI Tutor panel renders nothing at all until it's set
  (see `src/config/explainBackTutorConfig.js`) — no broken button, no
  clutter on every ExplainBack result for learners who haven't set this up.
- **Backend**: `OPENAI_API_KEY` in `server/.env` (see `server/.env.example`)
  — create one at platform.openai.com/api-keys. Never prefix it with
  `VITE_`, and never paste it into a chat message or anywhere that gets
  committed — it goes in `server/.env` only, which is gitignored.
- **Model**: `OPENAI_MODEL` in `server/.env`, optional — defaults to
  `gpt-4o-mini`. Override it if your account/credits are set up for a
  different model.

```bash
cd server
cp .env.example .env   # fill in OPENAI_API_KEY (and ANTHROPIC_API_KEY if wanted)
npm install
npm start               # listens on :8787 by default

cd ../nimiqlearn-ai-educational-app
echo 'VITE_EXPLAINBACK_TUTOR_API_URL=http://localhost:8787' >> .env
npm run dev
```

## Why it's opt-in, not automatic

OpenAI's API is a paid, metered call, unlike the free rubric baseline and
the on-device SmolLM2 assessment that already run for every ExplainBack
submission. The panel never fires on its own — it renders a button, and
only calls `/api/tutor/feedback` when the learner presses it.

## Honesty model

Same pattern as `claudeTeachingService.js`: the panel is either invisible
(not configured) or shows a real result — never a fake reply. If the
backend is reachable but has no `OPENAI_API_KEY`, or OpenAI rate-limits or
errors the request, the panel shows the real error and a "Retry" button,
not a silently empty response. The backend distinguishes the same error
shapes it already does for the Claude route — an
`OpenAI.AuthenticationError` reports a key/config problem, an
`OpenAI.RateLimitError` a real 429, an `OpenAI.APIError` an upstream
failure — never collapsed into one generic message.

## Verified in this environment

This sandbox has no `OPENAI_API_KEY`, so a live reply through this stack
has **not** been exercised end to end here. What *was* verified:

- The `openai` npm package (v7) exports the same typed-error shape
  (`AuthenticationError`/`RateLimitError`/`APIError`) already used for the
  Claude route, and `chat.completions.create()` is present on the client —
  confirmed by direct inspection of the installed package, not assumed.
- `node --check` passes on the updated `server/index.js`.
- The app builds cleanly with the panel, config, and service pointed at
  this provider, and the panel correctly renders nothing when
  `VITE_EXPLAINBACK_TUTOR_API_URL` is unset (the shipped default).

**Remaining blocker**: an actual `OPENAI_API_KEY` and a running instance of
`server/` are required to verify a real ChatGPT reply end to end — that's
on you to test locally (see "Configuration" above), since the key should
never be shared into this session or any chat.

## Security

- No key ever reaches the frontend bundle or a browser network request —
  the frontend never imports the OpenAI SDK and only calls NimiqLearn's own
  backend.
- The backend's system prompt explicitly instructs the model not to
  discuss wallets, payments, or transactions, matching the same rule
  already enforced for the Claude teaching backend.
- Input is bounded (`MAX_MESSAGE_LENGTH`, reused from the Claude route) so
  one request can't be unbounded in size.
- CORS is restricted via `TEACHING_ALLOWED_ORIGIN` (one setting, applies
  to every route on this server, tutor included) — the `*` default in
  `.env.example` is a local-dev convenience only.

## What's next

This ships for ExplainBack only for now. Two follow-ups explicitly
deferred rather than built speculatively:

- Wiring OpenAI (or another provider) into the Learn tab's "Next activity"
  content generation, alongside or instead of SmolLM2.
- Any UI to let a learner see which provider (SmolLM2 vs. the cloud AI
  Tutor) produced a given piece of feedback, if that distinction ever
  needs to be more visible than the badge already on the AI Tutor panel.
