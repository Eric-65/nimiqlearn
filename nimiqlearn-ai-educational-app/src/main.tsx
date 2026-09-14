import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
// @ts-ignore - plain JavaScript in this phase
import { initTheme } from "./services/themeService.js";
// @ts-ignore - plain JavaScript in this phase
import { initI18n } from "./services/i18nService.js";
// @ts-ignore - ErrorBoundary is plain JavaScript/JSX in this phase
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

// The inline script in index.html has already stamped the attribute to avoid
// a flash; this syncs the service's own state to it and starts listening for
// OS theme changes (for "system" mode).
initTheme();

// Must run before the first render: it resolves the stored (or browser-
// detected) locale and stamps <html lang>, so the very first paint is
// already in the learner's language rather than flashing English.
initI18n();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
