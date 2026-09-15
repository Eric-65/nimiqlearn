# Deploying NimiqLearn (frontend + AI) to Vercel

NimiqLearn's AI features need an `OPENAI_API_KEY`, and that key can only
ever live server-side. This is the short version of how that works in
production, and the exact steps to switch it on.

## How it fits together

| | Where it runs | What holds the key |
|---|---|---|
| Frontend | Static single-file bundle from `dist/` | nothing — it never sees the key |
| AI routes | Vercel serverless functions from `api/` | `OPENAI_API_KEY`, injected by Vercel at runtime |
| Local dev | `../server/index.js` on `:8787` | `OPENAI_API_KEY` from the gitignored `../server/.env` |

There are four routes, and both environments serve the *same* handlers:

```
GET  /api/tutor/health     → is a key configured?
POST /api/tutor/feedback   → opt-in "Ask the AI Tutor" critique
POST /api/assess/feedback  → ExplainBack's primary grading
POST /api/learn/activity   → Learn tab activity content
```

The prompts, validation and error mapping live once, in `api/_lib/`. The
serverless functions and the local Express server are both thin adapters
over those shared handlers, so what you test locally is the same code that
runs in production rather than a lookalike that can drift. (Files and
folders under `api/` beginning with `_` are not turned into routes, which is
why the shared code sits in `_lib/`.)

## Turning it on (one-time)

The code is already deployed — these are the only manual steps, and they all
happen in the Vercel dashboard because the key must never be committed.

1. **Vercel → your NimiqLearn project → Settings → Environment Variables.**
2. Add `OPENAI_API_KEY` = your key from
   <https://platform.openai.com/api-keys>. Apply it to Production (and
   Preview, if you want AI on preview deployments).
   **Never** name it `VITE_OPENAI_API_KEY` — anything prefixed `VITE_` is
   baked into the public browser bundle and shipped to every visitor.
3. Add `VITE_EXPLAINBACK_TUTOR_API_URL` = `/` (a single forward slash).
   Not a secret — it just tells the frontend the API is on the same origin,
   so it calls a relative `/api/...` path. A slash keeps working on preview
   URLs and custom domains; a hardcoded absolute URL would not.
4. Optionally add `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
5. **Redeploy.** `VITE_`-prefixed variables are read at BUILD time, so an
   existing deployment will not pick up step 3 until it is rebuilt —
   Deployments → ⋯ → Redeploy, or just push a commit.

### Checking it worked

Open `https://your-deployment/api/tutor/health`. You want:

```json
{"ok":true,"configured":true}
```

`"configured":false` means the function is deployed but `OPENAI_API_KEY` is
not set (or the redeploy hasn't happened). In the app itself, the top-bar
badge changes from **NimiqLearn AI • Unavailable** to **NimiqLearn AI •
Ready**.

## Costs and failure behaviour

Each ExplainBack submission is one OpenAI call; "Ask the AI Tutor" is a
second, and it is opt-in precisely because it is metered. If the key is
missing, out of credit, or rate-limited, every AI feature degrades to the
built-in deterministic engine and says so on screen — the app never silently
pretends an AI answer was produced.

## Local development

```bash
cd nimiqlearn-ai-educational-app && npm install   # installs `openai` too
cp .env.example .env                              # API URL stays :8787
cd ../server && cp .env.example .env              # put OPENAI_API_KEY here
npm install && npm start                          # :8787
```

`server/.env` is gitignored. `npm install` in the app directory is required
even if you only want the server: the shared `api/_lib/` modules resolve
`openai` from the app's `node_modules`.

`OPENAI_BASE_URL` can point the SDK at any OpenAI-compatible endpoint. It is
unset in normal use; it exists so the routes can be exercised against a stub
without spending credits.
