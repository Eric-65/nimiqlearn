/* ============================================================
   NimiqLearn API — route logic, transport-agnostic
   ------------------------------------------------------------
   Each handler takes a plain request body and returns
   { status, json }. It never touches an Express `res` or a
   Vercel `res`, which is what lets the same validation, the same
   prompts and the same error handling serve both the serverless
   functions in ../ and the local Express server in
   ../../../server/index.js.

   Behaviour here is a straight port of the original single-file
   server — same checks, same limits, same messages.
   ============================================================ */

import { getOpenAI, isConfigured, openAiErrorResponse, OPENAI_MODEL, MAX_MESSAGE_LENGTH } from "./openai.js";
import {
  buildTutorSystemPrompt,
  buildAssessSystemPrompt,
  buildActivitySystemPrompt,
  buildQuestionSystemPrompt,
  spreadCorrectAnswer,
  findRepeatedQuestion,
} from "./prompts.js";

const notConfigured = (what) => ({
  status: 503,
  json: { ok: false, error: `${what} is not configured on this server. Set OPENAI_API_KEY and redeploy.` },
});

const badRequest = (error) => ({ status: 400, json: { ok: false, error } });

/** Shared across every route — same key, same "is it configured" fact. */
export function handleHealth() {
  return { status: 200, json: { ok: true, configured: isConfigured() } };
}

/* ---------------- ExplainBack AI Tutor (opt-in critique) ---------------- */

export async function handleTutorFeedback(body = {}) {
  const client = getOpenAI();
  if (!client) return notConfigured("The AI Tutor");

  const { topic, topicId, learnerLevel, referenceAnswer, learnerExplanation, assessment, locale } = body;

  if (typeof learnerExplanation !== "string" || !learnerExplanation.trim()) {
    return badRequest("A non-empty 'learnerExplanation' string is required.");
  }
  if (learnerExplanation.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`'learnerExplanation' exceeds ${MAX_MESSAGE_LENGTH} characters.`);
  }
  if (referenceAnswer !== undefined && referenceAnswer !== null && typeof referenceAnswer !== "string") {
    return badRequest("'referenceAnswer' must be a string when provided.");
  }

  const assessmentSummary =
    assessment && typeof assessment === "object"
      ? [
          typeof assessment.score === "number" ? `Rubric score: ${assessment.score}/100.` : null,
          Array.isArray(assessment.missingConcepts) && assessment.missingConcepts.length
            ? `Flagged as missing: ${assessment.missingConcepts.join("; ")}.`
            : null,
          Array.isArray(assessment.misconceptions) && assessment.misconceptions.length
            ? `Possible misconception: ${assessment.misconceptions.join("; ")}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const userMessage = [
    referenceAnswer ? `Reference explanation: ${referenceAnswer}` : null,
    `Learner's explanation: ${learnerExplanation}`,
    assessmentSummary ? `App's own grading: ${assessmentSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: "system", content: buildTutorSystemPrompt(topic, locale, { topicId, level: learnerLevel }) },
        { role: "user", content: userMessage },
      ],
    });
    return { status: 200, json: { ok: true, feedback: completion.choices?.[0]?.message?.content || "" } };
  } catch (err) {
    return openAiErrorResponse(err, "The AI Tutor");
  }
}

/* ---------------- ExplainBack primary grading ---------------- */

export async function handleAssessFeedback(body = {}) {
  const client = getOpenAI();
  if (!client) return notConfigured("ExplainBack grading");

  const { topic, learnerExplanation, learnerLevel, baseline, locale } = body;

  if (typeof learnerExplanation !== "string" || !learnerExplanation.trim()) {
    return badRequest("A non-empty 'learnerExplanation' string is required.");
  }
  if (learnerExplanation.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`'learnerExplanation' exceeds ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const signalBlock =
    baseline && typeof baseline === "object"
      ? `Assessment score: ${baseline.score ?? "unknown"}/100\nMissing concepts: ${(baseline.missingConcepts || []).join(" | ") || "none detected"}\nPossible misconceptions: ${(baseline.misconceptions || []).join(" | ") || "none detected"}`
      : "";

  const userMessage = [
    `Concept: ${topic || "unspecified"}`,
    `Level: ${learnerLevel || "beginner"}`,
    `Learner explanation: ${learnerExplanation}`,
    signalBlock,
    "Give concise educational feedback and one next challenge. Return the JSON assessment.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildAssessSystemPrompt(locale) },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      return { status: 502, json: { ok: false, error: "ExplainBack grading returned unreadable output." } };
    }
    // The rubric score is deterministic ground truth (see prompt) — never
    // trust the model to echo it back correctly at the right scale.
    // Overridden server-side rather than merely asked for, since a prompt
    // instruction is not a guarantee.
    if (baseline && typeof baseline === "object" && typeof baseline.score === "number") {
      value.masteryEstimate = baseline.score;
    }
    return { status: 200, json: { ok: true, value } };
  } catch (err) {
    return openAiErrorResponse(err, "ExplainBack grading");
  }
}

