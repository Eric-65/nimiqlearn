import React, { useEffect, useRef } from "react";

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

  return (
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
    </div>
  );
}
