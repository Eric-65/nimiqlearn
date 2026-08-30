import React from "react";
import Button from "./Button.jsx";

/**
 * Global error boundary. Guarantees the single-file app can never show a
 * blank page: any render/lifecycle exception surfaces a friendly recovery
 * screen instead of white. The AI, wallet, and learning subsystems each
 * fail independently — this is the last line of defence.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[NimiqLearn] App crashed at runtime", error, info);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--c-bg)",
          color: "var(--c-text)",
        }}
      >
        <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">🛠️</div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p className="small muted" style={{ margin: "0 0 18px" }}>
            The interface hit an unexpected error. Your progress is safe — this is a display issue, not a learning or
            payment issue.
          </p>
          <div className="flex gap-12" style={{ justifyContent: "center" }}>
            <Button variant="primary" onClick={this.handleReset}>Try to recover</Button>
            <Button variant="outline" onClick={this.handleReload}>Reload app</Button>
          </div>
          {this.props.showDetails && this.state.error && (
            <p className="tiny muted" style={{ marginTop: 16, fontFamily: "monospace", wordBreak: "break-word" }}>
              {String(this.state.error?.message || this.state.error).slice(0, 300)}
            </p>
          )}
        </div>
      </div>
    );
  }
}