/* ---------------- Learn tab activity content ---------------- */

export async function handleLearnActivity(body = {}) {
  const client = getOpenAI();
  if (!client) return notConfigured("Learn activity generation");

  const {
    type,
    topicId,
    topicName,
    topicDescription,
    topicContent,
    level,
    targetMisconception,
    previousQuestions,
    previousAngles,
    locale,
  } = body;

  if (typeof type !== "string" || !type.trim() || typeof topicName !== "string" || !topicName.trim()) {
    return badRequest("'type' and 'topicName' are required strings.");
  }

  const prevQs = Array.isArray(previousQuestions) ? previousQuestions : [];
  const prevAngles = Array.isArray(previousAngles) ? previousAngles : [];
  const systemPrompt = buildActivitySystemPrompt({
    type,
    level: level || "beginner",
    topicId,
    topicName,
    topicDescription,
    targetMisconception,
    previousQuestions: prevQs,
    previousAngles: prevAngles,
    locale,
  });
  const userMessage = `Topic content reference: ${JSON.stringify(topicContent || {}).slice(0, 2000)}`;

  const generate = async (extraInstruction, temperature) => {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: extraInstruction ? `${systemPrompt} ${extraInstruction}` : systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  try {
    let value = await generate("", 0.4);
    if (!value) {
      return { status: 502, json: { ok: false, error: "Activity generation returned unreadable output." } };
    }

    // The prompt tells the model not to repeat a question, and it still
    // does — verbatim, under a freshly-worded "angle" — often enough to
    // matter. So it's checked here rather than trusted: one retry at a
    // higher temperature with the specific repeat called out. (Same
    // principle as spreadCorrectAnswer(): verify what a prompt only asks for.)
    const repeated = findRepeatedQuestion(value?.question, prevQs);
    if (repeated) {
      const retry = await generate(
        `IMPORTANT: your previous attempt repeated an already-asked question: "${repeated}". That is not acceptable. Choose a completely different sub-aspect of ${topicName} and ask something that shares no more than a couple of words with any question listed above.`,
        0.75
      );
      if (retry && !findRepeatedQuestion(retry?.question, prevQs)) value = retry;
    }

    return { status: 200, json: { ok: true, value: spreadCorrectAnswer(value, type) } };
  } catch (err) {
    return openAiErrorResponse(err, "Activity generation");
  }
}

/**
 * POST /api/learn/question — "Ask about this lesson".
 * Body: { question, topicId, topicName, topicContent?, level?, locale? }
 * Returns: { ok: true, value: { answer } }
 */
export async function handleLessonQuestion(body = {}) {
  const client = getOpenAI();
  if (!client) return notConfigured("Lesson questions");

  const { question, topicId, topicName, topicContent, level, locale } = body;

  if (typeof question !== "string" || !question.trim()) {
    return badRequest("'question' is required.");
  }
  if (typeof topicName !== "string" || !topicName.trim()) {
    return badRequest("'topicName' is required.");
  }
  if (question.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`Question is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
  }

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 320,
      temperature: 0.4,
      messages: [
        { role: "system", content: buildQuestionSystemPrompt({ topicName, topicId, level: level || "beginner", locale }) },
        {
          role: "user",
          content: `Topic reference: ${JSON.stringify(topicContent || {}).slice(0, 2000)}\n\nLearner's question: ${question.trim()}`,
        },
      ],
    });
    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return { status: 502, json: { ok: false, error: "The tutor returned an empty answer." } };
    }
    return { status: 200, json: { ok: true, value: { answer } } };
  } catch (err) {
    return openAiErrorResponse(err, "Lesson question");
  }
}
