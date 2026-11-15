const enc = new TextEncoder();
export const salt = () => {
  const a = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a); else a.forEach((_, i) => (a[i] = Math.random() * 256));
  return Array.from(a).join("");
};
function simple(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
const hex = (b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const same = (x, y) => { if (x.length !== y.length) return false; let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; };
/* new passwords and PINs: PBKDF2 (100,000 rounds) with a random salt. Old accounts (single SHA-256) still log in and keep working. */
export async function hash(pw, s) {
  const sub = globalThis.crypto?.subtle;
  if (!sub) return "f" + simple(s + pw);
  const key = await sub.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return "p1$" + hex(await sub.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(s), iterations: 100000 }, key, 256));
}
async function legacy(pw, s) {
  const str = s + pw;
  if (globalThis.crypto?.subtle) return hex(await globalThis.crypto.subtle.digest("SHA-256", enc.encode(str)));
  return "f" + simple(str);
}
export async function check(pw, s, stored) {
  if (!stored || typeof stored !== "string") return false;
  return same(stored, stored.startsWith("p1$") ? await hash(pw, s) : await legacy(pw, s));
}

/* slow down guessing: 5 wrong tries lock that login for 5 minutes (kept in this browser) */
const LK = "kf_lock";
const lockState = () => { try { return JSON.parse(localStorage.getItem(LK) || "{}"); } catch { return {}; } };
export const lockedFor = (id) => { const s = lockState()[id]; return s && s.until > Date.now() ? Math.ceil((s.until - Date.now()) / 1000) : 0; };
export function failLogin(id) { const all = lockState(), s = all[id] && all[id].until > Date.now() - 36e5 ? all[id] : { n: 0 }; s.n = (s.n || 0) + 1; if (s.n >= 5) { s.until = Date.now() + 3e5; s.n = 0; } all[id] = s; try { localStorage.setItem(LK, JSON.stringify(all)); } catch {} }
export function clearFails(id) { const all = lockState(); delete all[id]; try { localStorage.setItem(LK, JSON.stringify(all)); } catch {} }
