// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
const res = () => { const r = { code: 0, body: null, headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const req = (body, ip = "1.1.1.1") => ({ method: "POST", body, headers: { "x-forwarded-for": ip }, socket: {} });
const env = { OTP_SECRET: "x".repeat(40), OTP_CHANNEL: "email", ADMIN_EMAIL: "owner@farm.com", RESEND_API_KEY: "re_key", OTP_FROM_EMAIL: "Eggester <a@b.com>" };
let sent;
beforeEach(() => { vi.resetModules(); Object.assign(process.env, env); sent = []; vi.stubGlobal("fetch", vi.fn(async (u, i) => { sent.push({ u, b: JSON.parse(i.body) }); return { ok: true }; })); });
const codeFrom = () => sent[0].b.text.match(/\b(\d{6})\b/)[1];

describe("OTP functions", () => {
  it("owner gets a code and can log in once", async () => {
    const send = (await import("../api/send-otp.js")).default, verify = (await import("../api/verify-otp.js")).default, session = (await import("../api/session.js")).default;
    const r1 = res(); await send(req({ id: "Owner@Farm.com" }), r1); expect(r1.code).toBe(200); expect(sent).toHaveLength(1); expect(sent[0].b.to).toEqual(["owner@farm.com"]);
    expect(JSON.stringify(r1.body)).not.toContain(codeFrom()); // the code is never in the response
    const bad = res(); await verify(req({ token: r1.body.token, otp: "000000" }), bad); expect(bad.code).toBe(401);
    const ok = res(); await verify(req({ token: r1.body.token, otp: codeFrom() }), ok); expect(ok.code).toBe(200); expect(ok.body.session).toBeTruthy();
    const again = res(); await verify(req({ token: r1.body.token, otp: codeFrom() }), again); expect(again.code).toBe(401); // single use
    const s = res(); await session(req({ session: ok.body.session }), s); expect(s.body.ok).toBe(true);
    const t = res(); await session(req({ session: ok.body.session.replace(/.$/, "A") }), t); expect(t.body.ok).toBe(false); // tampered
  });
  it("a stranger gets the same answer but no message is sent", async () => {
    const send = (await import("../api/send-otp.js")).default, verify = (await import("../api/verify-otp.js")).default;
    const r = res(); await send(req({ id: "hacker@evil.com" }), r); expect(r.code).toBe(200); expect(r.body.token).toBeTruthy(); expect(sent).toHaveLength(0);
    const v = res(); await verify(req({ token: r.body.token, otp: "123456" }), v); expect(v.code).toBe(401);
  });
  it("5 wrong guesses lock the code", async () => {
    const send = (await import("../api/send-otp.js")).default, verify = (await import("../api/verify-otp.js")).default;
    const r = res(); await send(req({ id: "owner@farm.com" }), r); const right = codeFrom(); let last;
    for (let i = 0; i < 6; i++) { last = res(); await verify(req({ token: r.body.token, otp: "11111" + i }), last); }
    expect(last.code).toBe(429); const ok = res(); await verify(req({ token: r.body.token, otp: right }), ok); expect(ok.code).toBe(429);
  });
  it("expired codes are refused", async () => {
    const send = (await import("../api/send-otp.js")).default, verify = (await import("../api/verify-otp.js")).default;
    const r = res(); await send(req({ id: "owner@farm.com" }), r); const code = codeFrom();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 6 * 60e3); const v = res(); await verify(req({ token: r.body.token, otp: code }), v); vi.useRealTimers(); expect(v.code).toBe(401); expect(v.body.error).toBe("expired");
  });
  it("missing settings: generic error, nothing revealing in the response", async () => {
    delete process.env.OTP_SECRET; const send = (await import("../api/send-otp.js")).default; const r = res(); await send(req({ id: "a@b.com" }), r);
    expect(r.code).toBe(500); expect(JSON.stringify(r.body)).toBe('{"error":"not_configured"}');
  });
  it("too many requests from one address are slowed down", async () => {
    const send = (await import("../api/send-otp.js")).default; let last; for (let i = 0; i < 7; i++) { last = res(); await send(req({ id: "x@y.com" }, "9.9.9.9"), last); }
    expect(last.code).toBe(429);
  });
  it("sms channel calls the SMS provider with the owner's number only", async () => {
    Object.assign(process.env, { OTP_CHANNEL: "sms", ADMIN_PHONE: "9876543210", FAST2SMS_API_KEY: "k" }); const send = (await import("../api/send-otp.js")).default;
    const r = res(); await send(req({ id: "+91 98765 43210" }), r); expect(sent[0].u).toContain("fast2sms"); expect(sent[0].b.numbers).toBe("9876543210");
  });
});
