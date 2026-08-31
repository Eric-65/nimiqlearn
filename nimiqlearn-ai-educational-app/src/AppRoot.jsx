import React, { useEffect } from "react";
import { NavProvider, useNav } from "./context/NavContext.jsx";
import { LearnerProvider } from "./context/LearnerContext.jsx";
import { useNimiq } from "./hooks/useNimiq.js";
import { startPrewarm } from "./services/aiService.js";
import AIStatus from "./components/ai/AIStatus.jsx";
import AIDiagnostics from "./components/ai/AIDiagnostics.jsx";
import WalletDiagnostics from "./components/payments/WalletDiagnostics.jsx";
// @ts-ignore - plain JavaScript/JSX in this phase
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import Home from "./pages/Home.jsx";
import Learn from "./pages/Learn.jsx";
import ExplainBack from "./pages/ExplainBack.jsx";
import ForgetMeNot from "./pages/ForgetMeNot.jsx";
import Knowledge from "./pages/Knowledge.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import Wallet from "./pages/Wallet.jsx";

const NAV_ITEMS = [
  { path: "home", label: "Home", icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" },
  { path: "learn", label: "Learn", icon: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" },
  { path: "explain", label: "ExplainBack", icon: "M8 12h8M8 8h5M12 20l-3-4H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-3 4z" },
  { path: "review", label: "ForgetMeNot", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { path: "knowledge", label: "Knowledge", icon: "M3 5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM8 13h5m-5 4h8" },
  { path: "market", label: "Marketplace", icon: "M21 11.5v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8M3 7h18l-1.5-4H4.5L3 7zm9 4a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "wallet", label: "Wallet", icon: "M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm15 4h2M16 11h.01" },
];

const PAGES = {
  home: Home,
  learn: Learn,
  explain: ExplainBack,
  review: ForgetMeNot,
  knowledge: Knowledge,
  market: Marketplace,
  wallet: Wallet,
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
  const page = (route.path || "/home").replace(/^\//, "");
  const Page = PAGES[page] || Home;

  // Trigger #1 — background AI prewarm as soon as the app is interactive.
  // Fire-and-forget, never blocks rendering, navigation, wallet, or payments.
  // The model starts downloading in the background so that by the time the
  // learner reaches ExplainBack, the AI is ready (no post-submit warm-up).
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) startPrewarm({ background: true });
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = setTimeout(run, 2500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Brand />
        <div className="nav-section-label">Learn</div>
        {NAV_ITEMS.slice(0, 4).map((item) => (
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
          </button>
        ))}
        <div className="nav-section-label">Economy</div>
        <span className="nav-divider" aria-hidden="true" />
        {NAV_ITEMS.slice(4).map((item) => (
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
          </button>
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
      <AIDiagnostics />
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
