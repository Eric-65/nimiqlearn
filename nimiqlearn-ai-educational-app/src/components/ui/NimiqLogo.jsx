import React, { useId } from "react";

/**
 * The Nimiq hexagon, inline.
 *
 * Path data and the radial gradient are the official asset from the Nimiq
 * Design Kit (https://nimiq.dev/logos/nimiq/hexagon.svg), copied verbatim —
 * the mini-apps pre-ship checklist requires brand assets to come from the
 * kit rather than be redrawn. The kit's guidance: use the hexagon alone as
 * an icon; use the horizontal wordmark version when space allows.
 *
 * Inlined (not an <img src>) so it needs no separate file in the single-file
 * build, scales crisply at any size, and can carry an accessible name.
 *
 * The gradient id is generated per instance: SVG <defs> ids are global to
 * the document, so two logos on one page sharing a hardcoded id would both
 * resolve to whichever <defs> was parsed first.
 */
export default function NimiqLogo({ size = 72, title = "Nimiq", ...rest }) {
  const gradientId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 18"
      width={size}
      height={Math.round((size * 18) / 20)}
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient
          id={gradientId}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="matrix(-19.9562 0 0 -18 19.956 18)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EC991C" />
          <stop offset="1" stopColor="#E9B213" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M19.734 8.156 15.576.844A1.66 1.66 0 0014.135 0H5.819C5.226 0 4.677.32 4.38.844L.222 8.156a1.71 1.71 0 000 1.688l4.158 7.312c.297.523.846.844 1.439.844h8.316c.593 0 1.142-.32 1.438-.844l4.158-7.312c.3-.523.3-1.165.003-1.688"
      />
    </svg>
  );
}
