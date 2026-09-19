import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { computeXp, levelTitleKey } from "../services/xpService.js";
import { useI18n } from "../hooks/useI18n.js";
import { STATUS_META, STATUS_ORDER } from "../services/knowledgeService.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

function truncateAddress(address) {
  if (!address) return null;
  return address.length <= 20 ? address : `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/* `undefined` as the locale would follow the BROWSER, not the app — so a
   learner who switched NimiqLearn to Korean would still read English month
   names here. The app's own locale is passed in explicitly. */
function formatDate(ts, locale) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The learner's own record. Every figure is real: XP and level from
 * xpService (derived from mastery + answers), status counts from the
 * knowledge entries, wallet identity from the actual provider connection.
 * Nothing here is a placeholder — where a value doesn't exist yet, it says
 * so rather than showing a plausible-looking zero-state number.
 */
export default function Profile() {
  const { navigate } = useNav();
  const { knowledge, learner, dueNow, isWalletProfile, profileAddress } = useLearner();
  const nimiq = useNimiq();
  const stats = computeXp(knowledge);

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    meta: STATUS_META[status],
    count: knowledge.filter((e) => e.status === status).length,
  }));

  const studied = knowledge.filter((e) => e.lastStudiedAt);
  const strongest = [...studied].sort((a, b) => (b.mastery || 0) - (a.mastery || 0))[0] || null;
  const weakest = [...studied].sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0] || null;
  const lastStudied = studied.reduce((max, e) => Math.max(max, e.lastStudiedAt || 0), 0);
  const { t, n, locale } = useI18n();

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("nav.profile")}</h1>
          <p className="page-sub">{t("profile.sub")}</p>
        </div>
        <Badge tone="teal" dot>{t("lb.level", { level: stats.level })}</Badge>
      </header>

      {/* Identity + level */}
      <Card className="anim-rise" style={{ marginBottom: 18 }}>
        <div className="flex items-center justify-between wrap gap-16">
          <div className="flex items-center gap-16">
            <div
              aria-hidden="true"
              style={{
                width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center",
                fontSize: 30, background: "var(--c-teal-soft)", border: "1px solid var(--c-teal)",
              }}
            >
              🧠
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>{t(levelTitleKey(stats.level))}</h2>
              {/* Three states, and they are different things: a WALLET PROFILE
                  (authenticated — this progress is filed under that address and
                  comes back on any device), merely CONNECTED (the wallet reported
                  an address but nothing was signed, so the guest profile is still
                  in use), or a local guest. */}
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {isWalletProfile ? (
                  <>{t("profile.walletAccount")} · <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{truncateAddress(profileAddress)}</span></>
                ) : nimiq.address ? (
                  <>{t("profile.connectedNotSigned")} · <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{truncateAddress(nimiq.address)}</span></>
                ) : (
                  t("profile.localLearner")
                )}
              </p>
              {isWalletProfile && (
                <p className="tiny muted" style={{ margin: "6px 0 0" }}>
                  {learner.adoptedFromGuest ? t("profile.walletAdopted") : t("profile.walletSaved")}
                </p>
              )}
              {!isWalletProfile && nimiq.address && (
                <p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("profile.signInToSave")}</p>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 180 }}>
            <div className="strong" style={{ fontSize: 30, color: "var(--c-gold)", lineHeight: 1 }}>
              {n(stats.xp)} <span style={{ fontSize: 15 }}>XP</span>
            </div>
            <p className="tiny muted" style={{ margin: "6px 0 6px" }}>
              {t("profile.toLevel", { into: n(stats.xpIntoLevel), need: n(stats.xpForNextLevel), level: stats.level + 1 })}
            </p>
            <div className="progress" style={{ height: 8 }} role="presentation">
              <div className="progress-bar gold" style={{ width: `${Math.max(2, stats.progressPercent)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label={t("knowledge.avgMastery")} value={`${stats.averageMastery}%`} tone="teal" />
        <Stat label={t("profile.topicsStudied")} value={stats.topicsStudied} tone="blue" />
        <Stat
          label={t("profile.accuracy")}
          value={stats.accuracy === null ? t("profile.noData") : `${Math.round(stats.accuracy * 100)}%`}
          tone="gold"
          small={stats.accuracy === null}
        />
        <Stat label={t("profile.reviewsDue")} value={dueNow.length} tone={dueNow.length ? "amber" : "teal"} />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title={t("profile.breakdown")} sub={t("profile.breakdown.sub")}>
            <div style={{ display: "grid", gap: 10 }}>
              {byStatus.map(({ status, meta, count }) => (
                <div key={status} className="flex items-center justify-between gap-12">
                  <span className="flex items-center gap-10">
                    <span className="status-dot" style={{ background: meta?.color || "var(--st-new)" }} aria-hidden="true" />
                    <span className="small strong">{t(`status.${String(status).toLowerCase()}`)}</span>
                  </span>
                  <span className="small strong" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t("profile.record")} sub={t("profile.record.sub")}>
            <div style={{ display: "grid", gap: 10 }}>
              <KeyVal label={t("profile.correct")} value={stats.correctAttempts} tone="var(--c-teal)" />
              <KeyVal label={t("profile.incorrect")} value={stats.incorrectAttempts} tone="var(--c-rose)" />
              <KeyVal label={t("profile.lastStudied")} value={lastStudied ? formatDate(lastStudied, locale) : t("profile.notYet")} />
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title={t("profile.extremes")} sub={t("profile.extremes.sub")}>
            {studied.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                {t("profile.extremes.empty")}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {strongest && (
                  <Highlight
                    icon="💪" label={t("profile.strongest")} name={strongest.topicName}
                    mastery={Math.round(strongest.mastery || 0)} tone="teal"
                  />
                )}
                {weakest && weakest.topicId !== strongest?.topicId && (
                  <Highlight
                    icon="🎯" label={t("profile.needsWork")} name={weakest.topicName}
                    mastery={Math.round(weakest.mastery || 0)} tone="rose"
                    action={() => navigate("explain", { topic: weakest.topicId })}
                    practiseLabel={t("profile.practise")}
                  />
                )}
              </div>
            )}
          </Card>

          <Card title={t("profile.packs")} sub={t("profile.packs.sub")}>
            {(learner.unlockedPacks || []).length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>{t("profile.packs.empty")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {learner.unlockedPacks.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between gap-12 pill" style={{ cursor: "default" }}>
                    <span className="small strong">{p.productId}</span>
                    <Badge tone={p.simulated ? "amber" : "teal"}>{t(p.simulated ? "profile.simulated" : "profile.paid")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{t("profile.manage")}</h3>
                <p className="small muted" style={{ margin: "4px 0 0" }}>{t("profile.manage.sub")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("settings")}>{t("profile.openSettings")}</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, small }) {
  return (
    <Card className="anim-rise">
      <p className="tiny muted" style={{ margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <div className="strong" style={{ fontSize: small ? 15 : 26, color: `var(--c-${tone})`, lineHeight: 1.2 }}>{value}</div>
    </Card>
  );
}

function KeyVal({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-12">
      <span className="small muted">{label}</span>
      <span className="small strong" style={{ color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Highlight({ icon, label, name, mastery, tone, action, practiseLabel }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-12" style={{ marginBottom: 6 }}>
        <span className="flex items-center gap-8">
          <span aria-hidden="true">{icon}</span>
          <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
        </span>
        <span className="small strong" style={{ color: `var(--c-${tone})` }}>{mastery}%</span>
      </div>
      <div className="flex items-center justify-between gap-12">
        <span className="strong">{name}</span>
        {action && <Button variant="ghost" size="sm" onClick={action}>{practiseLabel}</Button>}
      </div>
      <div className="progress" style={{ height: 6, marginTop: 8 }} role="presentation">
        <div className="progress-bar" style={{ width: `${Math.max(2, mastery)}%`, background: `var(--c-${tone})` }} />
      </div>
    </div>
  );
}
