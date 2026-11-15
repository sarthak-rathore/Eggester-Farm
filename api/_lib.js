// Shared helpers for the OTP login functions (Vercel serverless, Node). Files starting with "_" are not exposed as URLs.
import crypto from "node:crypto";

export const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
export const unb64 = (s) => { try { return JSON.parse(Buffer.from(String(s), "base64url").toString()); } catch { return null; } };
export const sign = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("base64url");
export const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export const digits = (s) => String(s || "").replace(/\D/g, "").slice(-10);
export const normEmail = (s) => String(s || "").trim().toLowerCase();

export function send(res, status, body) { res.setHeader("Cache-Control", "no-store"); res.status(status).json(body); }

/* what the server needs; returns the list of missing settings so the owner sees exactly what to add in Vercel */
export function config() { // missing settings are written to the server log (Vercel > Logs), never sent to the browser
  const e = process.env, channel = (e.OTP_CHANNEL || "email").toLowerCase() === "sms" ? "sms" : "email", missing = [];
  if (!e.OTP_SECRET || e.OTP_SECRET.length < 32) missing.push("OTP_SECRET (at least 32 random characters)");
  if (channel === "email") { if (!e.ADMIN_EMAIL) missing.push("ADMIN_EMAIL"); if (!e.RESEND_API_KEY) missing.push("RESEND_API_KEY"); if (!e.OTP_FROM_EMAIL) missing.push("OTP_FROM_EMAIL"); }
  else { if (!e.ADMIN_PHONE) missing.push("ADMIN_PHONE"); if (!e.FAST2SMS_API_KEY) missing.push("FAST2SMS_API_KEY"); }
  if (missing.length) console.error("[otp] not configured, missing:", missing.join(", "));
  return { channel, missing, secret: e.OTP_SECRET || "", e };
}

/* small in-memory limiter. Serverless instances do not share memory, so this is a safety net only;
   the 6-digit code also expires in 5 minutes and is locked after 5 wrong tries per code. Add Vercel's rate limiting for more. */
const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}
export const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
export const mask = (s) => { s = String(s || ""); if (s.includes("@")) { const [a, d] = s.split("@"); return a.slice(0, 2) + "•••@" + d; } return "••••••" + digits(s).slice(-4); };
export const body = (req) => (typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body || {});
