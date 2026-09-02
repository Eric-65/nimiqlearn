# NimiqLearn — Claude teaching backend (status: plumbing only, no UI)

An earlier version of this doc described a standalone "Learn Concept" chat
page (`src/pages/LearnConcept.jsx`) where a learner could ask Claude to
teach any concept in an open-ended chat. **That page has been removed** —
product direction changed: instead of a separate Claude chat tab, Claude
should eventually act as an **"AI Tutor" inside the existing ExplainBack
section** (`src/pages/ExplainBack.jsx` / `src/services/assessmentService.js`),
e.g. giving a learner a Claude-generated explanation or follow-up hint when
their ExplainBack answer is graded as PARTIAL or INCORRECT — not as its own
page. No such integration has been designed or built yet; this is a
statement of future intent, not a shipped feature.

The backend and frontend service built for Learn Concept are **kept
as-is, unused by any page right now**, because the hard part — getting an
Anthropic API key from server to browser safely — doesn't change based on
which page ends up calling it:

- `server/` (sibling directory to this app, repo root) — a small Express
  server holding `ANTHROPIC_API_KEY` server-side. `GET /api/health` →
  `{ ok, configured }`; `POST /api/teach` → `{ topic, message, history }`
  in, `{ ok, reply }` out, via `client.messages.create()` (model
  `claude-opus-5`, adaptive thinking, `effort: "medium"`).
- `src/services/claudeTeachingService.js` — `checkTeachingAvailable()` and
  `askConceptTeacher({ topic, message, history })`, talking to `server/`
  over `fetch()` only. Never imports `@anthropic-ai/sdk`, never sees a key.
- `src/config/teachingConfig.js` — `VITE_TEACHING_API_URL` config, same
  disable-if-unconfigured pattern as `paymentConfig.js`.

## Why this needs a backend (unchanged)

NimiqLearn ships as a single static HTML file
(`vite-plugin-singlefile`) — a Nimiq Pay Mini App with no server component
of its own. Any secret embedded in that file (an `ANTHROPIC_API_KEY`
included) is visible to every user who opens their browser's dev tools or
inspects network requests. Whatever eventually calls Claude from
NimiqLearn — an ExplainBack AI Tutor or anything else — will need to go
through a real backend like `server/`, not an embedded credential.

## Configuration (if/when something wires this back in)

- **Frontend**: `VITE_TEACHING_API_URL` in `.env` (see `.env.example`) —
  the backend's URL, safe to expose client-side. Unset by default.
- **Backend**: `ANTHROPIC_API_KEY` in `server/.env` (see
  `server/.env.example`). Never prefix an Anthropic key with `VITE_`, or
  it will be bundled into the frontend and shipped to every visitor.

```bash
cd server
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm install
npm start               # listens on :8787 by default
```

## Honesty model (unchanged, for whatever consumes this next)

`claudeTeachingService.js` distinguishes three states, never collapsing
them into a generic "unavailable":

1. **Not configured** (`VITE_TEACHING_API_URL` unset) — never even
   attempts a request.
2. **Backend unreachable, or reachable but unconfigured itself**
   (`checkTeachingAvailable()` calls `/api/health`) — e.g. the URL is set
   but the server isn't running, or it's running without its own
   `ANTHROPIC_API_KEY`.
3. **Configured and reachable** — a real request goes to `/api/teach`.

The backend mirrors this: `/api/teach` returns `503` with an explicit
"not configured" message when it has no key, rather than crashing or
silently returning an empty reply.

## Verified in this environment (as of the Learn Concept build, before removal)

This sandbox has no `ANTHROPIC_API_KEY` and no `ant` CLI session, so a
live Claude reply through this stack has still **not** been exercised.
What was verified end to end in a live browser against a locally running
instance of `server/`, before the page was removed:

- Frontend correctly shows "Not configured" and disables input when
  `VITE_TEACHING_API_URL` is unset (the shipped default).
- With the URL configured and the real backend running (but genuinely no
  API key, since none is available here), the frontend correctly calls
  `/api/health`, sees `configured: false`, and shows "Backend unreachable"
  with the exact reason — not a fake reply, not a silent failure.
- The backend's own `/api/health` and `/api/teach` were hit directly with
  `curl` and returned the expected real JSON in both the not-configured
  and (structurally, via code review) configured cases.

**Remaining blocker**, unchanged: an actual `ANTHROPIC_API_KEY` and a
deployed (or long-running local) instance of `server/` are required to
verify a real Claude reply end to end.

## Security (unchanged, applies to any future consumer)

- No API key ever reaches the frontend bundle or a browser network
  request — the frontend never imports the Anthropic SDK and only calls
  NimiqLearn's own backend.
- The backend's system prompt explicitly instructs Claude not to discuss
  wallets, payments, or transactions — this must hold for an ExplainBack
  AI Tutor too: no wallet/payment data should ever be sent to this
  endpoint or to Claude.
- Input is bounded (`MAX_MESSAGE_LENGTH`, `MAX_HISTORY_MESSAGES` in
  `server/index.js`) to keep one request from being unbounded in size.
- CORS is restricted via `TEACHING_ALLOWED_ORIGIN` — the `*` default in
  `.env.example` is a local-dev convenience only; a real deployment
  should set this to the Mini App's actual origin.

## Update: ExplainBack now has an AI Tutor — just not this one

An "AI Tutor" panel now exists inside ExplainBack, but it calls GLM-5.3
(via Hugging Face), not Claude — see `docs/explainback-ai-tutor.md` for
the full design. It uses a sibling pair of routes on this same `server/`
process (`/api/tutor/health`, `/api/tutor/feedback`, gated by `HF_TOKEN`
rather than `ANTHROPIC_API_KEY`). This file's Claude plumbing
(`server/index.js`'s `/api/teach`, `claudeTeachingService.js`,
`teachingConfig.js`) remains unused by any page, kept as-is in case a
future feature wants Claude specifically.
