import crypto from "node:crypto";
import { b64, sign, safeEq, digits, normEmail, send, config, limited, clientIp, mask, body } from "./_lib.js";

/* POST { id }  ->  sends a 6-digit code to the owner's email or phone (only if id is the owner), returns a signed token.
   Same answer whether or not id is right, so nobody can find out which email or number belongs to the owner. */
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const c = config();
  if (c.missing.length) return send(res, 500, { error: "not_configured" });
  if (limited("send:" + clientIp(req), 5, 15 * 60e3)) return send(res, 429, { error: "slow_down" });
  const id = String(body(req).id || "").trim().slice(0, 120);
  if (!id) return send(res, 400, { error: "missing_id" });

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const payload = b64({ exp: Date.now() + 5 * 60e3, n: crypto.randomBytes(8).toString("hex") });
  const token = payload + "." + sign(c.secret, "otp|" + payload + "|" + otp);
  const isOwner = c.channel === "email" ? safeEq(normEmail(id), normEmail(c.e.ADMIN_EMAIL)) : digits(id).length === 10 && safeEq(digits(id), digits(c.e.ADMIN_PHONE));
  if (isOwner) {
    try {
      const name = c.e.OTP_BRAND || "Eggester";
      if (c.channel === "email") {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + c.e.RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ from: c.e.OTP_FROM_EMAIL, to: [c.e.ADMIN_EMAIL], subject: `${otp} is your ${name} login code`, text: `Your ${name} owner login code is ${otp}.\nIt works for 5 minutes. Do not share it with anyone.` }) });
        if (!r.ok) throw new Error("email " + r.status);
      } else {
        const r = await fetch("https://www.fast2sms.com/dev/bulkV2", { method: "POST", headers: { authorization: c.e.FAST2SMS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ route: "otp", variables_values: otp, numbers: digits(c.e.ADMIN_PHONE) }) });
        if (!r.ok) throw new Error("sms " + r.status);
      }
    } catch (err) { console.error("[otp] send failed:", err?.message); return send(res, 502, { error: "send_failed" }); }
  }
  send(res, 200, { token, expiresIn: 300, to: mask(id), channel: c.channel });
}
