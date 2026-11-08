import React, { useState, useMemo } from "react";
import { BarChart, Bar, ComposedChart, Line, Area, AreaChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useFarmData, useAnalysis, aggregate, ledger, upsert, farmSeries, TRAY, EXP_CATS } from "./farm.js";
import { inr, today } from "./store.js";
import Crud from "./Crud.jsx";
import { COL, PIE, ChartCard, Kpi, Alerts, nf, RangeFilter, rangeOf, inRange } from "./charts.jsx";

const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const X = <XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={18} />;
const Y = <YAxis tick={{ fontSize: 11 }} width={50} />;
const newest = (a) => [...a].sort((x, y) => (x.date < y.date ? 1 : -1));
const sum = (a, f) => a.reduce((x, y) => x + (+f(y) || 0), 0);
const farmOpts = (farms) => (farms.length ? farms.map((f) => ({ v: f.id, l: f.name })) : [{ v: "", l: "Add a farm first" }]);
const Chips = ({ list, v, set }) => <div className="chips">{list.map(([k, l]) => <button key={k} className={k === v ? "on" : ""} onClick={() => set(k)}>{l}</button>)}</div>;

/* ---------- Flocks and farms ---------- */
export function Flocks({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot;
  const fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  const cmp = A.perBatch.map((x) => ({ name: x.b.name, mortality: Math.round(x.mortPct * 10) / 10, henDay: x.hdp === null ? 0 : Math.round(x.hdp * 10) / 10 }));
  return (
    <>
      <h2>Farms and flocks</h2>
      <div className="kpis"><Kpi l="Chicks bought" v={nf(t.purchased)} /><Kpi l="Alive now" v={nf(t.alive)} t="good" /><Kpi l="Died so far" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}% mortality`} /><Kpi l="Culled or sold" v={nf(t.culled)} /><Kpi l="Value lost to deaths" v={inr(t.mortalityValue)} t="bad" /></div>
      <section className="card"><h3>Farm by farm</h3>
        <div className="scroll"><table><thead><tr><th>Farm</th><th>Flocks</th><th>Hens bought</th><th>Alive</th><th>Died</th><th>Mortality</th><th>Eggs so far</th><th>Feed left</th><th>Last update</th></tr></thead>
          <tbody>{A.farmStats.map((x) => <tr key={x.farm.id}><td><b>{x.farm.name}</b></td><td>{x.flocks}</td><td>{nf(x.purchased)}</td><td>{nf(x.alive)}</td><td>{nf(x.died)}</td><td>{nf(x.mortPct, 1)}%</td><td>{nf(x.eggs)}</td><td>{nf(x.feedLeft)} kg</td><td>{x.lastLog || "–"}</td></tr>)}</tbody></table></div></section>
      <section className="card"><h3>Batch performance</h3>
        <div className="scroll"><table><thead><tr><th>Flock</th><th>Farm</th><th>Age</th><th>Bought</th><th>Alive</th><th>Died</th><th>Mortality</th><th>Feed g/bird/day</th><th>Hen-day %</th><th>Eggs so far</th></tr></thead>
          <tbody>{A.perBatch.map(({ b, ...x }) => <tr key={b.id}><td><b>{b.name}</b><br /><small className="muted">{b.status}</small></td><td>{fn[b.farmId] || "–"}</td><td>{x.weeks} weeks{x.laying ? "" : " (growing)"}</td><td>{nf(b.count)}</td><td>{nf(x.alive)}</td><td>{nf(x.died)}</td><td>{nf(x.mortPct, 1)}%</td><td>{nf(x.gPerBird)}</td><td>{x.hdp === null ? "not laying yet" : nf(x.hdp, 1) + "%"}</td><td>{nf(x.eggs)}</td></tr>)}</tbody></table>
          {!A.perBatch.length && <p className="muted">No flocks yet. Add the first batch of chicks below.</p>}</div></section>
      {!!cmp.length && <ChartCard title="Flock comparison" hint="Mortality % since purchase and hen-day production % in the last 7 days"><BarChart data={cmp}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Legend /><Bar dataKey="mortality" name="Mortality %" fill={COL.red} radius={[4, 4, 0, 0]} /><Bar dataKey="henDay" name="Hen-day %" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>}
      <Crud title="Your farms" rows={F.farms} blank={{ name: "", location: "" }} {...upsert(F.setFarms)} fields={[{ k: "name", label: "Farm name" }, { k: "location", label: "Location", req: false }]} />
      <Crud title="Flock batches (chick purchases)" rows={F.batches} blank={{ farmId: F.farms[0]?.id || "", date: today(), count: "", chickCost: "", ageDays: 1, status: "Active", breed: "", supplier: "", note: "" }} {...upsert(F.setBatches)}
        fields={[{ k: "name", label: "Flock name (e.g. Batch C)" }, { k: "farmId", label: "Farm", opts: farmOpts(F.farms), fmt: (v) => fn[v] || "–" }, { k: "breed", label: "Breed", req: false }, { k: "date", label: "Purchase date", type: "date" }, { k: "count", label: "Chicks bought", type: "number", fmt: (v) => nf(v) },
          { k: "chickCost", label: "Cost per chick (₹)", type: "number", fmt: inr }, { k: "ageDays", label: "Age when bought (days)", type: "number", req: false }, { k: "supplier", label: "Supplier", req: false }, { k: "status", label: "Status", opts: ["Active", "Closed"] }, { k: "note", label: "Note", req: false }]} />
    </>
  );
}

/* ---------- Daily log (edit any past entry) ---------- */
export function DailyLog({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const d = A.rows[A.rows.length - 1] || {};
  const fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  const bn = Object.fromEntries(F.batches.map((b) => [b.id, `${fn[b.farmId] || "Farm"} · ${b.name}`])), tn = Object.fromEntries(F.types.map((x) => [x.id, x.name]));
  const first = F.batches.filter((b) => b.status !== "Closed")[0];
  return (
    <>
      <h2>Daily log</h2>
      <p className="muted">Use the Today tab to add the day's numbers. Use this table to correct or review older entries.</p>
      <div className="kpis"><Kpi l="Today: feed given" v={nf(d.feedKg, 1) + " kg"} /><Kpi l="Today: birds died" v={nf(d.deaths)} t={d.deaths ? "bad" : "good"} /><Kpi l="Today: eggs collected" v={nf(d.eggs)} /><Kpi l="Birds alive" v={nf(d.alive)} /></div>
      <Crud title="Daily entries" rows={newest(F.logs)} blank={{ date: today(), batchId: first?.id || "", feedType: "ft3", feedKg: "", deaths: 0, culled: 0, eggs: 0, broken: 0, note: "" }} {...upsert(F.setLogs)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "batchId", label: "Farm and flock", opts: F.batches.length ? F.batches.map((b) => ({ v: b.id, l: bn[b.id] })) : [{ v: "", l: "Add a flock first" }], fmt: (v) => bn[v] || "–" },
          { k: "feedType", label: "Feed type", opts: F.types.map((x) => ({ v: x.id, l: x.name })), fmt: (v) => tn[v] || "–" }, { k: "feedKg", label: "Feed given (kg)", type: "number" }, { k: "deaths", label: "Birds died", type: "number" },
          { k: "culled", label: "Birds culled or sold", type: "number", req: false }, { k: "eggs", label: "Eggs collected", type: "number", req: false }, { k: "broken", label: "Eggs broken", type: "number", req: false }, { k: "note", label: "Note", req: false }]} />
    </>
  );
}

/* ---------- Feed ---------- */
export function Feed({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot; const [sub, setSub] = useState("stock");
  const tn = Object.fromEntries(F.types.map((x) => [x.id, x.name])), fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  return (
    <>
      <h2>Feed</h2>
      <Chips list={[["stock", "Feed stock"], ["buy", "Purchases"], ["types", "Feed types and nutrition"]]} v={sub} set={setSub} />
      {sub === "stock" && <>
        <Alerts list={A.alerts.filter((a) => /Feed/.test(a.text))} />
        <div className="kpis"><Kpi l="Feed in stock" v={nf(t.feedLeft) + " kg"} /><Kpi l="Lasts about" v={t.daysLeft === null ? "–" : nf(t.daysLeft, 1) + " days"} t={t.daysLeft !== null && t.daysLeft < 7 ? "bad" : "good"} /><Kpi l="Used per day (7 days)" v={nf(t.avgUse7, 1) + " kg"} /><Kpi l="Average price" v={inr(t.avgFeedPrice) + "/kg"} /><Kpi l="Feed per bird per day" v={nf(t.gPerBird7) + " g"} /></div>
        <section className="card"><h3>Feed by farm</h3><div className="scroll"><table><thead><tr><th>Farm</th><th>Feed given so far</th><th>Feed left</th></tr></thead><tbody>{A.farmStats.map((x) => <tr key={x.farm.id}><td>{x.farm.name}</td><td>{nf(x.feedKg)} kg</td><td><b>{nf(x.feedLeft)} kg</b></td></tr>)}</tbody></table></div></section>
        <ChartCard title="Feed in stock by type" hint="Kilograms left (bought minus used)"><BarChart data={A.feedByType}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Bar dataKey="kg" name="kg left" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <p className="muted">Stock = feed bought for each farm minus feed given in the daily log.</p></>}
      {sub === "buy" && <Crud title="Feed purchases" rows={newest(F.feed)} blank={{ date: today(), farmId: F.farms[0]?.id || "", feedType: "ft3", kg: "", cost: "", supplier: "" }} {...upsert(F.setFeed)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "farmId", label: "Farm", opts: farmOpts(F.farms), fmt: (v) => fn[v] || "–" }, { k: "feedType", label: "Feed type", opts: F.types.map((x) => ({ v: x.id, l: x.name })), fmt: (v) => tn[v] || "–" }, { k: "kg", label: "Quantity (kg)", type: "number" }, { k: "cost", label: "Total cost (₹)", type: "number", fmt: inr }, { k: "supplier", label: "Supplier", req: false }]} />}
      {sub === "types" && <Crud title="Feed types and nutrition" rows={F.types} blank={{ name: "", protein: 17, energy: 2700 }} {...upsert(F.setTypes)}
        fields={[{ k: "name", label: "Feed name" }, { k: "protein", label: "Protein (%)", type: "number" }, { k: "energy", label: "Energy (kcal per kg)", type: "number" }]} />}
    </>
  );
}

/* ---------- Stock: eggs and trays, hens, boxes ---------- */
export function Stock({ orders, txns }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns); const t = A.tot; const [sub, setSub] = useState("overview");
  const D = useMemo(() => ({ ...F, orders, txns }), [F.farms, F.batches, F.logs, F.feed, F.types, F.adj, F.exp, F.boxes, F.boxAdj, F.boxCfg, orders, txns]);
  const hens = useMemo(() => farmSeries(D, "alive"), [D]), eggs = useMemo(() => farmSeries(D, "eggs"), [D]);
  const day = aggregate(A.rows, "day");
  const fl = F.farms.map((f, i) => PIE[i % PIE.length]);
  const hensChart = (title, hint) => <ChartCard title={title} hint={hint}><AreaChart data={hens.data}>{G}{X}{Y}<Tooltip /><Legend />{hens.names.map((n, i) => <Area key={n} dataKey={n} stackId="h" stroke={fl[i]} fill={fl[i]} fillOpacity={0.5} />)}</AreaChart></ChartCard>;
  return (
    <>
      <h2>Stock</h2>
      <Chips list={[["overview", "Overview"], ["eggs", "Eggs and trays"], ["hens", "Hens"], ["boxes", "Boxes"]]} v={sub} set={setSub} />
      <Alerts list={A.alerts.filter((a) => /trays in stock|boxes left|Feed/.test(a.text))} />
      <div className="kpis"><Kpi l="Eggs in stock" v={nf(t.stockEggs)} /><Kpi l="Trays in stock" v={nf(t.stockTrays)} t={t.stockTrays < 20 ? "bad" : "good"} hint={`${TRAY} eggs per tray`} /><Kpi l="Hens alive" v={nf(t.alive)} t="good" /><Kpi l="Boxes in stock" v={nf(t.boxStock)} t={t.boxStock < (F.boxCfg.alert || 20) ? "bad" : "good"} hint={`${t.perBox} trays per box`} /><Kpi l="Feed in stock" v={nf(t.feedLeft) + " kg"} /></div>

      {sub === "overview" && <>
        <section className="card"><h3>Stock by farm</h3><div className="scroll"><table><thead><tr><th>Farm</th><th>Hens alive</th><th>Eggs collected today</th><th>Trays produced so far</th><th>Feed left</th><th>Last update</th></tr></thead>
          <tbody>{A.farmStats.map((x) => <tr key={x.farm.id}><td><b>{x.farm.name}</b></td><td>{nf(x.alive)}</td><td>{nf(x.eggsToday)}</td><td>{nf(x.trays)}</td><td>{nf(x.feedLeft)} kg</td><td>{x.lastLog || "–"}</td></tr>)}</tbody></table></div></section>
        <div className="two">
          {hensChart("Hens alive by farm", "Stacked, last 30 days")}
          <ChartCard title="Eggs collected by farm" hint="Eggs per day, last 30 days"><BarChart data={eggs.data}>{G}{X}{Y}<Tooltip /><Legend />{eggs.names.map((n, i) => <Bar key={n} dataKey={n} stackId="e" fill={fl[i]} />)}</BarChart></ChartCard>
          <ChartCard title="Trays in stock" hint="At the end of each day"><AreaChart data={day}>{G}{X}{Y}<Tooltip /><Area dataKey="stockTrays" name="Trays" stroke={COL.dark} fill={COL.yolk} fillOpacity={0.4} /></AreaChart></ChartCard>
          <ChartCard title="Boxes in stock" hint="At the end of each day"><AreaChart data={day}>{G}{X}{Y}<Tooltip /><Area dataKey="boxStock" name="Boxes" stroke={COL.dark} fill={COL.blue} fillOpacity={0.3} /></AreaChart></ChartCard>
        </div></>}

      {sub === "eggs" && <>
        <div className="kpis"><Kpi l="Trays produced" v={nf(t.producedTrays)} /><Kpi l="Trays sold" v={nf(t.soldTrays)} hint={`${nf(t.deliveredTrays)} delivered, ${nf(t.pendingTrays)} to deliver`} /><Kpi l="Eggs broken" v={nf(t.broken)} t="bad" hint={`worth about ${inr(t.brokenValue)}`} /></div>
        <ChartCard title="Stock level, last 30 days" hint="Trays in stock at the end of each day"><AreaChart data={day}>{G}{X}{Y}<Tooltip /><Area dataKey="stockTrays" name="Trays in stock" stroke={COL.dark} fill={COL.yolk} fillOpacity={0.4} /></AreaChart></ChartCard>
        <ChartCard title="Produced and sold, last 30 days" hint="Trays per day"><ComposedChart data={day}>{G}{X}{Y}<Tooltip /><Legend /><Bar dataKey="producedTrays" name="Produced" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="soldTrays" name="Sold" fill={COL.blue} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
        <p className="muted">Stock = good eggs from the daily entries, minus eggs in orders, plus the adjustments below. Cancelled orders return their eggs to stock automatically.</p>
        <Crud title="Egg adjustments (eggs lost, gifted or found)" rows={newest(F.adj)} blank={{ date: today(), eggs: "", reason: "" }} {...upsert(F.setAdj)}
          fields={[{ k: "date", label: "Date", type: "date" }, { k: "eggs", label: "Eggs (use a minus sign to remove)", type: "number" }, { k: "reason", label: "Reason" }]} /></>}

      {sub === "hens" && <>
        <div className="kpis"><Kpi l="Chicks bought" v={nf(t.purchased)} /><Kpi l="Died so far" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}%`} /><Kpi l="Culled or sold" v={nf(t.culled)} /><Kpi l="Value lost to deaths" v={inr(t.mortalityValue)} t="bad" /></div>
        {hensChart("Hens alive by farm", "Stacked, last 30 days")}
        <ChartCard title="Deaths per day" hint="All farms, last 30 days"><BarChart data={day}>{G}{X}{Y}<Tooltip /><Bar dataKey="deaths" name="Died" fill={COL.red} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <section className="card"><h3>Hens by farm and flock</h3><div className="scroll"><table><thead><tr><th>Farm</th><th>Flock</th><th>Bought</th><th>Died</th><th>Culled or sold</th><th>Alive now</th></tr></thead>
          <tbody>{A.perBatch.map(({ b, ...x }) => <tr key={b.id}><td>{A.farms.find((f) => f.id === b.farmId)?.name || "–"}</td><td>{b.name}</td><td>{nf(b.count)}</td><td>{nf(x.died)}</td><td>{nf(x.culled)}</td><td><b>{nf(x.alive)}</b></td></tr>)}</tbody></table></div>
          <p className="muted">Hens move automatically from the daily entries: deaths, and birds culled or sold. Add a new batch of chicks under Flocks.</p></section></>}

      {sub === "boxes" && <>
        <div className="kpis"><Kpi l="Boxes bought" v={nf(t.boxBought)} /><Kpi l="Used for orders" v={nf(t.boxUsed)} hint={`${t.perBox} trays per box, worked out from orders`} /><Kpi l="Damaged or lost" v={nf(t.boxLost)} t={t.boxLost ? "bad" : ""} /><Kpi l="In stock" v={nf(t.boxStock)} t={t.boxStock < (F.boxCfg.alert || 20) ? "bad" : "good"} /></div>
        <section className="card form grid2"><h3 className="wide">Box settings</h3>
          <label>Trays that fit in one box<input type="number" min="1" value={F.boxCfg.perBox} onChange={(e) => F.setBoxCfg({ ...F.boxCfg, perBox: +e.target.value || 1 })} /></label>
          <label>Warn me when boxes fall below<input type="number" min="0" value={F.boxCfg.alert} onChange={(e) => F.setBoxCfg({ ...F.boxCfg, alert: +e.target.value || 0 })} /></label></section>
        <ChartCard title="Boxes in stock and used" hint="Last 30 days"><ComposedChart data={day}>{G}{X}{Y}<Tooltip /><Legend /><Area dataKey="boxStock" name="In stock" stroke={COL.dark} fill={COL.blue} fillOpacity={0.25} /><Bar dataKey="boxUsed" name="Used for orders" fill={COL.orange} radius={[4, 4, 0, 0]} /><Bar dataKey="boxBought" name="Bought" fill={COL.green} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
        <Crud title="Box purchases" rows={newest(F.boxes)} blank={{ date: today(), qty: "", cost: "", supplier: "" }} {...upsert(F.setBoxes)} fields={[{ k: "date", label: "Date", type: "date" }, { k: "qty", label: "Boxes bought", type: "number" }, { k: "cost", label: "Total cost (₹)", type: "number", fmt: inr }, { k: "supplier", label: "Supplier", req: false }]} />
        <Crud title="Box adjustments (damaged, lost or extra used)" rows={newest(F.boxAdj)} blank={{ date: today(), qty: "", reason: "" }} {...upsert(F.setBoxAdj)} fields={[{ k: "date", label: "Date", type: "date" }, { k: "qty", label: "Boxes (use a minus sign to remove)", type: "number" }, { k: "reason", label: "Reason" }]} /></>}
    </>
  );
}

