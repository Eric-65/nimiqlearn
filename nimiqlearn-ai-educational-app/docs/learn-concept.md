# NimiqLearn — Learn Concept (Claude teaching)

Learn Concept is a new page (`src/pages/LearnConcept.jsx`) where a learner
can ask Claude to teach them any concept — Linear Algebra, Calculus,
Newton's laws, anything — as an open-ended chat, distinct from `Learn.jsx`
(SmolLM2 + the deterministic LearnLoop, scoped to the fixed curriculum
tree in `mockTopics.js`).

## Why this needs a backend

NimiqLearn ships as a single static HTML file (`vite-plugin-singlefile`) —
a Nimiq Pay Mini App with no server component of its own. Any secret
embedded in that file (an `ANTHROPIC_API_KEY` included) is visible to
every user who opens their browser's dev tools or inspects network
requests. The Anthropic API is not designed to be called with a secret
key from an untrusted client, and the official Nimiq Mini Apps skill is
explicit that mini apps should reach external APIs through a real
backend, not by embedding credentials client-side.

The fix: `server/` (a sibling directory to this app, at the repo root) is
a small Express server that holds `ANTHROPIC_API_KEY` in its own
server-side environment and exposes two endpoints:

- `GET /api/health` → `{ ok, configured }` — whether the server has a key
  at all, without leaking anything about it.
- `POST /api/teach` → `{ topic, message, history }` in, `{ ok, reply }`
  out. Calls `client.messages.create()` (model `claude-opus-5`, adaptive
  thinking, `effort: "medium"`) server-side.

The frontend (`src/services/claudeTeachingService.js`) only ever talks to
this backend over `fetch()` — it never imports `@anthropic-ai/sdk`, never
sees an API key, and would have no way to construct an authenticated
request even if it wanted to.

## Configuration

Two separate, non-secret vs. secret configs:

- **Frontend**: `VITE_TEACHING_API_URL` in `.env` (see `.env.example`),
  the backend's URL. Safe to expose
  client-side — it's an endpoint, not a credential. Unset by default;
  Learn Concept is disabled with an honest message
  (`src/config/teachingConfig.js`) until it's configured, the same
  disable-if-unconfigured pattern as `paymentConfig.js`.
- **Backend**: `ANTHROPIC_API_KEY` in `server/.env` (see
  `server/.env.example`). Server-side only — never prefix an Anthropic
  key with `VITE_`, or it will be bundled into the frontend and shipped
  to every visitor.

Running locally:

```bash
cd server
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm install
npm start               # listens on :8787 by default

cd ../nimiqlearn-ai-educational-app
echo 'VITE_TEACHING_API_URL=http://localhost:8787' >> .env
npm run dev
```

## Honesty model

`claudeTeachingService.js` distinguishes three states, never collapsing
them into a generic "unavailable":

1. **Not configured** (`VITE_TEACHING_API_URL` unset) — the frontend never
   even attempts a request; Learn Concept shows "Claude teaching isn't
   configured yet" and disables input.
2. **Backend unreachable, or reachable but unconfigured itself**
   (`checkTeachingAvailable()` calls `/api/health` on page load) — e.g.
   the URL is set but the server isn't running, or it's running without
   its own `ANTHROPIC_API_KEY`. Shown as "Backend unreachable" with the
   specific reason from the health check.
3. **Configured and reachable** — the chat is enabled, and a real request
   goes to `/api/teach`.

The backend mirrors this: `/api/teach` returns `503` with an explicit
"not configured" message when it has no key, rather than crashing or
silently returning an empty reply.

## Verified in this environment

This sandbox has no `ANTHROPIC_API_KEY` and no `ant` CLI session, so a
live Claude reply through this whole stack has **not** been exercised —
that would require fabricating a working call, which this app does not
do anywhere else either. What **was** verified directly, end to end, in a
live browser against a locally running instance of `server/`:

- Frontend correctly shows "Not configured" and disables all input when
  `VITE_TEACHING_API_URL` is unset (the shipped default).
- With the URL configured and the real backend running (but genuinely no
  API key, since none is available here), the frontend correctly calls
  `/api/health`, sees `configured: false`, and shows "Backend unreachable"
  with the exact reason ("no ANTHROPIC_API_KEY configured") — not a fake
  reply, not a silent failure.
- The backend's own `/api/health` and `/api/teach` (with a real HTTP
  request) were hit directly with `curl` and returned the expected real
  JSON in both the not-configured and (structurally, via code review)
  configured cases.

**Remaining blocker**: an actual `ANTHROPIC_API_KEY` and a deployed
(or long-running local) instance of `server/` are required to verify a
real Claude reply end to end. Until then, do not report a live teaching
conversation as tested — only the architecture and every non-key-dependent
path have been.

## Security

- No API key ever reaches the frontend bundle or a browser network
  request — confirmed by design (the frontend never imports the
  Anthropic SDK) and by the fact `claudeTeachingService.js` only calls
  NimiqLearn's own backend.
- The backend's system prompt explicitly instructs Claude not to discuss
  wallets, payments, or transactions — Learn Concept and the Nimiq Pay
  wallet integration are unrelated, and no wallet/payment data is ever
  sent to this endpoint or to Claude.
- Input is bounded (`MAX_MESSAGE_LENGTH`, `MAX_HISTORY_MESSAGES` in
  `server/index.js`) to keep one request from being unbounded in size.
- CORS is restricted via `TEACHING_ALLOWED_ORIGIN` — the `*` default in
  `.env.example` is a local-dev convenience only; a real deployment
  should set this to the Mini App's actual origin.
