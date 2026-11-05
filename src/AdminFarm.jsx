import React, { useState } from "react";
import { BarChart, Bar, ComposedChart, Area, AreaChart, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useFarmData, useAnalysis, aggregate, ledger, upsert, TRAY } from "./farm.js";
import { inr, today } from "./store.js";
import Crud from "./Crud.jsx";
import { COL, ChartCard, Kpi, Alerts, nf } from "./charts.jsx";

const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const X = <XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={18} />;
const Y = <YAxis tick={{ fontSize: 11 }} width={46} />;
const newest = (a) => [...a].sort((x, y) => (x.date < y.date ? 1 : -1));

export function Flocks({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot;
  const cmp = A.perBatch.map((x) => ({ name: x.b.name, mortality: Math.round(x.mortPct * 10) / 10, henDay: x.hdp === null ? 0 : Math.round(x.hdp * 10) / 10 }));
  return (
    <>
      <h2>Flocks</h2>
      <div className="kpis"><Kpi l="Chicks bought" v={nf(t.purchased)} /><Kpi l="Alive now" v={nf(t.alive)} t="good" /><Kpi l="Died so far" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}% mortality`} /><Kpi l="Culled or sold" v={nf(t.culled)} /><Kpi l="Value lost to deaths" v={inr(t.mortalityValue)} t="bad" /></div>
      <section className="card"><h3>Batch performance</h3>
        <div className="scroll"><table><thead><tr><th>Flock</th><th>Age</th><th>Bought</th><th>Alive</th><th>Died</th><th>Mortality</th><th>Feed g/bird/day</th><th>Hen-day %</th><th>Eggs so far</th></tr></thead>
          <tbody>{A.perBatch.map(({ b, ...x }) => <tr key={b.id}><td><b>{b.name}</b><br /><small className="muted">{b.status}</small></td><td>{x.weeks} weeks{x.laying ? "" : " (growing)"}</td><td>{nf(b.count)}</td><td>{nf(x.alive)}</td><td>{nf(x.died)}</td><td>{nf(x.mortPct, 1)}%</td><td>{nf(x.gPerBird)}</td><td>{x.hdp === null ? "not laying yet" : nf(x.hdp, 1) + "%"}</td><td>{nf(x.eggs)}</td></tr>)}</tbody></table>
          {!A.perBatch.length && <p className="muted">No flocks yet. Add the first batch of chicks below.</p>}</div></section>
      {!!cmp.length && <ChartCard title="Flock comparison" hint="Mortality % since purchase and hen-day production % in the last 7 days"><BarChart data={cmp}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Legend /><Bar dataKey="mortality" name="Mortality %" fill={COL.red} radius={[4, 4, 0, 0]} /><Bar dataKey="henDay" name="Hen-day %" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>}
      <Crud title="Flock batches (chick purchases)" rows={F.batches} blank={{ date: today(), count: "", chickCost: "", ageDays: 1, status: "Active", breed: "", supplier: "", note: "" }} {...upsert(F.setBatches)}
        fields={[{ k: "name", label: "Flock name (e.g. Batch C)" }, { k: "breed", label: "Breed", req: false }, { k: "date", label: "Purchase date", type: "date" }, { k: "count", label: "Chicks bought", type: "number", fmt: (v) => nf(v) }, { k: "chickCost", label: "Cost per chick (₹)", type: "number", fmt: inr }, { k: "ageDays", label: "Age when bought (days)", type: "number", req: false }, { k: "supplier", label: "Supplier", req: false }, { k: "status", label: "Status", opts: ["Active", "Closed"] }, { k: "note", label: "Note", req: false }]} />
    </>
  );
}

export function DailyLog({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const d = A.rows[A.rows.length - 1] || {};
  const bn = Object.fromEntries(F.batches.map((b) => [b.id, b.name])), tn = Object.fromEntries(F.types.map((x) => [x.id, x.name]));
  const first = F.batches.filter((b) => b.status !== "Closed").slice(-1)[0];
  return (
    <>
      <h2>Daily log</h2>
      <p className="muted">Add one entry per flock each day: feed given, birds that died, eggs collected and broken.</p>
      <div className="kpis"><Kpi l="Today: feed given" v={nf(d.feedKg, 1) + " kg"} /><Kpi l="Today: birds died" v={nf(d.deaths)} t={d.deaths ? "bad" : "good"} /><Kpi l="Today: eggs collected" v={nf(d.eggs)} /><Kpi l="Birds alive" v={nf(d.alive)} /></div>
      <Crud title="Daily entries" rows={newest(F.logs)} blank={{ date: today(), batchId: first?.id || "", feedType: "ft3", feedKg: "", deaths: 0, culled: 0, eggs: 0, broken: 0, note: "" }} {...upsert(F.setLogs)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "batchId", label: "Flock", opts: F.batches.length ? F.batches.map((b) => ({ v: b.id, l: b.name })) : [{ v: "", l: "Add a flock first" }], fmt: (v) => bn[v] || "–" },
          { k: "feedType", label: "Feed type", opts: F.types.map((x) => ({ v: x.id, l: x.name })), fmt: (v) => tn[v] || "–" }, { k: "feedKg", label: "Feed given (kg)", type: "number" }, { k: "deaths", label: "Birds died", type: "number" },
          { k: "culled", label: "Birds culled or sold", type: "number", req: false }, { k: "eggs", label: "Eggs collected", type: "number", req: false }, { k: "broken", label: "Eggs broken", type: "number", req: false }, { k: "note", label: "Note", req: false }]} />
    </>
  );
}

export function Feed({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot; const [sub, setSub] = useState("stock");
  const tn = Object.fromEntries(F.types.map((x) => [x.id, x.name]));
  return (
    <>
      <h2>Feed</h2>
      <div className="chips">{[["stock", "Feed stock"], ["buy", "Purchases"], ["types", "Feed types and nutrition"]].map(([k, l]) => <button key={k} className={k === sub ? "on" : ""} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === "stock" && <>
        <Alerts list={A.alerts.filter((a) => /Feed/.test(a.text))} />
        <div className="kpis"><Kpi l="Feed in stock" v={nf(t.feedLeft) + " kg"} /><Kpi l="Lasts about" v={t.daysLeft === null ? "–" : nf(t.daysLeft, 1) + " days"} t={t.daysLeft !== null && t.daysLeft < 7 ? "bad" : "good"} /><Kpi l="Used per day (7 days)" v={nf(t.avgUse7, 1) + " kg"} /><Kpi l="Average price" v={inr(t.avgFeedPrice) + "/kg"} /><Kpi l="Feed per bird per day" v={nf(t.gPerBird7) + " g"} /></div>
        <ChartCard title="Feed in stock by type" hint="Kilograms left (bought minus used)"><BarChart data={A.feedByType}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Bar dataKey="kg" name="kg left" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <p className="muted">Stock = feed bought minus feed given in the Daily log.</p></>}
      {sub === "buy" && <Crud title="Feed purchases" rows={newest(F.feed)} blank={{ date: today(), feedType: "ft3", kg: "", cost: "", supplier: "" }} {...upsert(F.setFeed)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "feedType", label: "Feed type", opts: F.types.map((x) => ({ v: x.id, l: x.name })), fmt: (v) => tn[v] || "–" }, { k: "kg", label: "Quantity (kg)", type: "number" }, { k: "cost", label: "Total cost (₹)", type: "number", fmt: inr }, { k: "supplier", label: "Supplier", req: false }]} />}
      {sub === "types" && <Crud title="Feed types and nutrition" rows={F.types} blank={{ name: "", protein: 17, energy: 2700 }} {...upsert(F.setTypes)}
        fields={[{ k: "name", label: "Feed name" }, { k: "protein", label: "Protein (%)", type: "number" }, { k: "energy", label: "Energy (kcal per kg)", type: "number" }]} />}
    </>
  );
}

export function Eggs({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot;
  const s = aggregate(A.rows, "day");
  return (
    <>
      <h2>Egg stock</h2>
      <Alerts list={A.alerts.filter((a) => /trays in stock/.test(a.text))} />
      <div className="kpis"><Kpi l="Eggs in stock" v={nf(t.stockEggs)} /><Kpi l="Trays in stock" v={nf(t.stockTrays)} t={t.stockTrays < 20 ? "bad" : "good"} hint={`${TRAY} eggs per tray`} /><Kpi l="Trays produced" v={nf(t.producedTrays)} /><Kpi l="Trays sold" v={nf(t.soldTrays)} hint={`${nf(t.deliveredTrays)} delivered, ${nf(t.pendingTrays)} to deliver`} /><Kpi l="Eggs broken" v={nf(t.broken)} t="bad" hint={`worth about ${inr(t.brokenValue)}`} /></div>
      <ChartCard title="Stock level, last 30 days" hint="Trays in stock at the end of each day"><AreaChart data={s}>{G}{X}{Y}<Tooltip /><Area dataKey="stockTrays" name="Trays in stock" stroke={COL.dark} fill={COL.yolk} fillOpacity={0.4} /></AreaChart></ChartCard>
      <ChartCard title="Produced and sold, last 30 days" hint="Trays per day"><ComposedChart data={s}>{G}{X}{Y}<Tooltip /><Legend /><Bar dataKey="producedTrays" name="Produced" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="soldTrays" name="Sold" fill={COL.blue} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
      <p className="muted">Stock = good eggs from the Daily log, minus eggs in orders, plus the adjustments below. Cancelled orders return their eggs to stock automatically.</p>
      <Crud title="Stock adjustments (eggs lost, gifted or found)" rows={newest(F.adj)} blank={{ date: today(), eggs: "", reason: "" }} {...upsert(F.setAdj)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "eggs", label: "Eggs (use a minus sign to remove)", type: "number" }, { k: "reason", label: "Reason" }]} />
    </>
  );
}

export function Money({ orders, txns, setTxns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot; const [sub, setSub] = useState("manual");
  return (
    <>
      <h2>Money</h2>
      <div className="kpis"><Kpi l="Revenue" v={inr(t.revenue)} hint="delivered orders and other income" /><Kpi l="Expenses" v={inr(t.expense)} hint="chicks, feed and other costs" /><Kpi l="Other losses" v={inr(t.manLoss)} t="bad" /><Kpi l={t.profit >= 0 ? "Profit" : "Net loss"} v={inr(Math.abs(t.profit))} t={t.profit >= 0 ? "good" : "bad"} /></div>
      <div className="chips">{[["manual", "Add other income and costs"], ["ledger", "Full ledger"]].map(([k, l]) => <button key={k} className={k === sub ? "on" : ""} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === "manual" && <><p className="muted">Chick purchases, feed purchases and delivered orders are recorded automatically. Add everything else here: labour, electricity, medicine, repairs, manure sales or other losses.</p>
        <Crud title="Other income, costs and losses" rows={newest(txns)} blank={{ date: today(), type: "expense", category: "", amount: "", note: "" }} {...upsert(setTxns)}
          fields={[{ k: "date", label: "Date", type: "date" }, { k: "type", label: "Type", opts: ["expense", "revenue", "loss"] }, { k: "category", label: "Category (Labour, Electricity, Medicine...)" }, { k: "amount", label: "Amount (₹)", type: "number", fmt: inr }, { k: "note", label: "Note", req: false }]} /></>}
      {sub === "ledger" && <Crud title="Full ledger (automatic and manual)" readOnly rows={ledger({ orders, batches: F.batches, feed: F.feed, txns })}
        fields={[{ k: "date", label: "Date" }, { k: "type", label: "Type" }, { k: "category", label: "Category" }, { k: "amount", label: "Amount", fmt: inr }, { k: "note", label: "Note" }, { k: "source", label: "Recorded from" }]} />}
    </>
  );
}
