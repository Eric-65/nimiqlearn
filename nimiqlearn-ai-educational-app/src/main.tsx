import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
// @ts-ignore - plain JavaScript in this phase
import { initTheme } from "./services/themeService.js";
// @ts-ignore - ErrorBoundary is plain JavaScript/JSX in this phase
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

// The inline script in index.html has already stamped the attribute to avoid
// a flash; this syncs the service's own state to it and starts listening for
// OS theme changes (for "system" mode).
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
