import React from "react";
import { useNav } from "../context/NavContext.jsx";
import { useLearner } from "../hooks/useLearner.js";
import { useTheme } from "../hooks/useTheme.js";
import { useNimiq } from "../hooks/useNimiq.js";
import { isAssessmentBackendConfigured } from "../services/explainBackAssessmentService.js";
import { PAYMENTS_ENABLED } from "../config/paymentConfig.js";
import { USDT_PAYMENTS_ENABLED } from "../config/evmPaymentConfig.js";
import { restoreAllNotifications } from "../services/notificationService.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

const THEME_OPTIONS = [
  { mode: "dark", label: "Dark", icon: "🌙", hint: "The NimiqLearn default" },
  { mode: "light", label: "Light", icon: "☀️", hint: "Bright, high-contrast" },
  { mode: "system", label: "System", icon: "🖥️", hint: "Follow your device" },
];

/**
 * Settings only ever reports real configuration. Each status row below
 * reflects an actual check (is a backend URL set, is a recipient address
 * configured, is a wallet genuinely connected) rather than a hardcoded
 * "Enabled" — the same rule the rest of the app follows.
 */
export default function Settings() {
  const { navigate } = useNav();
  const { resetLearner } = useLearner();
  const { mode, resolved, setMode } = useTheme();
  const nimiq = useNimiq();

  const aiConfigured = isAssessmentBackendConfigured();

  const handleReset = () => {
    if (confirm("Reset all learner data? Your mastery, XP, review queue and unlocked packs will be cleared. This cannot be undone.")) {
      resetLearner();
      navigate("home");
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Appearance, connections, and your data.</p>
        </div>
        <Badge tone={resolved === "light" ? "gold" : "blue"} dot>
          {resolved === "light" ? "Light" : "Dark"} theme
        </Badge>
      </header>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title="Appearance" sub="Applies instantly and is remembered on this device.">
            <div role="radiogroup" aria-label="Theme" style={{ display: "grid", gap: 10 }}>
              {THEME_OPTIONS.map((opt) => {
                const active = mode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(opt.mode)}
                    className="flex items-center justify-between gap-12"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      padding: "14px 16px",
                      minHeight: 56,
                      borderRadius: "var(--r-md)",
                      background: active ? "var(--c-teal-soft)" : "var(--c-surface-2)",
                      border: `1px solid ${active ? "var(--c-teal)" : "var(--c-border)"}`,
                      color: "var(--c-text)",
                      font: "inherit",
                      transition: "background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out)",
                    }}
                  >
                    <span className="flex items-center gap-12">
                      <span style={{ fontSize: 20 }} aria-hidden="true">{opt.icon}</span>
                      <span>
                        <span className="strong" style={{ display: "block" }}>{opt.label}</span>
                        <span className="tiny muted">
                          {opt.hint}
                          {opt.mode === "system" && active && ` · currently ${resolved}`}
                        </span>
                      </span>
                    </span>
                    {active && <Badge tone="teal">Active</Badge>}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Notifications" sub="Derived from your progress — nothing is pushed from a server.">
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              Reviews falling due, topics slipping, and unverified payments all raise a notification automatically.
              Dismissals are remembered on this device.
            </p>
            <div className="flex gap-12 wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("notifications")}>Open notifications</Button>
              <Button variant="ghost" size="sm" onClick={restoreAllNotifications}>Restore dismissed</Button>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <Card title="Connections" sub="What this build is actually configured for.">
            <div style={{ display: "grid", gap: 12 }}>
              <StatusRow
                label="AI grading backend"
                ok={aiConfigured}
                okText="Configured"
                offText="Not configured"
                hint={
                  aiConfigured
                    ? "ExplainBack grading and Learn activities call the backend, falling back to the built-in engine on failure."
                    : "VITE_EXPLAINBACK_TUTOR_API_URL is unset, so every AI feature uses the built-in deterministic engine."
                }
              />
              <StatusRow
                label="Nimiq Pay wallet"
                ok={nimiq.isConnected}
                okText="Connected"
                offText={nimiq.isUnavailable ? "Not available here" : "Not connected"}
                hint={
                  nimiq.isConnected
                    ? "Real NIM payments are available."
                    : "Open NimiqLearn inside Nimiq Pay to connect. Payments run as clearly-labelled simulations until then."
                }
              />
              <StatusRow
                label="NIM payments"
                ok={PAYMENTS_ENABLED}
                okText="Recipient configured"
                offText="Disabled"
                hint={PAYMENTS_ENABLED ? "A real recipient address is set." : "No recipient address configured, so unlocking with real NIM is off."}
              />
              <StatusRow
                label="USDT payments"
                ok={USDT_PAYMENTS_ENABLED}
                okText="Recipient configured"
                offText="Coming soon"
                hint={USDT_PAYMENTS_ENABLED ? "USDT is available on packs that list a USDT price." : "No EVM recipient address configured yet."}
              />
            </div>
            <div className="flex gap-12 wrap" style={{ marginTop: 16 }}>
              <Button variant="outline" size="sm" onClick={() => navigate("wallet")}>Wallet details</Button>
            </div>
          </Card>

          <Card title="Your data" sub="Everything NimiqLearn knows about you lives in this browser.">
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              Mastery, XP, the review queue and unlocked packs are stored in this browser's local storage. There is no
              account and no server copy — clearing your browser data clears your progress, and resetting here cannot
              be undone.
            </p>
            <div className="flex items-center justify-between wrap gap-12">
              <Button variant="ghost" size="sm" onClick={() => navigate("profile")}>View profile</Button>
              <Button variant="danger" size="sm" onClick={handleReset}>Reset learner data</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, okText, offText, hint }) {
  return (
    <div style={{ paddingBottom: 12, borderBottom: "1px solid var(--c-border)" }}>
      <div className="flex items-center justify-between gap-12">
        <span className="small strong">{label}</span>
        <Badge tone={ok ? "teal" : "slate"}>{ok ? okText : offText}</Badge>
      </div>
      {hint && <p className="tiny muted" style={{ margin: "5px 0 0" }}>{hint}</p>}
    </div>
  );
}
