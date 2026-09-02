# NimiqLearn — ExplainBack AI Tutor (GLM-5.3)

An opt-in "NimiqLearn AI Tutor" panel shown after an ExplainBack result
(`src/components/ai/AITutorPanel.jsx`, wired into `src/pages/ExplainBack.jsx`).
The learner presses "Ask the AI Tutor →"; GLM-5.3 then critiques their
explanation against the app's own rubric grading (`assessmentService.js`)
and, if it's incomplete or wrong, gives a short, corrected explanation.

This is the ExplainBack "AI Tutor" direction flagged (but not built) in
`docs/learn-concept.md` — the two features share the same backend process
(`server/`) but are otherwise independent: different route, different
secret, different provider.

## Why GLM-5.3 needs a backend — more so than SmolLM2

`src/services/aiService.js` already runs SmolLM2-135M entirely on-device
via Transformers.js — no backend, no network call per generation. GLM-5.3
(`zai-org/GLM-5.3`) cannot follow that model: it is a 320B-parameter
(18B active, mixture-of-experts) flagship model, thousands of times larger
than SmolLM2. There is no ONNX/WebGPU build of a model that size that
would ever load in a browser tab. It only exists as a hosted API call —
here, via Hugging Face's OpenAI-compatible router
(`https://router.huggingface.co/v1/chat/completions`).

That means the same problem the Claude teaching backend solved
(`docs/learn-concept.md`) applies here too, for the same reason: NimiqLearn
ships as a single static HTML file, so an API token embedded in it is
visible to every visitor. `server/index.js` now exposes:

- `GET /api/tutor/health` → `{ ok, configured }` — whether `HF_TOKEN` is set.
- `POST /api/tutor/feedback` → `{ topic, referenceAnswer, learnerExplanation,
  assessment }` in, `{ ok, feedback }` out. Calls GLM-5.3 server-side with a
  system prompt that gives it the app's own rubric score/findings and asks
  for a short critique plus a corrected explanation when needed — never
  discussing wallets or payments.

`src/services/explainBackTutorService.js` only ever calls this backend
over `fetch()` — it never imports an HF client and never sees a token.

## Configuration

- **Frontend**: `VITE_EXPLAINBACK_TUTOR_API_URL` in `.env` (see
  `.env.example`) — the backend's URL, safe to expose client-side. Unset
  by default; the AI Tutor panel renders nothing at all until it's set
  (see `src/config/explainBackTutorConfig.js`) — no broken button, no
  clutter on every ExplainBack result for learners who haven't set this up.
- **Backend**: `HF_TOKEN` in `server/.env` (see `server/.env.example`) — a
  Hugging Face access token with Inference Providers access. Never prefix
  it with `VITE_`.

```bash
cd server
cp .env.example .env   # fill in HF_TOKEN (and ANTHROPIC_API_KEY if wanted)
npm install
npm start               # listens on :8787 by default

cd ../nimiqlearn-ai-educational-app
echo 'VITE_EXPLAINBACK_TUTOR_API_URL=http://localhost:8787' >> .env
npm run dev
```

## Why it's opt-in, not automatic

GLM-5.3 is a paid, metered call, unlike the free rubric baseline and the
on-device SmolLM2 assessment that already run for every ExplainBack
submission. The panel never fires on its own — it renders a button, and
only calls `/api/tutor/feedback` when the learner presses it.

## Honesty model

Same pattern as `claudeTeachingService.js`: the panel is either invisible
(not configured) or shows a real result — never a fake reply. If the
backend is reachable but has no `HF_TOKEN`, or Hugging Face rate-limits or
errors the request, the panel shows the real error and a "Retry" button,
not a silently empty response.

## Verified in this environment

This sandbox has no `HF_TOKEN` and outbound access to `huggingface.co`
itself is blocked by the network egress proxy here, so a live GLM-5.3
reply through this stack has **not** been exercised end to end. What
*was* verified:

- GLM-5.3's real specs (320B total / 18B active parameters, MoE, natively
  multimodal, part of the GLM-5 series) via web search, since the model
  page itself isn't reachable from this sandbox — confirming it is a real,
  current model and confirming it cannot run on-device.
- The request/response shape matches the OpenAI-compatible schema the
  model card itself documents for Hugging Face's router
  (`chat.completions`-style `{ model, messages }` in, `choices[0].message.content` out).
- The app builds cleanly with the new panel, config, and service in place,
  and the panel correctly renders nothing when
  `VITE_EXPLAINBACK_TUTOR_API_URL` is unset (the shipped default).

**Remaining blocker**: an actual `HF_TOKEN` and a deployed (or
long-running local) instance of `server/`, from a network that can reach
Hugging Face, are required to verify a real GLM-5.3 reply end to end —
including confirming the exact model id `zai-org/GLM-5.3` is what you want
billed (Hugging Face's router may expose faster/cheaper provider variants,
e.g. a `:fastest` suffix, worth checking against your own account before
relying on this in production).

## Security

- No token ever reaches the frontend bundle or a browser network request —
  the frontend never imports a Hugging Face client and only calls
  NimiqLearn's own backend.
- The backend's system prompt explicitly instructs GLM-5.3 not to discuss
  wallets, payments, or transactions, matching the same rule already
  enforced for the Claude teaching backend.
- Input is bounded (`MAX_MESSAGE_LENGTH`, reused from the Claude route) so
  one request can't be unbounded in size.
- CORS is restricted via `TEACHING_ALLOWED_ORIGIN` (one setting, applies
  to every route on this server, tutor included) — the `*` default in
  `.env.example` is a local-dev convenience only.

## What's next

Per the user's direction, this ships for ExplainBack only for now. Two
follow-ups explicitly deferred rather than built speculatively:

- Wiring GLM-5.3 (or another provider) into the Learn tab's "Next
  activity" content generation, alongside or instead of SmolLM2.
- Any UI to let a learner see which provider (SmolLM2 vs. GLM-5.3)
  produced a given piece of feedback, if that distinction ever needs to be
  more visible than the badge already on the AI Tutor panel.
