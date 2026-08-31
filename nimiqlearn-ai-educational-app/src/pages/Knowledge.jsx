import React, { useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { findTopic } from "../data/mockTopics.js";
import KnowledgeMap from "../components/knowledge/KnowledgeMap.jsx";
import ConceptDetail from "../components/knowledge/ConceptDetail.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";

export default function Knowledge() {
  const { navigate } = useNav();
  const { learner, knowledge, averageMastery, dueNow, reviewQueue, getEntry } = useLearner();
  const [selectedTopicId, setSelectedTopicId] = useState(null);

  const weak = knowledge.filter((k) => k.status === "LEARNING" || (k.status === "NEW" && !k.lastEvaluatedAt));
  const mastered = knowledge.filter((k) => k.status === "MASTERED").length;
  const recentlyImproved = knowledge
    .filter((k) => k.lastEvaluatedAt && k.mastery >= 40)
    .sort((a, b) => (b.lastEvaluatedAt || 0) - (a.lastEvaluatedAt || 0))[0];

  // Topic of the most recent ExplainBack evaluation → animate its node.
  const recentEval = (learner.history || []).find((h) => h.type === "EXPLAIN_BACK");
  const recentTopicId = recentEval?.topicId || recentlyImproved?.topicId || null;
  const dueTopicIds = reviewQueue.filter((r) => r.dueNow).map((r) => r.topicId);

  const handleSelect = (topicId) => setSelectedTopicId(topicId);

  const handleDetailNavigate = (page, topicId) => {
    setSelectedTopicId(null);
    navigate(page, { topic: topicId });
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Knowledge Map</h1>
          <p className="page-sub">Your live understanding of the curriculum. Click any node to start learning — weak nodes pulse.</p>
        </div>
        <Badge tone="slate">{knowledge.length} concepts tracked</Badge>
      </header>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">Average mastery</span>
            <span className="strong">{averageMastery}%</span>
          </div>
          <ProgressBar value={averageMastery} tone="gold" ariaLabel="Average mastery" />
        </Card>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">Mastered concepts</span>
            <span className="strong">{mastered}</span>
          </div>
          <ProgressBar value={(mastered / Math.max(1, knowledge.length)) * 100} tone="teal" ariaLabel="Mastered concepts" />
        </Card>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">Needs attention</span>
            <span className="strong" style={{ color: "var(--c-amber)" }}>{weak.length}</span>
          </div>
          <ProgressBar value={(weak.length / Math.max(1, knowledge.length)) * 100} tone="gold" ariaLabel="Concepts needing attention" />
        </Card>
      </div>

      {dueNow.length > 0 && (
        <div className="notice warn" style={{ marginBottom: 20 }}>
          <span aria-hidden="true">⏳</span>
          <span>
            <strong>{dueNow.length} concept{dueNow.length > 1 ? "s" : ""} due for review.</strong>{" "}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("review")} style={{ padding: 0, fontSize: 13 }}>
              Open ForgetMeNot →
            </button>
          </span>
        </div>
      )}

      <KnowledgeMap knowledge={knowledge} onSelect={handleSelect} recentTopicId={recentTopicId} dueTopicIds={dueTopicIds} />

      <ConceptDetail
        topic={selectedTopicId ? findTopic(selectedTopicId) : null}
        entry={selectedTopicId ? getEntry(selectedTopicId) : null}
        onClose={() => setSelectedTopicId(null)}
        onNavigate={handleDetailNavigate}
      />
    </div>
  );
}
