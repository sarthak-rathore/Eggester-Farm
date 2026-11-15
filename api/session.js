import { unb64, sign, safeEq, send, config, body } from "./_lib.js";

/* POST { session }  ->  { ok } tells the dashboard whether a login is still valid (not expired, not tampered with) */
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const c = config();
  if (c.missing.length) return send(res, 500, { error: "not_configured" });
  const [payload, sig] = String(body(req).session || "").split("."), p = unb64(payload);
  const ok = !!(p && sig && Date.now() < p.exp && safeEq(sig, sign(c.secret, "sess|" + payload)));
  send(res, 200, { ok, role: ok ? p.role : undefined });
}
