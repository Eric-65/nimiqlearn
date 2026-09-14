import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { computeXp, levelTitle } from "../services/xpService.js";
import { STATUS_META, STATUS_ORDER } from "../services/knowledgeService.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

function truncateAddress(address) {
  if (!address) return null;
  return address.length <= 20 ? address : `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
  const { knowledge, learner, dueNow } = useLearner();
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

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Your learning record — all of it measured, none of it estimated.</p>
        </div>
        <Badge tone="teal" dot>Level {stats.level}</Badge>
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
              <h2 style={{ margin: 0, fontSize: 24 }}>{levelTitle(stats.level)}</h2>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {nimiq.address ? (
                  <>Signed in with Nimiq Pay · <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{truncateAddress(nimiq.address)}</span></>
                ) : (
                  "Local learner — connect a wallet to attach an identity"
                )}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 180 }}>
            <div className="strong" style={{ fontSize: 30, color: "var(--c-gold)", lineHeight: 1 }}>
              {stats.xp.toLocaleString()} <span style={{ fontSize: 15 }}>XP</span>
            </div>
            <p className="tiny muted" style={{ margin: "6px 0 6px" }}>
              {stats.xpIntoLevel.toLocaleString()} / {stats.xpForNextLevel.toLocaleString()} to level {stats.level + 1}
            </p>
            <div className="progress" style={{ height: 8 }} role="presentation">
              <div className="progress-bar gold" style={{ width: `${Math.max(2, stats.progressPercent)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Average mastery" value={`${stats.averageMastery}%`} tone="teal" />
        <Stat label="Topics studied" value={stats.topicsStudied} tone="blue" />
        <Stat
          label="Answer accuracy"
          value={stats.accuracy === null ? "No data yet" : `${Math.round(stats.accuracy * 100)}%`}
          tone="gold"
          small={stats.accuracy === null}
        />
        <Stat label="Reviews due" value={dueNow.length} tone={dueNow.length ? "amber" : "teal"} />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title="Knowledge breakdown" sub="Where every concept in the curriculum currently sits.">
            <div style={{ display: "grid", gap: 10 }}>
              {byStatus.map(({ status, meta, count }) => (
                <div key={status} className="flex items-center justify-between gap-12">
                  <span className="flex items-center gap-10">
                    <span className="status-dot" style={{ background: meta?.color || "var(--st-new)" }} aria-hidden="true" />
                    <span className="small strong">{meta?.label || status}</span>
                  </span>
                  <span className="small strong" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Answer record" sub="Lifetime counters across every activity type.">
            <div style={{ display: "grid", gap: 10 }}>
              <KeyVal label="Correct" value={stats.correctAttempts} tone="var(--c-teal)" />
              <KeyVal label="Incorrect" value={stats.incorrectAttempts} tone="var(--c-rose)" />
              <KeyVal label="Last studied" value={lastStudied ? formatDate(lastStudied) : "Not yet"} />
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title="Strongest & weakest" sub="Based on measured mastery, not self-report.">
            {studied.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Nothing studied yet — once you explain or practise a concept, it shows up here.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {strongest && (
                  <Highlight
                    icon="💪" label="Strongest" name={strongest.topicName}
                    mastery={Math.round(strongest.mastery || 0)} tone="teal"
                  />
                )}
                {weakest && weakest.topicId !== strongest?.topicId && (
                  <Highlight
                    icon="🎯" label="Needs work" name={weakest.topicName}
                    mastery={Math.round(weakest.mastery || 0)} tone="rose"
                    action={() => navigate("explain", { topic: weakest.topicId })}
                  />
                )}
              </div>
            )}
          </Card>

          <Card title="Unlocked packs" sub="From the Learning Economy.">
            {(learner.unlockedPacks || []).length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No packs unlocked yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {learner.unlockedPacks.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between gap-12 pill" style={{ cursor: "default" }}>
                    <span className="small strong">{p.productId}</span>
                    <Badge tone={p.simulated ? "amber" : "teal"}>{p.simulated ? "Simulated" : "Paid"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between wrap gap-12">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Manage your data</h3>
                <p className="small muted" style={{ margin: "4px 0 0" }}>Theme, reset, and diagnostics live in Settings.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("settings")}>Open Settings</Button>
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

function Highlight({ icon, label, name, mastery, tone, action }) {
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
        {action && <Button variant="ghost" size="sm" onClick={action}>Practise</Button>}
      </div>
      <div className="progress" style={{ height: 6, marginTop: 8 }} role="presentation">
        <div className="progress-bar" style={{ width: `${Math.max(2, mastery)}%`, background: `var(--c-${tone})` }} />
      </div>
    </div>
  );
}
