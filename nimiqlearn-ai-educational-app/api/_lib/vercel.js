/* ============================================================
   NimiqLearn API — Vercel adapter
   ------------------------------------------------------------
   Turns a transport-agnostic handler from ./handlers.js into a
   Vercel serverless function. Files and folders under api/ that
   start with "_" are not routed, which is why the shared code
   lives in _lib/.
   ============================================================ */

/* Frontend and API are served from the same Vercel deployment, so CORS is
   not needed and no allow-origin header is sent by default — adding "*"
   would widen access for nothing. TEACHING_ALLOWED_ORIGIN stays supported
   for the case where the app is hosted apart from its API. */
function applyCors(res) {
  const origin = process.env.TEACHING_ALLOWED_ORIGIN;
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

/* Vercel parses a JSON body for us, but not always: an unexpected or absent
   content-type leaves req.body a string (or undefined). Parsing defensively
   costs nothing and turns a confusing 500 into a normal 400. */
function readBody(req) {
  const raw = req.body;
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return {};
}

export function createHandler(method, handler) {
  return async function vercelHandler(req, res) {
    applyCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== method) {
      res.setHeader("Allow", `${method}, OPTIONS`);
      res.status(405).json({ ok: false, error: `Use ${method} for this endpoint.` });
      return;
    }

    let body = {};
    if (method === "POST") {
      body = readBody(req);
      if (body === null) {
        res.status(400).json({ ok: false, error: "Request body must be valid JSON." });
        return;
      }
    }

    try {
      const { status, json } = await handler(body);
      res.status(status).json(json);
    } catch (err) {
      // A handler throwing is a bug, not an upstream failure — log it with
      // the route so it is findable in Vercel's function logs, and still
      // answer in the shape the frontend expects.
      console.error(`[nimiqlearn-api] Unhandled error in ${req.url}:`, err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred." });
    }
  };
}
