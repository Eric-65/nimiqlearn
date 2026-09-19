import React, { useState } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { useLearner } from "../../hooks/useLearner.js";
import { useAiBackend } from "../../hooks/useAiBackend.js";
import { findTopic } from "../../data/mockTopics.js";
import { askLessonQuestion, isQuestionBackendConfigured, MAX_QUESTION_LENGTH } from "../../services/lessonQuestionService.js";
import Button from "../ui/Button.jsx";

/**
 * "Ask about this lesson" — sits under the topic's video in the Learn tab.
 *
 * The learner types a question; the tutor answers it from the topic's own
 * reference content, in the app's current language. Each exchange is saved
 * on the learner's profile for that topic, so the thread is theirs: a
 * wallet learner sees it again on any device they sign in from.
 *
 * Not a public forum. NimiqLearn has no server-side store, so a "community
 * Q&A" would be a thread only its author could see while looking like
 * something shared — the tutor is the one thing that can actually answer.
 */
export default function LessonQuestions({ topicId }) {
  const { t, tOr } = useI18n();
  const { getEntry, recordLessonQuestion, learner } = useLearner();
  const ai = useAiBackend();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const topic = findTopic(topicId);
  if (!topic) return null;
  const thread = getEntry(topicId)?.questions || [];
  const available = isQuestionBackendConfigured() && ai.available;
  const level = (getEntry(topicId)?.mastery ?? 0) < 40 ? "beginner" : "intermediate";

  const submit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    const res = await askLessonQuestion({ topic, question: q, level });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    recordLessonQuestion({ topicId, question: q, answer: res.answer });
    setQuestion("");
  };

  return (
    <section className="card lesson-questions" aria-labelledby={`lesson-q-${topicId}`}>
      <h3 id={`lesson-q-${topicId}`} className="card-title" style={{ margin: "0 0 4px" }}>
        💬 {t("lessonQ.title")}
      </h3>
      <p className="small muted" style={{ margin: "0 0 14px" }}>
        {t("lessonQ.sub", { topic: tOr(`topic.${topic.id}.name`, topic.name) })}
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <textarea
          className="input"
          rows={2}
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder={t("lessonQ.placeholder")}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!available || busy}
          aria-label={t("lessonQ.title")}
          style={{ resize: "vertical", minHeight: 56 }}
        />
        <div className="flex items-center justify-between wrap gap-8">
          <span className="tiny muted">
            {available ? t("lessonQ.savedTo", { where: learner.walletAddress ? t("lessonQ.yourWallet") : t("lessonQ.thisDevice") }) : t("lessonQ.unavailable")}
          </span>
          <Button type="submit" variant="primary" size="sm" disabled={!available || busy || !question.trim()}>
            {busy ? t("lessonQ.asking") : t("lessonQ.ask")}
          </Button>
        </div>
      </form>

      {error && (
        <p className="tiny" role="alert" style={{ color: "var(--c-rose)", margin: "10px 0 0" }}>{error}</p>
      )}

      {thread.length > 0 && (
        <ol className="lesson-thread" aria-label={t("lessonQ.previous")}>
          {thread.map((qa) => (
            <li key={qa.at} className="lesson-qa anim-fade">
              <p className="lesson-q"><span aria-hidden="true">🙋</span> {qa.question}</p>
              <p className="lesson-a"><span aria-hidden="true">🤖</span> {qa.answer}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
