import React, { useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { computeXp } from "../services/xpService.js";
import { buildNotifications, dismissNotification, restoreAllNotifications } from "../services/notificationService.js";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";

/**
 * Everything on this page is derived from real state — due reviews, weak
 * topics, unverified payments, unlocked packs, level milestones. There is
 * no push channel and nothing invented, so an empty list is a real
 * "nothing needs you", not a failed fetch.
 */
export default function Notifications() {
  const { navigate } = useNav();
  const { knowledge, dueNow, learner } = useLearner();
  const xp = computeXp(knowledge);
  const [, force] = useState(0);

  const items = buildNotifications({ knowledge, dueNow, learner, xp });

  const handleDismiss = (id) => {
    dismissNotification(id);
    force((n) => n + 1);
  };

  const handleRestore = () => {
    restoreAllNotifications();
    force((n) => n + 1);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">What actually needs you — worked out from your own progress, not pushed from anywhere.</p>
        </div>
        {items.length > 0 ? <Badge tone="amber" dot>{items.length} active</Badge> : <Badge tone="teal" dot>All clear</Badge>}
      </header>

      {items.length === 0 ? (
        <Card className="anim-rise">
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">✅</div>
            <h3 style={{ margin: "0 0 6px" }}>Nothing needs your attention</h3>
            <p className="small muted" style={{ margin: "0 0 16px", maxWidth: 440, marginInline: "auto" }}>
              No reviews are due, no topics have slipped, and no payments are unverified. This is a real empty state —
              come back after some study and it will fill itself in.
            </p>
            <div className="flex gap-12 justify-center wrap">
              <Button variant="primary" onClick={() => navigate("learn")}>Start a session</Button>
              <Button variant="ghost" onClick={handleRestore}>Restore dismissed</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((n) => (
              <Card key={n.id} className="anim-rise" style={{ borderColor: `var(--c-${n.tone})` }}>
                <div className="flex items-start justify-between gap-16 wrap">
                  <div className="flex items-start gap-12" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 24, lineHeight: 1.2 }} aria-hidden="true">{n.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{n.title}</h3>
                      <p className="small muted" style={{ margin: 0 }}>{n.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 wrap">
                    {n.action && (
                      <Button variant="outline" size="sm" onClick={() => navigate(n.action.path, n.action.params)}>
                        {n.action.label}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDismiss(n.id)} aria-label={`Dismiss: ${n.title}`}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-center" style={{ marginTop: 18 }}>
            <Button variant="ghost" size="sm" onClick={handleRestore}>Restore dismissed notifications</Button>
          </div>
        </>
      )}
    </div>
  );
}
