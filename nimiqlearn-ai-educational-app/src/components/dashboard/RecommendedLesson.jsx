import React from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { ACTIVITY_LABEL_KEYS } from "../../services/learnLoopService.js";
import { useI18n } from "../../hooks/useI18n.js";

export default function RecommendedLesson({ recommendation, onStart }) {
  const { t, tOr } = useI18n();
  if (!recommendation) return null;
  const { topic, decision } = recommendation;

  /* Topic names come from the curriculum source data, so they go through
     tOr: translated where a catalogue has them, English otherwise. */
  const topicName = tOr(`topic.${topic.id}.name`, topic.name);

  return (
    <Card hover className="anim-rise" style={{ borderColor: "rgba(77,141,255,0.35)", background: "linear-gradient(135deg, var(--c-blue-soft), var(--c-card-base) 60%)" }}>
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 10 }}>
        <Badge tone="gold">{t("home.recommendedNext")}</Badge>
        <span className="tiny muted">
          {topic.parentId ? tOr(`topic.${topic.parentId}.name`, topic.parentName || "") : topic.parentName || ""}
        </span>
      </div>
      <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{topicName}</h3>
      <p className="small muted" style={{ margin: "0 0 6px" }}>
        {t(decision.reasonKey, decision.reasonVars?.topicId
          ? { ...decision.reasonVars, topic: tOr(`topic.${decision.reasonVars.topicId}.name`, decision.reasonVars.topic) }
          : decision.reasonVars)}
      </p>
      <Badge tone="blue">{t(ACTIVITY_LABEL_KEYS[decision.activityType] || decision.activityType)}</Badge>
      {decision.nextTopic && (
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>
          🎯 {t("home.afterThis")} <strong>{tOr(`topic.${decision.nextTopic.id}.name`, decision.nextTopic.name)}</strong>
        </p>
      )}
      <Button variant="primary" onClick={onStart} className="mt-16" block>
        {t("home.startActivity")}
      </Button>
    </Card>
  );
}
