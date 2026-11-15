import crypto from "node:crypto";
import { b64, unb64, sign, safeEq, send, config, limited, clientIp, body } from "./_lib.js";

/* POST { token, otp }  ->  { session } valid for 12 hours. A code is locked after 5 wrong tries and can be used once. */
const used = new Set();
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const c = config();
  if (c.missing.length) return send(res, 500, { error: "not_configured" });
  if (limited("verify:" + clientIp(req), 30, 15 * 60e3)) return send(res, 429, { error: "slow_down" });
  const { token, otp } = body(req), [payload, sig] = String(token || "").split(".");
  const p = unb64(payload);
  if (!p || !sig || !/^\d{6}$/.test(String(otp || ""))) return send(res, 400, { error: "bad_request" });
  if (Date.now() > p.exp) return send(res, 401, { error: "expired" });
  if (used.has(p.n)) return send(res, 401, { error: "used" });
  if (limited("code:" + p.n, 5, 10 * 60e3)) return send(res, 429, { error: "locked" });
  if (!safeEq(sig, sign(c.secret, "otp|" + payload + "|" + otp))) return send(res, 401, { error: "wrong" });
  used.add(p.n); if (used.size > 2000) used.clear();
  const sp = b64({ role: "Owner", exp: Date.now() + 12 * 3600e3, n: crypto.randomBytes(8).toString("hex") });
  send(res, 200, { session: sp + "." + sign(c.secret, "sess|" + sp), exp: Date.now() + 12 * 3600e3 });
}
