import { useSyncExternalStore, useCallback } from "react";
/* One shared cache for everything saved on this device. Every screen reads the same parsed copy, so a change shows up everywhere at once,
   also in other open tabs (storage event). Nothing is parsed twice. */
const cache = new Map(), subs = new Map();
const parse = (k, i) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : i; } catch { return i; } };
const get = (k, init) => { if (!cache.has(k)) cache.set(k, parse(k, init)); return cache.get(k); };
const emit = (k) => subs.get(k)?.forEach((f) => f());
export const peek = (k, init) => get(k, init); // read a saved value once, without subscribing
export function setKey(k, v) { cache.set(k, v); try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } emit(k); }
export function removeKey(k) { cache.delete(k); try { localStorage.removeItem(k); } catch {} emit(k); }
export function reloadAll() { cache.clear(); [...subs.keys()].forEach(emit); }
if (typeof addEventListener === "function") addEventListener("storage", (e) => { if (e.key === null) return reloadAll(); cache.delete(e.key); emit(e.key); });
export function useLS(k, init) {
  const sub = useCallback((f) => { let s = subs.get(k); if (!s) subs.set(k, (s = new Set())); s.add(f); return () => s.delete(f); }, [k]);
  const v = useSyncExternalStore(sub, () => get(k, init), () => init);
  const set = useCallback((fn) => { const p = get(k, init); setKey(k, typeof fn === "function" ? fn(p) : fn); }, [k]);
  return [v, set];
}
export const uid = () => Math.random().toString(36).slice(2, 9);
const p2 = (n) => String(n).padStart(2, "0");
export const localYmd = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }; // the farmer's own date, not UTC
export const today = () => localYmd();
export const inr = (n) => { const v = Math.round((+n || 0) * 100) / 100; return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
export function demo() {
  const t = [], p = [], now = Date.now();
  for (let i = 120; i >= 0; i--) {
    const d = localYmd(now - i * 864e5);
    const eggs = Math.round(380 + Math.random() * 60);
    p.push({ id: uid(), date: d, eggs, broken: Math.round(Math.random() * 8), birds: 450 });
    t.push({ id: uid(), date: d, type: "revenue", category: "Egg sales", amount: Math.round(eggs * 7.4 * (0.9 + Math.random() * 0.2)), note: "" });
    t.push({ id: uid(), date: d, type: "expense", category: "Feed", amount: Math.round(2200 + Math.random() * 300), note: "" });
    if (i % 7 === 0) t.push({ id: uid(), date: d, type: "expense", category: "Labour", amount: 2800, note: "" });
    if (i % 10 === 0) t.push({ id: uid(), date: d, type: "revenue", category: "Chicken sales", amount: Math.round(5000 + Math.random() * 3000), note: "" });
    if (i % 19 === 0) t.push({ id: uid(), date: d, type: "loss", category: "Bird mortality", amount: Math.round(400 + Math.random() * 900), note: "" });
    if (i % 28 === 0) t.push({ id: uid(), date: d, type: "expense", category: "Medicine", amount: 1800, note: "" });
  }
  return { t, p };
}
export function useUser() {
  const [users, setUsers] = useLS("kf_users", []);
  const [sid, setSid] = useLS("kf_session", null);
  const user = users.find((u) => u.id === sid && !u.blocked) || null;
  const update = (patch) => setUsers((us) => us.map((u) => (u.id === sid ? { ...u, ...patch } : u)));
  return { user, users, setUsers, sid, setSid, update };
}
