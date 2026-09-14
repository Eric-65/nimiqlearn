import React from "react";
import { NavProvider, useNav } from "./context/NavContext.jsx";
import { LearnerProvider } from "./context/LearnerContext.jsx";
import { useNimiq } from "./hooks/useNimiq.js";
import { useLearner } from "./hooks/useLearner.js";
import { useTheme } from "./hooks/useTheme.js";
import { countNotifications } from "./services/notificationService.js";
import { computeXp } from "./services/xpService.js";
import AIStatus from "./components/ai/AIStatus.jsx";
import WalletDiagnostics from "./components/payments/WalletDiagnostics.jsx";
// @ts-ignore - plain JavaScript/JSX in this phase
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import ExplainBack from "./pages/ExplainBack.jsx";
import ForgetMeNot from "./pages/ForgetMeNot.jsx";
import Knowledge from "./pages/Knowledge.jsx";
import Glossary from "./pages/Glossary.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import Wallet from "./pages/Wallet.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Profile from "./pages/Profile.jsx";
import Notifications from "./pages/Notifications.jsx";
import Settings from "./pages/Settings.jsx";

/* Nav is grouped rather than one flat list of twelve: "Study" is the daily
   loop, "Economy" is wallet/marketplace, "You" is the personal surface.
   The group each item belongs to is data on the item, so the sidebar can't
   drift out of sync with the routes the way hardcoded .slice() indexes did
   — adding an item used to mean remembering to bump two slice offsets. */
