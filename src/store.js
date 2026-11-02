import { useState, useEffect, useCallback } from "react";
const read = (k, i) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : i; } catch { return i; } };
export function useLS(k, init) {
  const [v, setV] = useState(() => read(k, init));
  useEffect(() => {
    const f = (e) => { if (e.key === k) setV(read(k, init)); };
    const g = (e) => { if (e.detail === k) setV(read(k, init)); };
    addEventListener("storage", f);
    addEventListener("kf-ls", g);
    return () => { removeEventListener("storage", f); removeEventListener("kf-ls", g); };
  }, [k]);
  const set = useCallback((fn) => setV((p) => {
    const n = typeof fn === "function" ? fn(p) : fn;
    try { localStorage.setItem(k, JSON.stringify(n)); } catch {}
    queueMicrotask(() => dispatchEvent(new CustomEvent("kf-ls", { detail: k })));
    return n;
  }), [k]);
  return [v, set];
}
export const uid = () => Math.random().toString(36).slice(2, 9);
export const today = () => new Date().toISOString().slice(0, 10);
export const inr = (n) => { const v = Math.round((+n || 0) * 100) / 100; return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
export function demo() {
  const t = [], p = [], now = Date.now();
  for (let i = 120; i >= 0; i--) {
    const d = new Date(now - i * 864e5).toISOString().slice(0, 10);
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