/* ---------- Expenses (day-wise, with filters) ---------- */
export function Expenses({ orders, txns }) {
  const F = useFarmData(); const [rv, setRv] = useState({ preset: "month" }); const [farm, setFarm] = useState(""); const [cat, setCat] = useState(""); const [view, setView] = useState("days");
  const r = rangeOf(rv), fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  const rows = F.exp.filter((e) => inRange(e.date, r) && (!farm || e.farmId === farm) && (!cat || e.category === cat));
  const total = sum(rows, (e) => e.amount), dates = [...new Set(rows.map((e) => e.date))].sort();
  const byCat = {}; rows.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + +e.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const pie = Object.entries(byCat).map(([name, value]) => ({ name, value: Math.round(value) }));
  const byFarm = [...F.farms.map((f) => ({ name: f.name, amount: sum(rows.filter((e) => e.farmId === f.id), (e) => e.amount) })), { name: "All farms (shared)", amount: sum(rows.filter((e) => e.farmId === "all"), (e) => e.amount) }].filter((x) => x.amount);
  const span = (new Date(r.to === "9999-99-99" ? today() : r.to) - new Date(r.from === "0000-00-00" ? dates[0] || today() : r.from)) / 864e5;
  const key = (d) => (span > 62 ? d.slice(0, 7) : d); const g = {}; rows.forEach((e) => { const k = key(e.date); g[k] = (g[k] || 0) + +e.amount; });
  const series = Object.entries(g).sort().map(([k, amount]) => ({ k, amount: Math.round(amount) }));
  const auto = { Chicks: sum(F.batches.filter((b) => inRange(b.date, r) && (!farm || b.farmId === farm)), (b) => (+b.count || 0) * (+b.chickCost || 0)), Feed: sum(F.feed.filter((x) => inRange(x.date, r) && (!farm || x.farmId === farm)), (x) => x.cost), Boxes: farm ? 0 : sum(F.boxes.filter((x) => inRange(x.date, r)), (x) => x.cost) };
  const dayRows = dates.slice().reverse().map((d) => { const day = rows.filter((e) => e.date === d); return { d, total: sum(day, (e) => e.amount), n: day.length, per: Object.fromEntries([...F.farms.map((f) => [f.id, sum(day.filter((e) => e.farmId === f.id), (e) => e.amount)]), ["all", sum(day.filter((e) => e.farmId === "all"), (e) => e.amount)]]) }; });
  return (
    <>
      <h2>Expenses</h2>
      <p className="muted">Enter each day's costs here, or from the Today tab. Everything flows into the dashboard and Money automatically.</p>
      <RangeFilter v={rv} set={setRv} />
      <div className="row filt"><label className="inl">Farm<select value={farm} onChange={(e) => setFarm(e.target.value)}><option value="">All farms</option>{F.farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}<option value="all">Shared costs only</option></select></label>
        <label className="inl">Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div className="kpis"><Kpi l="Total expenses" v={inr(total)} t="bad" /><Kpi l="Days with entries" v={dates.length} /><Kpi l="Average per day" v={dates.length ? inr(total / dates.length) : "–"} /><Kpi l="Biggest category" v={top ? top[0] : "–"} hint={top ? inr(top[1]) : ""} /><Kpi l="Entries" v={rows.length} /></div>
      <div className="two">
        <ChartCard title="Expenses over time" hint={span > 62 ? "Per month" : "Per day"}><BarChart data={series}>{G}{X}{Y}<Tooltip formatter={(v) => inr(v)} /><Bar dataKey="amount" name="Expenses" fill={COL.yolk} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <ChartCard title="By category">{pie.length ? <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v) => inr(v)} /><Legend /></PieChart> : <div />}</ChartCard>
      </div>
      {!!byFarm.length && <ChartCard title="By farm" h={220}><BarChart data={byFarm}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip formatter={(v) => inr(v)} /><Bar dataKey="amount" name="Expenses" fill={COL.red} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>}
      <section className="card"><h3>Also recorded automatically in this period</h3><p className="muted">Chicks {inr(auto.Chicks)} · Feed purchases {inr(auto.Feed)} · Boxes {inr(auto.Boxes)}. These come from Flocks, Feed and Stock, so enter them there, not here.</p></section>
      <Chips list={[["days", "Day-wise summary"], ["entries", "All entries"]]} v={view} set={setView} />
      {view === "days" && <section className="card"><h3>Day-wise summary</h3><div className="scroll"><table><thead><tr><th>Date</th>{F.farms.map((f) => <th key={f.id}>{f.name}</th>)}<th>Shared</th><th>Total</th><th>Entries</th></tr></thead>
        <tbody>{dayRows.map((x) => <tr key={x.d}><td>{x.d}</td>{F.farms.map((f) => <td key={f.id}>{x.per[f.id] ? inr(x.per[f.id]) : "–"}</td>)}<td>{x.per.all ? inr(x.per.all) : "–"}</td><td><b>{inr(x.total)}</b></td><td>{x.n}</td></tr>)}</tbody></table>
        {!dayRows.length && <p className="muted">No expenses in this period.</p>}</div></section>}
      {view === "entries" && <Crud title="Expense entries" rows={newest(rows)} blank={{ date: today(), farmId: F.farms[0]?.id || "all", category: "Labour", amount: "", note: "" }}
        onSave={upsert(F.setExp).onSave} onDelete={upsert(F.setExp).onDelete}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "farmId", label: "Farm", opts: [{ v: "all", l: "All farms (shared)" }, ...F.farms.map((f) => ({ v: f.id, l: f.name }))], fmt: (v) => (v === "all" ? "All farms" : fn[v] || "–") }, { k: "category", label: "Category", opts: EXP_CATS }, { k: "amount", label: "Amount (₹)", type: "number", fmt: inr }, { k: "note", label: "Note", req: false }]} />}
    </>
  );
}

