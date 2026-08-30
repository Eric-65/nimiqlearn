import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* Tiny hash-based router: #/home, #/learn, #/explain, … */

const PAGE_ALIASES = { "/": "/home" };

function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/home";
  const [path, query = ""] = raw.split("?");
  const params = Object.fromEntries(new URLSearchParams(query).entries());
  return { path: PAGE_ALIASES[path] || path, params };
}

const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((path, params = {}) => {
    const query = new URLSearchParams(params).toString();
    window.location.hash = `/${path.replace(/^\//, "")}${query ? `?${query}` : ""}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return <NavContext.Provider value={{ route, navigate }}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used inside <NavProvider>");
  return ctx;
}
