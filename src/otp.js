// Talks to the OTP functions in /api. Nothing secret lives here.
const post = async (path, data) => {
  try {
    const r = await fetch("/api/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...j } : { ok: false, status: r.status, error: j.error || "failed" };
  } catch { return { ok: false, error: "network" }; }
};
export const sendOtp = (id) => post("send-otp", { id });
export const verifyOtp = (token, otp) => post("verify-otp", { token, otp });
export const checkSession = (session) => post("session", { session });
export const otpMessage = (r) => ({
  not_configured: "Login is not set up yet. Please contact the person who installed this website.", network: "Cannot reach the server. Please check your internet and try again.",
  slow_down: "Too many requests. Please wait a few minutes and try again.", send_failed: "The code could not be sent. Please try again in a minute.", expired: "This code has expired. Please ask for a new one.",
  used: "This code was already used. Please ask for a new one.", wrong: "That code is not correct.", locked: "Too many wrong codes. Please ask for a new code after a few minutes.", bad_request: "Please enter the 6-digit code.",
}[r.error] || "Something went wrong. Please try again.");
export const sessionExp = (s) => { try { return JSON.parse(atob(String(s).split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).exp || 0; } catch { return 0; } };
