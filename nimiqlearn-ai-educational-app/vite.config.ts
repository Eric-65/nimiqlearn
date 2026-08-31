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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
