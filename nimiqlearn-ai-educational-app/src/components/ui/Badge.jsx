import React from "react";

const TONES = {
  gold: "badge badge-gold",
  teal: "badge badge-teal",
  blue: "badge badge-blue",
  amber: "badge badge-amber",
  rose: "badge badge-rose",
  slate: "badge badge-slate",
  violet: "badge badge-violet",
};

export default function Badge({ tone = "slate", dot, children, className = "" }) {
  return (
    <span className={`${TONES[tone] || TONES.slate} ${className}`}>
      {dot && <span className="status-dot" style={{ background: "currentColor" }} aria-hidden="true" />}
      {children}
    </span>
  );
}
