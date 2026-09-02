import React, { useEffect, useRef, useState } from "react";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { askConceptTeacher, checkTeachingAvailable, TEACHING_CONFIGURED, TEACHING_DISABLED_REASON } from "../services/claudeTeachingService.js";

const SUGGESTED_TOPICS = [
  "Linear Algebra",
  "Calculus basics",
  "Probability",
  "Newton's laws of motion",
  "Big-O notation",
  "How neural networks learn",
];

/**
 * Learn Concept — open-ended concept teaching, powered by Claude via
 * NimiqLearn's own backend (see ../services/claudeTeachingService.js and
 * ../../server/). Deliberately separate from Learn.jsx (SmolLM2 + the
 * deterministic LearnLoop, scoped to the fixed curriculum tree): this page
 * can teach anything a learner asks about, not just LEAF_TOPICS.
 *
 * Never fabricates a response — if the backend isn't configured or isn't
 * reachable, that's shown plainly instead of a fake reply.
 */
export default function LearnConcept() {
  const [topic, setTopic] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]); // { role: "user"|"assistant", content }
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [availability, setAvailability] = useState({ checked: false, available: false, reason: null });
  const listEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    checkTeachingAvailable().then((result) => {
      if (!cancelled) setAvailability({ checked: true, ...result });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const disabled = !TEACHING_CONFIGURED || (availability.checked && !availability.available);

  const handleSend = async (overrideMessage) => {
    const message = (overrideMessage ?? input).trim();
    if (!message || sending || disabled) return;

    setError(null);
    setInput("");
    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setSending(true);

    const result = await askConceptTeacher({ topic, message, history: messages });
    setSending(false);

    if (result.ok) {
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } else {
      setError(result.error);
    }
  };

  const handleTopicChip = (t) => {
    setTopic(t);
    if (messages.length === 0) {
      handleSend(`Teach me ${t}, starting from the basics.`);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Learn Concept</h1>
          <p className="page-sub">Ask Claude to teach you anything — Linear Algebra, Calculus, or whatever you're curious about.</p>
        </div>
        {!TEACHING_CONFIGURED ? (
          <Badge tone="amber" dot>Not configured</Badge>
        ) : availability.checked && !availability.available ? (
          <Badge tone="rose" dot>Backend unreachable</Badge>
        ) : availability.checked ? (
          <Badge tone="teal" dot>Claude ready</Badge>
        ) : (
          <Badge tone="slate" dot>Checking…</Badge>
        )}
      </header>

      {disabled && (
        <div className="notice warn" style={{ marginBottom: 22 }}>
          <span aria-hidden="true">🧪</span>
          <span>{TEACHING_DISABLED_REASON || availability.reason}</span>
        </div>
      )}

      <Card title="Pick a concept, or ask your own question" style={{ marginBottom: 18 }}>
        <div className="flex gap-8 wrap">
          {SUGGESTED_TOPICS.map((t) => (
            <button key={t} className={`chip ${topic === t ? "active" : ""}`} onClick={() => handleTopicChip(t)} disabled={disabled || sending}>
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: 14, maxHeight: "50vh", overflowY: "auto", marginBottom: 16 }}>
          {messages.length === 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              Pick a concept above, or type a question below, to start a conversation.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "notice info" : "notice"}
              style={{ margin: 0, textAlign: "left", whiteSpace: "pre-wrap" }}
            >
              <span aria-hidden="true">{m.role === "user" ? "🙋" : "🤖"}</span>
              <span>{m.content}</span>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-12 muted small" aria-live="polite">
              <span className="thinking-dots" aria-hidden="true"><span /><span /><span /></span>
              Claude is thinking…
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        {error && (
          <div className="notice danger" style={{ marginBottom: 12 }} role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-8" style={{ alignItems: "flex-end" }}>
          <textarea
            className="input"
            style={{ flex: 1, minHeight: 44, resize: "vertical" }}
            placeholder={disabled ? "Learn Concept is unavailable right now" : "Ask a question…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={disabled || sending}
            aria-label="Your question"
          />
          <Button variant="nimiq" onClick={() => handleSend()} disabled={disabled || sending || !input.trim()}>
            Send
          </Button>
        </div>
      </Card>

      <div className="notice info" style={{ marginTop: 24 }}>
        <span aria-hidden="true">🛡️</span>
        <span>
          Learn Concept talks to NimiqLearn's own backend, which calls Claude — your questions never go directly from this
          app to a third party, and the AI here is fully separate from your wallet and payment data.
        </span>
      </div>
    </div>
  );
}
