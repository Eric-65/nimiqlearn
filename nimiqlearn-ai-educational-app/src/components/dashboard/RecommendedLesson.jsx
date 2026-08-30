import React from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { ACTIVITY_LABELS } from "../../services/learnLoopService.js";

export default function RecommendedLesson({ recommendation, onStart }) {
  if (!recommendation) return null;
  const { topic, decision } = recommendation;

  return (
    <Card hover className="anim-rise" style={{ borderColor: "rgba(77,141,255,0.35)", background: "linear-gradient(135deg, rgba(77,141,255,0.14), rgba(17,24,49,0.9) 60%)" }}>
      <div className="flex items-center gap-8 wrap" style={{ marginBottom: 10 }}>
        <Badge tone="gold">Recommended next</Badge>
        <span className="tiny muted">{topic.parentName || ""}</span>
      </div>
      <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{topic.name}</h3>
      <p className="small muted" style={{ margin: "0 0 6px" }}>{decision.reason}</p>
      <Badge tone="blue">{ACTIVITY_LABELS[decision.activityType]}</Badge>
      {decision.nextTopic && (
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>
          🎯 After this: <strong>{decision.nextTopic.name}</strong>
        </p>
      )}
      <Button variant="primary" onClick={onStart} className="mt-16" block>
        Start this activity
      </Button>
    </Card>
  );
}
