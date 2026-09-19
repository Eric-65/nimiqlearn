import React, { useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
import { findTopic } from "../data/mockTopics.js";
import { buildReviewSections } from "../services/forgetMeNotService.js";
import KnowledgeMap from "../components/knowledge/KnowledgeMap.jsx";
import ConceptDetail from "../components/knowledge/ConceptDetail.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";

export default function Knowledge() {
  const { navigate, route } = useNav();
  const { learner, knowledge, averageMastery, getEntry } = useLearner();
  /* Opens straight onto a concept when arrived at with ?topic — the Home
     carousel's "More info" lands here. */
  const [selectedTopicId, setSelectedTopicId] = useState(route.params?.topic || null);
  const { t, tPlural } = useI18n();

  const weak = knowledge.filter((k) => k.status === "LEARNING" || (k.status === "NEW" && !k.lastEvaluatedAt));
  const mastered = knowledge.filter((k) => k.status === "MASTERED").length;
  const recentlyImproved = knowledge
    .filter((k) => k.lastEvaluatedAt && k.mastery >= 40)
    .sort((a, b) => (b.lastEvaluatedAt || 0) - (a.lastEvaluatedAt || 0))[0];

  // Topic of the most recent ExplainBack evaluation → animate its node.
  const recentEval = (learner.history || []).find((h) => h.type === "EXPLAIN_BACK");
  const recentTopicId = recentEval?.topicId || recentlyImproved?.topicId || null;
  /* The same sections ForgetMeNot renders, so the map's clock badge, the
     banner above it and the review page can never disagree. The raw queue
     marks never-opened concepts due, which put "⏳ Review" on the map
     beside "Not started" — two labels contradicting each other on one
     node. */
  const reviewSections = buildReviewSections(knowledge);
  const dueTopicIds = reviewSections.due.map((r) => r.topicId);

  const handleSelect = (topicId) => setSelectedTopicId(topicId);

  const handleDetailNavigate = (page, topicId) => {
    setSelectedTopicId(null);
    navigate(page, { topic: topicId });
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("knowledge.title")}</h1>
          <p className="page-sub">{t("knowledge.sub")}</p>
        </div>
        <Badge tone="slate">{tPlural("knowledge.tracked", knowledge.length)}</Badge>
      </header>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">{t("knowledge.avgMastery")}</span>
            <span className="strong">{averageMastery}%</span>
          </div>
          <ProgressBar value={averageMastery} tone="gold" ariaLabel={t("knowledge.avgMastery")} />
        </Card>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">{t("knowledge.mastered")}</span>
            <span className="strong">{mastered}</span>
          </div>
          <ProgressBar value={(mastered / Math.max(1, knowledge.length)) * 100} tone="teal" ariaLabel={t("knowledge.mastered")} />
        </Card>
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span className="small muted">{t("knowledge.needsAttention")}</span>
            <span className="strong" style={{ color: "var(--c-amber)" }}>{weak.length}</span>
          </div>
          <ProgressBar value={(weak.length / Math.max(1, knowledge.length)) * 100} tone="gold" ariaLabel={t("knowledge.needsAttention")} />
        </Card>
      </div>

      {reviewSections.due.length > 0 && (
        <div className="notice warn" style={{ marginBottom: 20 }}>
          <span aria-hidden="true">⏳</span>
          <span>
            <strong>{tPlural("knowledge.dueForReview", reviewSections.due.length)}</strong>{" "}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("review")} style={{ padding: 0, fontSize: 13 }}>
              {t("knowledge.openReview")}
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
