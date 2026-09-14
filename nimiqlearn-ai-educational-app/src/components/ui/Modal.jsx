import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Accessible modal: ESC to close, backdrop click, focus on open,
 * labelled region, restores focus on close.
 */
export default function Modal({ open, onClose, title, children, labelledBy, maxWidth }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement;
      const t = setTimeout(() => panelRef.current?.focus(), 30);
      const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
        if (e.key === "Tab" && panelRef.current) {
          const focusables = panelRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
        restoreRef.current?.focus?.();
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  // Rendered via a portal straight onto <body>, NOT in place in the page
  // tree. A `position: fixed` element is only fixed to the true viewport
  // if none of its ancestors has a transform/filter/perspective/will-change
  // (they create their own containing block instead) — and .page carries a
  // one-shot entrance animation (`rise-in ... both`) whose fill-mode holds
  // `transform: translateY(0)` on it forever after the animation ends. With
  // the modal nested inside .page, that silently turned the backdrop into
  // something positioned against the (scrolled, taller-than-viewport) page
  // box instead of the screen — the panel could open partly or fully off
  // the visible window depending on scroll position. A portal sidesteps the
  // whole class of bug rather than depending on no ancestor ever animating
  // a transform.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || "modal-title"}
        tabIndex={-1}
        className="modal-panel"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
