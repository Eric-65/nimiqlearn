import React from "react";

export default function Card({ title, sub, hover = false, className = "", children, ...rest }) {
  return (
    <section className={`card ${hover ? "card-hover" : ""} ${className}`} {...rest}>
      {(title || sub) && (
        <header style={{ marginBottom: 14 }}>
          {title && <h3 className="card-title">{title}</h3>}
          {sub && <p className="card-sub" style={{ margin: 0 }}>{sub}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
