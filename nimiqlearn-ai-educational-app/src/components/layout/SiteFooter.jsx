import React from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { useNav } from "../../context/NavContext.jsx";

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
      /* Internal (`page`): every video and brand asset the app uses, with
         creator, licence and source. Sits next to the licence link because
         it is the same question — what is this made of, and on what terms. */
      { labelKey: "footer.credits", href: "#/credits", page: "credits" },
      { labelKey: "footer.explorer", href: "https://nimiq.watch/" },
      { labelKey: "footer.developer", href: "https://x.com/eric0xbt" },
    ],
  },
];

export default function SiteFooter() {
  const { t } = useI18n();
  const { navigate } = useNav();

  /* Read from the clock rather than hard-coded, so the line does not quietly
     go stale on 1 January. */
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label={t("footer.aria")}>
      <div className="site-footer-inner">
        {GROUPS.map((group) => (
          <nav key={group.id} className="site-footer-group" aria-label={t(group.headingKey)}>
            <h2 className="site-footer-heading">{t(group.headingKey)}</h2>
            <ul className="site-footer-links">
              {group.links.map((link) => (
                <li key={link.href}>
                  {link.page ? (
                    /* Same treatment as the language link below: a real
                       href for middle-click and screen readers, routed by
                       navigate() so the new page opens at the top. */
                    <a
                      className="site-footer-link"
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(link.page);
                      }}
                    >
                      {link.labelKey ? t(link.labelKey) : link.label}
                    </a>
                  ) : (
                    <a
                      className="site-footer-link"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.labelKey ? t(link.labelKey) : link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Below the two groups, centred: the language switch and the copyright
          line. "Change language" sits above the copyright because it is the
          one thing here a learner might actually need — someone who cannot
          read the page has to find it without reading the page, which is why
          it is a link of its own down here as well as a card in Settings.

          It is a real <a> with a real href, so it can be middle-clicked and
          reads as a link to a screen reader, but the click is handled by the
          router: letting the hash change on its own would land the learner on
          Settings still scrolled to the bottom of the page they left, and the
          language card is at the top. */}
      <div className="site-footer-bottom">
        <a
          className="site-footer-language"
          href="#/settings"
          onClick={(e) => {
            e.preventDefault();
            navigate("settings");
          }}
        >
          {t("footer.changeLanguage")}
        </a>
        {/* "NimiqLearn" is the product name and stays as it is in every
            language; the year is a number. Nothing here needs translating. */}
        <p className="site-footer-copyright">© {year} NimiqLearn</p>
      </div>
    </footer>
  );
}
