import React, { useState } from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useI18n } from "../hooks/useI18n.js";
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
  const { t, tPlural, n: fmt } = useI18n();
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
          <h1 className="page-title">{t("nav.notifications")}</h1>
          <p className="page-sub">{t("notif.sub")}</p>
        </div>
        {items.length > 0
          ? <Badge tone="amber" dot>{t("notif.count", { count: items.length })}</Badge>
          : <Badge tone="teal" dot>{t("notif.allClear")}</Badge>}
      </header>

      {items.length === 0 ? (
        <Card className="anim-rise">
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">✅</div>
            <h3 style={{ margin: "0 0 6px" }}>{t("notif.empty.title")}</h3>
            <p className="small muted" style={{ margin: "0 0 16px", maxWidth: 440, marginInline: "auto" }}>
              {t("notif.empty.body")}
            </p>
            <div className="flex gap-12 justify-center wrap">
              <Button variant="primary" onClick={() => navigate("learn")}>{t("notif.empty.start")}</Button>
              <Button variant="ghost" onClick={handleRestore}>{t("settings.notifications.restore")}</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((n) => {
              /* The service hands over keys + variables; this is the only
                 place they become words, so every notification is in the
                 learner's language including the ones built from data. */
              const title = n.titlePlural
                ? tPlural(n.titleKey, n.titleVars.count, n.titleVars)
                : t(n.titleKey, n.titleVars);
              const bodyVars = { ...n.bodyVars };
              if (bodyVars.statusKey) bodyVars.status = t(bodyVars.statusKey);
              if (typeof bodyVars.xp === "number") bodyVars.xp = fmt(bodyVars.xp);
              if (typeof bodyVars.remaining === "number") bodyVars.remaining = fmt(bodyVars.remaining);
              const body = t(n.bodyKey, bodyVars);
              return (
              <Card key={n.id} className="anim-rise" style={{ borderColor: `var(--c-${n.tone})` }}>
                <div className="flex items-start justify-between gap-16 wrap">
                  <div className="flex items-start gap-12" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 24, lineHeight: 1.2 }} aria-hidden="true">{n.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{title}</h3>
                      <p className="small muted" style={{ margin: 0 }}>{body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 wrap">
                    {n.action && (
                      <Button variant="outline" size="sm" onClick={() => navigate(n.action.path, n.action.params)}>
                        {t(n.action.labelKey)}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(n.id)}
                      aria-label={t("notif.dismiss.aria", { title })}
                    >
                      {t("notif.dismiss")}
                    </Button>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>

          <div className="flex justify-center" style={{ marginTop: 18 }}>
            <Button variant="ghost" size="sm" onClick={handleRestore}>{t("notif.restoreAll")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
