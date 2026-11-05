import React from "react";
import { ResponsiveContainer } from "recharts";
export const COL = { green: "#3E8E6B", dark: "#123A2B", yolk: "#FFC21A", red: "#E5383B", blue: "#2F6FDE", orange: "#E58A1F", grey: "#8AA096" };
export const PIE = ["#123A2B", "#FFC21A", "#E5383B", "#3E8E6B", "#2F6FDE", "#E58A1F", "#8AA096"];
export const ChartCard = ({ title, hint, h = 260, children }) => (
  <div className="card chart"><h3>{title}</h3>{hint && <p className="muted sm">{hint}</p>}<ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer></div>
);
export const Kpi = ({ l, v, t, hint }) => <div className={"kpi " + (t || "")}><span>{l}</span><b>{v}</b>{hint && <small className="muted">{hint}</small>}</div>;
export const Alerts = ({ list }) => (list.length ? <div className="alerts">{list.map((a, i) => <div key={i} className={"alert " + a.level}>{a.text}</div>)}</div> : null);
export const nf = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "–" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d }));
