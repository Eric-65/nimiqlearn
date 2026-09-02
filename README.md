# NimiqLearn

An AI-powered educational app with a real Nimiq Pay wallet integration.
This repo has three independently-run pieces:

| Directory | What it is | Run it |
|---|---|---|
| `nimiqlearn-ai-educational-app/` | The app itself — a single-file React/Vite bundle, deployed as a Nimiq Pay Mini App. On-device AI (SmolLM2) via `@huggingface/transformers`; real wallet/payment integration via `@nimiq/mini-app-sdk`. | `npm install && npm run dev` |
| `server/` | A small Express backend that holds `ANTHROPIC_API_KEY` server-side for the app's "Learn Concept" feature (Claude-powered concept teaching). Never bundled into the app — see `nimiqlearn-ai-educational-app/docs/learn-concept.md`. | `npm install && npm start` |
| `training/` | Offline ML pipelines (Python) that produce the trained models the app loads — currently a real ExplainBack regressor + classifier trained on the Automatic Short Answer Grading dataset. Nothing here runs in the browser; its outputs are copied into `nimiqlearn-ai-educational-app/src/data/models/`. | see `training/README.md` |

## Key docs

- `nimiqlearn-ai-educational-app/docs/learning-engine.md` — the ExplainBack → Knowledge Map → ForgetMeNot → LearnLoop pipeline
- `nimiqlearn-ai-educational-app/docs/nimiq-pay-integration.md` — the real Nimiq Pay wallet/payment integration, its verification trail, and known limitations
- `nimiqlearn-ai-educational-app/docs/learn-concept.md` — the Claude teaching backend architecture and honesty model
- `training/README.md` — the ML pipeline roadmap and real-vs-synthetic data status per dataset
