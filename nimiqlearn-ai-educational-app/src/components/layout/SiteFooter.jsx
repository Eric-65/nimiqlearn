import React from "react";
import { useI18n } from "../../hooks/useI18n.js";

/**
 * Site footer — attribution and outbound links, on every page.
 *
 * Two groups: the Nimiq platform this mini app runs on, and the project's
 * own resources. Product names (Nimiq Pay, Nimiq Wallet, GitHub, MIT
 * License) are proper nouns and stay as they are in every language; the
 * group headings and the descriptive labels go through t() like the rest
 * of the UI.
 *
 * Every link leaves the app, so each one carries rel="noopener noreferrer"
 * — noopener so the opened page cannot reach back through window.opener,
 * noreferrer so it is not told which page sent the visitor. Inside Nimiq
 * Pay's webview these open in the system browser rather than replacing the
 * mini app, which is what we want: a learner who taps "Block explorer"
 * should not lose their session.
 */

const GROUPS = [
  {
    id: "nimiq",
    headingKey: "footer.nimiq",
    links: [
      { label: "Nimiq Pay", href: "https://nimiq.com/pay/" },
      { labelKey: "footer.miniAppsDocs", href: "https://nimiq.dev/mini-apps/" },
      { label: "Nimiq Wallet", href: "https://wallet.nimiq.com/" },
    ],
  },
  {
    id: "resources",
    headingKey: "footer.resources",
    links: [
      /* First in the group on purpose: someone meeting NimiqLearn for the
         first time gets more from two minutes of it working than from the
         source tree. */
      { labelKey: "footer.howItWorks", href: "https://youtu.be/qPjU2qBD23k?si=hnaWluNrOHTpSRIN" },
      { label: "GitHub", href: "https://github.com/Eric-65/nimiqlearn" },
      { label: "MIT License", href: "https://github.com/Eric-65/nimiqlearn?tab=MIT-1-ov-file" },
      { labelKey: "footer.explorer", href: "https://nimiq.watch/" },
      { labelKey: "footer.developer", href: "https://x.com/eric0xbt" },
    ],
  },
];

export default function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="site-footer" aria-label={t("footer.aria")}>
      <div className="site-footer-inner">
        {GROUPS.map((group) => (
          <nav key={group.id} className="site-footer-group" aria-label={t(group.headingKey)}>
            <h2 className="site-footer-heading">{t(group.headingKey)}</h2>
            <ul className="site-footer-links">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    className="site-footer-link"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.labelKey ? t(link.labelKey) : link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
