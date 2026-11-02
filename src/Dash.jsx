import React, { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, LineChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { inr } from "./store.js";
const keyOf = (d, p) => (p === "day" ? d : p === "month" ? d.slice(0, 7) : d.slice(0, 4));
function series(txns, p) {
  const m = {};
  txns.forEach((t) => { const k = keyOf(t.date, p); m[k] = m[k] || { k, revenue: 0, expense: 0, loss: 0 }; m[k][t.type] += +t.amount || 0; });
  const a = Object.values(m).sort((x, y) => (x.k < y.k ? -1 : 1)).map((r) => ({ ...r, profit: r.revenue - r.expense - r.loss }));
  return p === "day" ? a.slice(-30) : p === "month" ? a.slice(-12) : a;
}
const PIE = ["#123A2B", "#FFC21A", "#E5383B", "#3E8E6B", "#8A6D3B", "#6B7F76"];

export default function Dash({ txns, prod, orders }) {
  const [p, setP] = useState("day");
  const s = useMemo(() => series(txns, p), [txns, p]);
  const keys = new Set(s.map((r) => r.k));
  const tot = s.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense, loss: a.loss + r.loss }), { revenue: 0, expense: 0, loss: 0 });
  const profit = tot.revenue - tot.expense - tot.loss;
  const cats = {};
  txns.filter((t) => t.type !== "revenue" && keys.has(keyOf(t.date, p))).forEach((t) => (cats[t.category] = (cats[t.category] || 0) + +t.amount));
  const pie = Object.entries(cats).map(([name, value]) => ({ name, value }));
  const pm = {};
  prod.forEach((r) => { const k = keyOf(r.date, p); if (keys.has(k)) pm[k] = (pm[k] || 0) + +r.eggs; });
  const eggs = Object.entries(pm).sort().map(([k, v]) => ({ k, eggs: v }));
  const eggTotal = eggs.reduce((a, r) => a + r.eggs, 0);
  const label = p === "day" ? "last 30 days" : p === "month" ? "last 12 months" : "all years";
  const K = [["Revenue", inr(tot.revenue), ""], ["Expenses", inr(tot.expense), ""], ["Losses", inr(tot.loss), "bad"], [profit >= 0 ? "Profit" : "Net loss", inr(Math.abs(profit)), profit >= 0 ? "good" : "bad"], ["Pending orders", orders.filter((o) => o.status === "Pending").length, ""], ["Eggs produced", eggTotal.toLocaleString("en-IN"), ""]];
  const tip = { formatter: (v) => inr(v) };
  return (
    <>
      <div className="bar"><h2>Farm performance, {label}</h2><div className="seg">{["day", "month", "year"].map((x) => <button key={x} className={x === p ? "on" : ""} onClick={() => setP(x)}>{x === "day" ? "Day wise" : x === "month" ? "Month wise" : "Year wise"}</button>)}</div></div>
      <div className="kpis">{K.map(([a, b, c]) => <div key={a} className={"kpi " + c}><span>{a}</span><b>{b}</b></div>)}</div>
      <div className="card chart"><h3>Revenue, expenses, losses and profit</h3>
        <ResponsiveContainer width="100%" height={300}><ComposedChart data={s}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="k" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={50} /><Tooltip {...tip} /><Legend />
          <Bar dataKey="revenue" fill="#3E8E6B" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="#FFC21A" radius={[4, 4, 0, 0]} /><Bar dataKey="loss" fill="#E5383B" radius={[4, 4, 0, 0]} /><Line dataKey="profit" stroke="#123A2B" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></div>
      <div className="two">
        <div className="card chart"><h3>Where the money goes</h3>{pie.length ? <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer> : <p className="muted">No expenses recorded for this period.</p>}</div>
        <div className="card chart"><h3>Eggs produced</h3>{eggs.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={eggs}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="k" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={44} /><Tooltip /><Line dataKey="eggs" stroke="#123A2B" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer> : <p className="muted">No production logged for this period.</p>}</div>
      </div>
    </>
  );
}

