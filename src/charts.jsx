import React from "react";
import { ResponsiveContainer } from "recharts";
import { addDays } from "./farm.js";
export const COL = { green: "#3E8E6B", dark: "#123A2B", yolk: "#FFC21A", red: "#E5383B", blue: "#2F6FDE", orange: "#E58A1F", grey: "#8AA096" };
export const PIE = ["#123A2B", "#FFC21A", "#E5383B", "#3E8E6B", "#2F6FDE", "#E58A1F", "#8AA096"];
export const ChartCard = ({ title, hint, h = 260, children }) => (
  <div className="card chart"><h3>{title}</h3>{hint && <p className="muted sm">{hint}</p>}<ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer></div>
);
export const Kpi = ({ l, v, t, hint }) => <div className={"kpi " + (t || "")}><span>{l}</span><b>{v}</b>{hint && <small className="muted">{hint}</small>}</div>;
export const Alerts = ({ list }) => (list.length ? <div className="alerts">{list.map((a, i) => <div key={i} className={"alert " + a.level}>{a.text}</div>)}</div> : null);
export const nf = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "–" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d }));

/* ---------- date range filter (today, week, month, custom...) ---------- */
const PRESETS = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["last", "Last month"], ["30d", "Last 30 days"], ["year", "This year"], ["all", "All time"], ["custom", "Custom"]];
export function rangeOf(v) {
  const t = new Date().toISOString().slice(0, 10);
  const dow = (new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7;
  switch (v.preset) {
    case "today": return { from: t, to: t };
    case "week": return { from: addDays(t, -dow), to: t };
    case "month": return { from: t.slice(0, 8) + "01", to: t };
    case "last": { const [y, m] = [+t.slice(0, 4), +t.slice(5, 7)]; const d = new Date(Date.UTC(y, m - 2, 1)), e = new Date(Date.UTC(y, m - 1, 0)); return { from: d.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) }; }
    case "30d": return { from: addDays(t, -29), to: t };
    case "year": return { from: t.slice(0, 5) + "01-01", to: t };
    case "custom": return { from: v.from || "0000-00-00", to: v.to || "9999-99-99" };
    default: return { from: "0000-00-00", to: "9999-99-99" };
  }
}
export const inRange = (d, r) => d >= r.from && d <= r.to;
export function RangeFilter({ v, set }) {
  return (
    <div className="rangebar">
      <div className="chips">{PRESETS.map(([k, l]) => <button key={k} className={v.preset === k ? "on" : ""} onClick={() => set({ preset: k, from: v.from, to: v.to })}>{l}</button>)}</div>
      <label className="inl monthpick">Or pick a month<input type="month" value={v.month || ""} max={new Date().toISOString().slice(0, 7)} onChange={(e) => { const m = e.target.value; if (!m) return set({ preset: "month" }); const last = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(); set({ preset: "custom", from: m + "-01", to: m + "-" + String(last).padStart(2, "0"), month: m, pickMonth: true }); }} /></label>
      {v.preset === "custom" && !v.pickMonth && <div className="row"><label className="inl">From<input type="date" value={v.from || ""} onChange={(e) => set({ ...v, from: e.target.value })} /></label><label className="inl">To<input type="date" value={v.to || ""} onChange={(e) => set({ ...v, to: e.target.value })} /></label></div>}
    </div>
  );
}