/* ---------- Money (with period filter) ---------- */
export function Money({ orders, txns, setTxns }) {
  const F = useFarmData(); const [rv, setRv] = useState({ preset: "month" }); const [sub, setSub] = useState("ledger");
  const r = rangeOf(rv);
  const all = ledger({ orders, batches: F.batches, feed: F.feed, txns, farms: F.farms, boxes: F.boxes, exp: F.exp });
  const rows = all.filter((x) => inRange(x.date, r));
  const tp = (ty) => sum(rows.filter((x) => x.type === ty), (x) => x.amount);
  const rev = tp("revenue"), ex = tp("expense"), loss = tp("loss"), profit = rev - ex - loss;
  const dates = rows.map((x) => x.date).sort(), span = dates.length ? (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 864e5 : 0;
  const g = {}; rows.forEach((x) => { const k = span > 62 ? x.date.slice(0, 7) : x.date; (g[k] = g[k] || { k, revenue: 0, expense: 0, loss: 0 })[x.type] += +x.amount; });
  const series = Object.values(g).sort((a, b) => (a.k < b.k ? -1 : 1)).map((x) => ({ ...x, profit: x.revenue - x.expense - x.loss }));
  const cats = {}; rows.filter((x) => x.type === "expense").forEach((x) => { cats[x.category] = (cats[x.category] || 0) + +x.amount; });
  const pie = Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value) }));
  return (
    <>
      <h2>Money</h2>
      <RangeFilter v={rv} set={setRv} />
      <div className="kpis"><Kpi l="Revenue" v={inr(rev)} hint="delivered orders and other income" /><Kpi l="Expenses" v={inr(ex)} hint="chicks, feed, boxes and daily costs" /><Kpi l="Other losses" v={inr(loss)} t="bad" /><Kpi l={profit >= 0 ? "Profit" : "Net loss"} v={inr(Math.abs(profit))} t={profit >= 0 ? "good" : "bad"} /></div>
      <div className="two">
        <ChartCard title="Revenue, expenses and profit" hint={span > 62 ? "Per month" : "Per day"}><ComposedChart data={series}>{G}{X}{Y}<Tooltip formatter={(v) => inr(v)} /><Legend /><Bar dataKey="revenue" name="Revenue" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="expense" name="Expenses" fill={COL.yolk} radius={[4, 4, 0, 0]} /><Line dataKey="profit" name="Profit" stroke={COL.dark} strokeWidth={3} dot={false} /></ComposedChart></ChartCard>
        <ChartCard title="Where the money went" hint="Expenses in this period">{pie.length ? <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v) => inr(v)} /><Legend /></PieChart> : <div />}</ChartCard>
      </div>
      <Chips list={[["ledger", "Full ledger"], ["manual", "Other income and losses"]]} v={sub} set={setSub} />
      {sub === "ledger" && <Crud title="Full ledger (automatic and manual)" readOnly rows={rows} fields={[{ k: "date", label: "Date" }, { k: "type", label: "Type" }, { k: "category", label: "Category" }, { k: "amount", label: "Amount", fmt: inr }, { k: "farm", label: "Farm" }, { k: "note", label: "Note" }, { k: "source", label: "Recorded from" }]} />}
      {sub === "manual" && <><p className="muted">Daily costs go in the Expenses tab. Use this for other income (such as manure sales) and for losses (such as spoiled stock).</p>
        <Crud title="Other income and losses" rows={newest(txns.filter((t) => inRange(t.date, r)))} blank={{ date: today(), type: "revenue", category: "", amount: "", note: "" }} {...upsert(setTxns)}
          fields={[{ k: "date", label: "Date", type: "date" }, { k: "type", label: "Type", opts: ["revenue", "loss", "expense"] }, { k: "category", label: "Category (Manure sale, Spoilage...)" }, { k: "amount", label: "Amount (₹)", type: "number", fmt: inr }, { k: "note", label: "Note", req: false }]} /></>}
    </>
  );
}
