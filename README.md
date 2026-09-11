# NimiqLearn

An AI-powered educational app with a real Nimiq Pay wallet integration.
This repo has three independently-run pieces:

| Directory | What it is | Run it |
|---|---|---|
| `nimiqlearn-ai-educational-app/` | The app itself — a single-file React/Vite bundle, deployed as a Nimiq Pay Mini App. All AI (ExplainBack grading, the AI Tutor, Learn tab content) is OpenAI-backed via `server/`; real wallet/payment integration via `@nimiq/mini-app-sdk`. No on-device model — see `docs/explainback-ai-tutor.md`, "History". | `npm install && npm run dev` |
| `server/` | A small Express backend holding `OPENAI_API_KEY` server-side for every AI feature in the app (ExplainBack grading, the AI Tutor, Learn tab activities) — one key, three routes. Never bundled into the app — see `nimiqlearn-ai-educational-app/docs/explainback-ai-tutor.md`. | `npm install && npm start` |
| `training/` | Offline ML pipelines (Python) that produced a real ExplainBack regressor + classifier trained on the Automatic Short Answer Grading dataset. No longer wired into the live app (see `docs/explainback-ai-tutor.md`, "History") — kept as a research artifact. | see `training/README.md` |

## Key docs

- `nimiqlearn-ai-educational-app/docs/learning-engine.md` — the ExplainBack → Knowledge Map → ForgetMeNot → LearnLoop pipeline
- `nimiqlearn-ai-educational-app/docs/nimiq-pay-integration.md` — the real Nimiq Pay wallet/payment integration, its verification trail, and known limitations
- `nimiqlearn-ai-educational-app/docs/explainback-ai-tutor.md` — the OpenAI backend behind every AI feature in the app: architecture, configuration, honesty model, and what replaced the old on-device model
- `training/README.md` — the ML pipeline roadmap (now a historical record — its outputs aren't loaded by the live app)
