import React, { useState, useMemo, lazy, Suspense } from "react";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useFarmData, useAnalysis, ledger, rawStock, TRAY, EXP_CATS } from "./farm.js";
import { inr, today } from "./store.js";
import { COL, ChartCard, nf, RangeFilter, rangeOf, inRange } from "./charts.jsx";
import { kgText, qtyText } from "./units.js";
const Dash = lazy(() => import("./Dash.jsx"));
const sum = (a, f) => a.reduce((x, y) => x + (+f(y) || 0), 0);
const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const REPORTS = [["daily", "📅", "Day by day"], ["month", "🗓️", "Month by month profit"], ["eggs", "🥚", "Egg production"], ["sales", "💰", "Sales by customer"], ["exp", "🧾", "Expenses"], ["feed", "🌾", "Feed use and cost"], ["mort", "🐔", "Birds died"], ["stock", "📦", "Stock today"], ["charts", "📈", "All graphs"]];
const eggsOf = (o) => (o.items || []).reduce((s, i) => s + i.qty * (i.eggs || TRAY), 0);

function download(name, heads, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[heads, ...rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" })); a.download = `${name}-${today()}.csv`; a.click();
}

export default function Reports({ batchId = "", d }) {
  const F = useFarmData(); const A = useAnalysis(d.orders, d.txns, batchId);
  const [kind, setKind] = useState("daily"); const [rv, setRv] = useState({ preset: "month" }); const r = rangeOf(rv);
  const batch = F.batches.find((b) => b.id === batchId);
  const rows = A.rows.filter((x) => inRange(x.date, r)).slice().reverse();
  const L = useMemo(() => ledger({ orders: d.orders, batches: F.batches, feed: F.feed, rawBuy: F.rawBuy, boxes: F.boxes, trays: F.trays, txns: batchId ? [] : d.txns, farms: F.farms, exp: F.exp }).filter((x) => inRange(x.date, r) && (!batchId || x.batchId === batchId)), [F.batches, F.feed, F.rawBuy, F.boxes, F.trays, F.exp, d.orders, d.txns, rv, batchId]);
  const month = (k) => { const m = {}; rows.forEach((x) => { const a = (m[x.date.slice(0, k)] ||= { k: x.date.slice(0, k), eggs: 0, broken: 0, sold: 0, revenue: 0, expense: 0, deaths: 0, feedKg: 0, feedCost: 0 }); ["eggs", "broken", "sold", "revenue", "expense", "deaths", "feedKg", "feedCost"].forEach((f) => (a[f] += x[f] || 0)); }); return Object.values(m).sort((a, b) => (a.k < b.k ? 1 : -1)); };
  const orders = d.orders.filter((o) => o.status !== "Cancelled" && inRange(o.date, r) && (!batchId || o.batchId === batchId));
  let R = { heads: [], rows: [], chart: null, note: "" };
  if (kind === "daily") R = { heads: ["Date", "Eggs", "Broken", "Trays sold", "Money earned", "Money spent", "Profit", "Birds died", "Feed (kg)"], rows: rows.map((x) => [x.date, nf(x.eggs), nf(x.broken), nf(x.sold / TRAY, 1), inr(x.revenue), inr(x.expense), inr(x.revenue - x.expense), nf(x.deaths), nf(x.feedKg, 1)]) };
  if (kind === "month") { const m = month(7); R = { heads: ["Month", "Money earned", "Money spent", "Profit or loss", "Eggs", "Trays sold"], rows: m.map((x) => [x.k, inr(x.revenue), inr(x.expense), inr(x.revenue - x.expense), nf(x.eggs), nf(x.sold / TRAY, 1)]), chart: { data: m.slice().reverse().map((x) => ({ k: x.k, earned: Math.round(x.revenue), spent: Math.round(x.expense) })), bars: [["earned", "Money earned", COL.green], ["spent", "Money spent", COL.yolk]], money: true } }; }
  if (kind === "eggs") { const m = rows.slice().reverse(); R = { heads: ["Date", "Eggs collected", "Broken", "Good eggs", "Good trays"], rows: rows.map((x) => [x.date, nf(x.eggs), nf(x.broken), nf(x.good), nf(x.good / TRAY, 1)]), chart: { data: m.slice(-45).map((x) => ({ k: x.date.slice(5), good: x.good, broken: x.broken })), bars: [["good", "Good eggs", COL.green], ["broken", "Broken", COL.red]], stack: true } }; }
  if (kind === "sales") { const by = {}; orders.forEach((o) => { const a = (by[o.name] ||= { name: o.name, eggs: 0, amount: 0, owed: 0 }); a.eggs += eggsOf(o); a.amount += +o.total || 0; if (o.payStatus === "Unpaid") a.owed += +o.total || 0; }); const l = Object.values(by).sort((a, b) => b.amount - a.amount); R = { heads: ["Customer", "Trays bought", "Total amount", "Money still to receive"], rows: l.map((x) => [x.name, nf(x.eggs / TRAY, 1), inr(x.amount), inr(x.owed)]), note: batchId ? "Shows sales entered for this batch. Online shop orders are in the overall report." : "" }; }
  if (kind === "exp") { const by = {}; L.filter((x) => x.type === "expense").forEach((x) => (by[x.category] = (by[x.category] || 0) + x.amount)); const tot = sum(Object.values(by), (v) => v); R = { heads: ["What for", "Amount", "Share"], rows: [...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, inr(v), nf((v / (tot || 1)) * 100, 0) + "%"]), ["Total", inr(tot), ""]] }; }
  if (kind === "feed") { const use = {}; F.logs.filter((l) => inRange(l.date, r) && (!batchId || l.batchId === batchId)).forEach((l) => (use[l.feedType] = (use[l.feedType] || 0) + (+l.feedKg || 0))); R = { heads: ["Date", "Feed given (kg)", "Feed cost", "Grams per bird"], rows: rows.map((x) => [x.date, nf(x.feedKg, 1), inr(x.feedCost), x.alive ? nf((x.feedKg * 1000) / x.alive) : "–"]), note: "Feed cost uses your average price per kg, including feed you made yourself. By type: " + (Object.entries(use).map(([k, v]) => `${F.types.find((t) => t.id === k)?.name || k} ${kgText(v)}`).join(", ") || "–") }; }
  if (kind === "mort") { const m = month(7); R = { heads: ["Month", "Birds died"], rows: m.map((x) => [x.k, nf(x.deaths)]), note: `Total mortality so far: ${nf(A.tot.mortPct, 1)}% of ${nf(A.tot.purchased)} birds bought. Value lost: ${inr(A.tot.mortalityValue)}.` }; }
  if (kind === "stock") { const rs = rawStock({ rawBuy: F.rawBuy, mix: F.mix }, batch?.farmId || ""); R = { heads: ["Item", "Available"], rows: [["Eggs", `${nf(A.tot.stockTrays)} trays (${nf(A.tot.stockEggs)} eggs)`], ["Birds alive", nf(A.tot.alive)], ...A.feedTable.map((x) => [`Feed: ${x.name}`, kgText(x.left)]), ...F.raw.map((x) => [`Raw: ${x.name}`, qtyText(rs[x.id] || 0, x.unit)]), ["Empty trays", nf(A.tot.trayEmpty)], ["Empty boxes", nf(A.tot.boxStock)]] }; }
  const name = (batch ? batch.name + "-" : "") + kind;
  return (
    <>
      <div className="chips big">{REPORTS.map(([k, i, l]) => <button key={k} className={k === kind ? "on" : ""} onClick={() => setKind(k)}>{i} {l}</button>)}</div>
      {kind === "charts" ? <Suspense fallback={<p className="muted">Loading…</p>}><Dash orders={d.orders} txns={d.txns} batchId={batchId} /></Suspense> : <>
        <RangeFilter v={rv} set={setRv} />
        <div className="row noprint"><button className="btn sm" onClick={() => download(name, R.heads, R.rows)}>Download for Excel</button><button className="btn sm ghost" onClick={() => window.print()}>Print</button></div>
        {R.chart && <ChartCard title={REPORTS.find((x) => x[0] === kind)[2]}><ComposedChart data={R.chart.data}>{G}<XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={14} /><YAxis tick={{ fontSize: 11 }} width={50} /><Tooltip formatter={R.chart.money ? (v) => inr(v) : undefined} /><Legend />{R.chart.bars.map(([k, l, c]) => <Bar key={k} dataKey={k} name={l} fill={c} stackId={R.chart.stack ? "s" : undefined} />)}</ComposedChart></ChartCard>}
        <section className="card"><h3>{REPORTS.find((x) => x[0] === kind)[2]}{batch ? `, ${batch.name}` : ", all farms"}</h3>{R.note && <p className="muted">{R.note}</p>}
          <div className="scroll"><table><thead><tr>{R.heads.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{R.rows.slice(0, 400).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>{!R.rows.length && <p className="muted">Nothing to show for this period.</p>}</div></section></>}
    </>
  );
}
