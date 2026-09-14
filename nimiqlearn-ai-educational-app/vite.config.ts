import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * vite-plugin-singlefile's recommended config forces `assetsInlineLimit`
 * to inline EVERY asset regardless of size (see its source:
 * `config.build.assetsInlineLimit = () => true`). That's fine for small
 * app assets, but statically importing @huggingface/transformers pulls in
 * onnxruntime-web's WASM backend transitively — multi-tens-of-MB binaries
 * that were silently getting base64-inlined into the single HTML file
 * (observed: 339KB -> 63.7MB).
 *
 * The obvious fix — passing `overrideConfig: { build: { assetsInlineLimit }}`
 * to viteSingleFile() — is a trap: that option applies via a shallow
 * `Object.assign(config, overrideConfig)`, which REPLACES the entire
 * `config.build` object rather than merging into it, silently deleting
 * `rollupOptions.output.inlineDynamicImports` (also set by the recommended
 * config). Losing that broke @nimiq/mini-app-sdk's runtime `import()` in
 * nimiqService.js — the resulting chunk was inlined-then-deleted by the
 * singlefile plugin as usual, but the JS still tried to `fetch()` it as a
 * separate file at runtime, 404ing (observed directly in a browser: DEMO
 * MODE was reached only via that failed fetch's catch path, not because
 * Nimiq Pay was genuinely absent).
 *
 * Fix: a separate, `enforce: "post"` plugin whose `config()` hook runs
 * after viteSingleFile's and mutates only the one property that needs to
 * change, leaving everything else the recommended config set intact.
 */
function restoreAssetsInlineLimit(): Plugin {
  return {
    name: "nimiqlearn:restore-assets-inline-limit",
    enforce: "post",
    config(config) {
      if (config.build) config.build.assetsInlineLimit = 4096;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), restoreAssetsInlineLimit()],
  // Relative asset URLs, so one build works whether it's served from a
  // domain root (Vercel) or a subpath (GitHub Pages serves this repo at
  // /nimiqlearn/). Currently a no-op safety net — viteSingleFile() inlines
  // every asset, so the built HTML has no asset URLs to rewrite — but it
  // stops a subpath deploy silently 404ing if anything ever stops being
  // inlined.
  base: "./",
  // Bind the dev server to every interface, not just localhost, so the app
  // is reachable at the dev machine's LAN IP (http://192.168.x.x:5173 or
  // similar). Nimiq Pay runs the mini app in a WebView on a physical phone:
  // from inside that WebView, "localhost" is the PHONE, not this machine, so
  // a localhost-only dev server can never be loaded there. See the official
  // Mini Apps skill, "Load a Local Mini App". Dev-only — `npm run build`
  // output is a static file and is unaffected.
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
