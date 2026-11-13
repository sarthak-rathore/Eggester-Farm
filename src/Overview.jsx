import React, { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart } from "recharts";
import { useFarmData, useAnalysis, ledger, TRAY, EXP_CATS } from "./farm.js";
import { inr, today } from "./store.js";
import { COL, ChartCard, Kpi, Alerts, nf, RangeFilter, rangeOf, inRange } from "./charts.jsx";
import { kgText } from "./units.js";
const sum = (a, f) => a.reduce((x, y) => x + (+f(y) || 0), 0);
const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const eggsOf = (o) => (o.items || []).reduce((s, i) => s + i.qty * (i.eggs || TRAY), 0);

export default function Overview({ d }) {
  const F = useFarmData(); const [fid, setFid] = useState(""); const [bid, setBid] = useState(""); const [rv, setRv] = useState({ preset: "month" }); const [cat, setCat] = useState(""); const [prod, setProd] = useState("");
  const A = useAnalysis(d.orders, d.txns, bid, fid); const r = rangeOf(rv), t = A.tot, scoped = !!(fid || bid);
  const years = [...new Set([today().slice(0, 4), ...A.rows.map((x) => x.date.slice(0, 4))])].sort().reverse();
  const rows = A.rows.filter((x) => inRange(x.date, r));
  const ids = new Set(F.batches.filter((b) => (!bid || b.id === bid) && (!fid || b.farmId === fid)).map((b) => b.id));
  const L = ledger({ orders: [], batches: F.batches, feed: F.feed, rawBuy: F.rawBuy, boxes: F.boxes, trays: F.trays, txns: scoped ? [] : d.txns, farms: F.farms, exp: F.exp }).filter((x) => inRange(x.date, r) && x.type !== "revenue" && (!scoped || ids.has(x.batchId)));
  const expAll = sum(L.filter((x) => x.type === "expense"), (x) => x.amount), expShown = sum(L.filter((x) => x.type === "expense" && (!cat || x.category === cat)), (x) => x.amount);
  // sales: from the daily numbers, or exactly by egg type when a product is chosen
  const orders = d.orders.filter((o) => o.status !== "Cancelled" && inRange(o.date, r) && (!scoped || ids.has(o.batchId)));
  const prodSales = prod ? orders.reduce((a, o) => { (o.items || []).filter((i) => i.id === prod).forEach((i) => { a.trays += (i.qty * (i.eggs || TRAY)) / TRAY; a.money += i.qty * i.price; }); return a; }, { trays: 0, money: 0 }) : null;
  const trays = prodSales ? prodSales.trays : sum(rows, (x) => x.sold) / TRAY, money = prodSales ? prodSales.money : sum(rows, (x) => x.revenue);
  const profit = sum(rows, (x) => x.revenue) - (L.length ? expAll : sum(rows, (x) => x.expense)) - sum(rows, (x) => x.manLoss);
  const eggs = sum(rows, (x) => x.eggs), good = sum(rows, (x) => x.good), died = sum(rows, (x) => x.deaths);
  const span = (new Date(r.to === "9999-99-99" ? today() : r.to) - new Date(r.from === "0000-00-00" ? rows[0]?.date || today() : r.from)) / 864e5;
  const key = (x) => (span > 92 ? x.date.slice(0, 7) : x.date.slice(5));
  const series = useMemo(() => { const m = new Map(); rows.slice().reverse().forEach((x) => { const a = m.get(key(x)) || { k: key(x), earned: 0, spent: 0, eggs: 0 }; a.earned += x.revenue; a.spent += x.expense; a.eggs += x.good; m.set(a.k, a); }); return [...m.values()].map((x) => ({ ...x, earned: Math.round(x.earned), spent: Math.round(x.spent) })); }, [A, rv]);
  const pickMonth = (v) => { if (!v) return; const [y, m] = v.split("-"), last = new Date(+y, +m, 0).getDate(); setRv({ preset: "custom", from: `${v}-01`, to: `${v}-${String(last).padStart(2, "0")}`, month: v }); };
  const pickYear = (y) => y && setRv({ preset: "custom", from: `${y}-01-01`, to: `${y}-12-31`, year: y });
  return (
    <>
      <div className="bar"><h2>Overall Farm Overview <small className="hi">पूरे फार्म का हाल</small></h2></div>
      <section className="card form grid2 filters"><h3 className="wide">Show me</h3>
        <label>Farm<select value={fid} onChange={(e) => { setFid(e.target.value); setBid(""); }}><option value="">All farms</option>{F.farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Batch<select value={bid} onChange={(e) => setBid(e.target.value)}><option value="">All batches</option>{F.batches.filter((b) => !fid || b.farmId === fid).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>Year<select value={rv.year || ""} onChange={(e) => pickYear(e.target.value)}><option value="">Choose year</option>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
        <label>Expense type<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All expenses</option>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Egg type sold<select value={prod} onChange={(e) => setProd(e.target.value)}><option value="">All egg types</option>{d.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <div className="wide"><RangeFilter v={rv} set={(v) => setRv(v)} /></div></section>
      {scoped && <p className="muted">Online shop orders are shared by all farms, so they are counted in “All farms” and split by eggs produced in the money numbers.</p>}
      <Alerts list={A.alerts} />
      <div className="kpis big">
        <Kpi l="🥚 Eggs collected" v={nf(eggs)} hint={`${nf(good / TRAY, 1)} good trays`} />
        <Kpi l="💰 Sales" v={inr(money)} t="good" hint={`${nf(trays, 1)} trays sold`} />
        <Kpi l="🧾 Expenses" v={inr(expShown)} hint={cat || "all kinds"} />
        <Kpi l={profit >= 0 ? "✅ Profit" : "⚠️ Loss"} v={inr(Math.abs(profit))} t={profit >= 0 ? "good" : "bad"} hint="after all expenses" />
        <Kpi l="🐔 Birds died" v={nf(died)} t={died ? "bad" : "good"} hint={`${nf(t.mortPct, 1)}% of all birds bought`} />
      </div>
      <h3 className="sh">Stock now</h3>
      <div className="kpis">
        <Kpi l="Eggs ready" v={nf(t.stockTrays) + " trays"} t={t.stockTrays < 20 ? "bad" : "good"} /><Kpi l="Birds alive" v={nf(t.alive)} t="good" /><Kpi l="Feed" v={kgText(t.feedLeft)} /><Kpi l="Empty trays" v={nf(t.trayEmpty)} /><Kpi l="Empty boxes" v={nf(t.boxStock)} /><Kpi l="Money to receive" v={inr(t.owed)} t={t.owed ? "bad" : ""} />
      </div>
      <div className="two">
        <ChartCard title="Money earned and spent"><ComposedChart data={series}>{G}<XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={16} /><YAxis tick={{ fontSize: 11 }} width={50} /><Tooltip formatter={(v) => inr(v)} /><Legend /><Bar dataKey="earned" name="Earned" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="spent" name="Spent" fill={COL.yolk} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
        <ChartCard title="Good eggs"><BarChart data={series}>{G}<XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={16} /><YAxis tick={{ fontSize: 11 }} width={50} /><Tooltip /><Bar dataKey="eggs" name="Good eggs" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      </div>
      {!scoped && <section className="card"><h3>Farm by farm</h3><div className="scroll"><table><thead><tr><th>Farm</th><th>Birds alive</th><th>Died</th><th>Eggs so far</th><th>Feed left</th><th>Last update</th></tr></thead><tbody>{A.farmStats.map((x) => <tr key={x.farm.id}><td><b>{x.farm.name}</b></td><td>{nf(x.alive)}</td><td>{nf(x.died)} ({nf(x.mortPct, 1)}%)</td><td>{nf(x.eggs)}</td><td>{kgText(x.feedLeft)}</td><td>{x.lastLog || "–"}</td></tr>)}</tbody></table></div></section>}
    </>
  );
}
