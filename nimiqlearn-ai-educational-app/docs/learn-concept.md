# NimiqLearn — Claude backend (removed)

This file used to document a Claude-backed `/api/teach` route and its
frontend plumbing (`claudeTeachingService.js`, `teachingConfig.js`),
originally built for a "Learn Concept" chat page. That page was removed
early on (product direction changed — see `docs/explainback-ai-tutor.md`
for what an "AI Tutor" inside ExplainBack actually became), and the Claude
plumbing sat unused behind it for a while, kept in case a future feature
wanted Claude specifically.

Nothing ever did. When ExplainBack's primary grading and the Learn tab's
content generation were both moved onto OpenAI (see
`docs/explainback-ai-tutor.md`), the unused Claude route, its frontend
service/config files, and the `@anthropic-ai/sdk` dependency were all
removed outright rather than left as unused dead code. NimiqLearn's
backend (`server/`) is OpenAI-only now.

If Claude-specific integration is ever wanted again, `docs/explainback-ai-tutor.md`'s
`/api/tutor/feedback` route is the closest existing template for how a
provider-backed route here is structured (backend proxy holding the key,
frontend `fetch()`-only service, disable-if-unconfigured on both ends).
