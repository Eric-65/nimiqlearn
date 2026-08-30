import React from "react";
import KnowledgeNode from "./KnowledgeNode.jsx";
import { TOPIC_TREE } from "../../data/mockTopics.js";
import { STATUS_META } from "../../services/knowledgeService.js";

/**
 * The signature animated knowledge tree.
 * Subject → topic group → concept nodes, colour-coded by status.
 * Emphasis: weak (pulse), mastered (glow), due-for-review (clock),
 * just-updated (teal flash) — passed in from the page.
 */
export default function KnowledgeMap({ knowledge, onSelect, recentTopicId = null, dueTopicIds = [] }) {
  const getEntry = (topicId) => knowledge.find((k) => k.topicId === topicId) || { status: "NEW", mastery: 0 };
  const dueSet = new Set(dueTopicIds);

  const renderBranch = (subject) => (
    <div key={subject.id} style={{ marginBottom: 26 }}>
      <div className="flex items-center gap-10" style={{ marginBottom: 14 }}>
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            background: "var(--c-gold)",
            boxShadow: "0 0 10px rgba(247,193,79,0.5)",
          }}
        />
        <h3 style={{ margin: 0, fontSize: 16 }}>{subject.name}</h3>
        <span className="tiny muted">{subject.description}</span>
      </div>

      <div style={{ marginLeft: 18, paddingLeft: 18, borderLeft: "1px dashed var(--c-border-strong)" }}>
        {subject.children.map((group) => (
          <div key={group.id} style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-10" style={{ marginBottom: 10 }}>
              <span
                aria-hidden="true"
                style={{ width: 7, height: 7, borderRadius: 2, background: "var(--c-blue)", flex: "none" }}
              />
              <span className="small strong" style={{ color: "var(--c-text-dim)" }}>{group.name}</span>
            </div>
            <div style={{ display: "grid", gap: 9, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
              {group.children.map((topic, i) => (
                <KnowledgeNode
                  key={topic.id}
                  topic={topic}
                  knowledge={getEntry(topic.id)}
                  onSelect={onSelect}
                  index={i}
                  due={dueSet.has(topic.id)}
                  justUpdated={recentTopicId === topic.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card anim-rise" style={{ padding: "26px 24px" }}>
      <div className="flex items-center justify-between wrap gap-8" style={{ marginBottom: 22 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Knowledge map</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Your live understanding across the curriculum. Weak nodes pulse — click one to fix it.
          </p>
        </div>
        <div className="flex items-center gap-12 wrap">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-6 tiny muted">
              <span className="status-dot" style={{ background: meta.color }} aria-hidden="true" />
              {meta.label}
            </span>
          ))}
        </div>
      </div>

      {TOPIC_TREE.map((subject) => renderBranch(subject))}

      <p className="tiny muted" style={{ margin: "4px 0 0", textAlign: "center" }}>
        Statuses are computed by the app from your evaluations, activity results, and reviews — not by the AI.
      </p>
    </div>
  );
}