const NAV_ITEMS = [
  { path: "home", label: "Home", group: "Study", icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" },
  { path: "learn", label: "Learn", group: "Study", icon: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" },
  { path: "explain", label: "ExplainBack", group: "Study", icon: "M8 12h8M8 8h5M12 20l-3-4H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-3 4z" },
  { path: "review", label: "ForgetMeNot", group: "Study", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { path: "knowledge", label: "Knowledge", group: "Study", icon: "M3 5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM8 13h5m-5 4h8" },
  { path: "glossary", label: "Glossary", group: "Study", icon: "M4 6a2 2 0 012-2h13v16H6a2 2 0 01-2-2V6zm4 3h7m-7 4h7" },
  { path: "market", label: "Marketplace", group: "Economy", icon: "M21 11.5v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8M3 7h18l-1.5-4H4.5L3 7zm9 4a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "wallet", label: "Wallet", group: "Economy", icon: "M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm15 4h2M16 11h.01" },
  { path: "leaderboard", label: "Leaderboard", group: "You", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM5 6H3v2a3 3 0 003 3M19 6h2v2a3 3 0 01-3 3" },
  { path: "profile", label: "Profile", group: "You", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
  { path: "notifications", label: "Notifications", group: "You", icon: "M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0" },
  { path: "settings", label: "Settings", group: "You", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 008 3.6h.09A1.65 1.65 0 009.6 2.09V2a2 2 0 114 0v.09A1.65 1.65 0 0015.11 3.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 8v.09c.66.14 1.15.72 1.15 1.41V10a2 2 0 010 4h-.09c-.69 0-1.27.49-1.41 1.15z" },
];

const NAV_GROUPS = ["Study", "Economy", "You"];

const PAGES = {
  home: Home,
  learn: Learn,
  explain: ExplainBack,
  review: ForgetMeNot,
  knowledge: Knowledge,
  glossary: Glossary,
  market: Marketplace,
  wallet: Wallet,
  leaderboard: Leaderboard,
  profile: Profile,
  notifications: Notifications,
  settings: Settings,
};

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <path d="M18 46 L32 14 L46 46" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="41" r="4" fill="#f7c14f" />
        </svg>
      </div>
      <div>
        <div className="brand-name">NimiqLearn</div>
        <div className="brand-tag">Adaptive AI learning</div>
      </div>
    </div>
  );
}

function Shell() {
  const { route, navigate } = useNav();
  const nimiq = useNimiq();
  const { knowledge, dueNow, learner } = useLearner();
  const { resolved, setMode } = useTheme();
  const page = (route.path || "/home").replace(/^\//, "");
  const Page = PAGES[page] || Home;

  // Real count — the same derivation the Notifications page renders, so the
  // badge can never disagree with what the page actually shows.
  const notificationCount = countNotifications({
    knowledge,
    dueNow,
    learner,
    xp: computeXp(knowledge),
  });

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Brand />
        {NAV_GROUPS.map((group, groupIndex) => (
          <React.Fragment key={group}>
            <div className="nav-section-label">{group}</div>
            {groupIndex > 0 && <span className="nav-divider" aria-hidden="true" />}
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
              <button
                key={item.path}
                className={`nav-item ${page === item.path ? "active" : ""}`}
                onClick={() => navigate(item.path)}
                aria-current={page === item.path ? "page" : undefined}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
                {item.path === "notifications" && notificationCount > 0 && (
                  <span className="nav-count" aria-label={`${notificationCount} unread`}>{notificationCount}</span>
                )}
              </button>
            ))}
          </React.Fragment>
        ))}
        <div className="sidebar-footer">
          <div className="notice" style={{ padding: "10px 12px", fontSize: 12 }}>
            <span aria-hidden="true">{nimiq.isConnected ? "🟢" : nimiq.isConnecting ? "⏳" : "🧪"}</span>
            <span>
              {nimiq.isConnected ? (
                <><strong>Connected</strong> to Nimiq Pay</>
              ) : nimiq.isConnecting ? (
                "Detecting environment…"
              ) : (
                <><strong>DEMO MODE</strong> — payments simulated</>
              )}
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="small muted" style={{ fontWeight: 600 }}>
            {NAV_ITEMS.find((n) => n.path === page)?.label || "Home"}
          </div>
          <div className="topbar-spacer" />

          {/* Quick dark/light flip. Always resolves to a concrete opposite,
              so pressing it from "system" commits to a real choice rather
              than cycling through three states the label can't describe. */}
          <button
            className="icon-btn"
            onClick={() => setMode(resolved === "light" ? "dark" : "light")}
            aria-label={`Switch to ${resolved === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${resolved === "light" ? "dark" : "light"} theme`}
          >
            <span aria-hidden="true">{resolved === "light" ? "🌙" : "☀️"}</span>
          </button>

          <button
            className="icon-btn"
            onClick={() => navigate("notifications")}
            aria-label={notificationCount > 0 ? `Notifications, ${notificationCount} active` : "Notifications"}
            title="Notifications"
          >
            <span aria-hidden="true">🔔</span>
            {notificationCount > 0 && <span className="icon-btn-dot" aria-hidden="true" />}
          </button>

          <AIStatus />
          {!nimiq.isConnected && (
            <span className="badge badge-amber" aria-label="Demo mode active">
              🧪 DEMO
            </span>
          )}
          {nimiq.isConnected && (
            <span className="badge badge-teal" aria-label="Connected to Nimiq Pay">
              ⚡ Nimiq Pay
            </span>
          )}
        </header>

        <main className="page">
          {/* Page-local boundary: a crash in one page (e.g. an AI-dependent
              section of ExplainBack) must not take down the sidebar, nav,
              or any other page — only main.tsx's top-level boundary is a
              true last resort. Keyed so switching pages/topics always
              starts from a clean boundary state, never a stuck fallback. */}
          <ErrorBoundary key={page + (route.params?.topic || "")}>
            <Page />
          </ErrorBoundary>
        </main>
      </div>

      {/* Development-only diagnostics (no-op in production builds) */}
      <WalletDiagnostics />
    </div>
  );
}

export default function AppRoot() {
  return (
    <NavProvider>
      <LearnerProvider>
        <Shell />
      </LearnerProvider>
    </NavProvider>
  );
}
