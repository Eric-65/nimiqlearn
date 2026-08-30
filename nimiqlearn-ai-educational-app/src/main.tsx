import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
// @ts-ignore - ErrorBoundary is plain JavaScript/JSX in this phase
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
