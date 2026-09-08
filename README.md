# NimiqLearn

An AI-powered educational app with a real Nimiq Pay wallet integration.
This repo has three independently-run pieces:

| Directory | What it is | Run it |
|---|---|---|
| `nimiqlearn-ai-educational-app/` | The app itself — a single-file React/Vite bundle, deployed as a Nimiq Pay Mini App. On-device AI (SmolLM2) via `@huggingface/transformers`; real wallet/payment integration via `@nimiq/mini-app-sdk`. | `npm install && npm run dev` |
| `server/` | A small Express backend holding two AI provider secrets server-side: `OPENAI_API_KEY` for the live **ExplainBack AI Tutor** (OpenAI/ChatGPT), and `ANTHROPIC_API_KEY` for Claude — built but not wired into any page yet. Never bundled into the app — see `nimiqlearn-ai-educational-app/docs/explainback-ai-tutor.md` and `docs/learn-concept.md`. | `npm install && npm start` |
| `training/` | Offline ML pipelines (Python) that produce the trained models the app loads — currently a real ExplainBack regressor + classifier trained on the Automatic Short Answer Grading dataset. Nothing here runs in the browser; its outputs are copied into `nimiqlearn-ai-educational-app/src/data/models/`. | see `training/README.md` |

## Key docs

- `nimiqlearn-ai-educational-app/docs/learning-engine.md` — the ExplainBack → Knowledge Map → ForgetMeNot → LearnLoop pipeline
- `nimiqlearn-ai-educational-app/docs/nimiq-pay-integration.md` — the real Nimiq Pay wallet/payment integration, its verification trail, and known limitations
- `nimiqlearn-ai-educational-app/docs/explainback-ai-tutor.md` — the live OpenAI (ChatGPT) ExplainBack AI Tutor: architecture, configuration, honesty model
- `nimiqlearn-ai-educational-app/docs/learn-concept.md` — the (unused, kept for later) Claude teaching backend architecture and honesty model
- `training/README.md` — the ML pipeline roadmap and real-vs-synthetic data status per dataset
