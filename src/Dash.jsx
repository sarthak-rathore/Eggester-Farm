import React, { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, Area, AreaChart, LineChart, PieChart, Pie, Cell, BarChart, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { useAnalysis, aggregate, TRAY } from "./farm.js";
import { inr } from "./store.js";
import { COL, PIE, ChartCard, Kpi, Alerts, nf } from "./charts.jsx";

const X = <XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={18} />;
const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const Y = <YAxis tick={{ fontSize: 11 }} width={46} />;
const YR = <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} width={46} />;
const money = { formatter: (v) => inr(v) };

export default function Dash({ orders, txns, batchId = "", farmId = "" }) {
  const [p, setP] = useState("day"); const [bid, setBid] = useState(batchId); const [fid, setFid] = useState(farmId);
  const A = useAnalysis(orders, txns, bid, fid);
  const s = useMemo(() => aggregate(A.rows, p), [A, p]);
  const sm = (k) => s.reduce((a, r) => a + (r[k] || 0), 0);
  const t = A.tot, label = p === "day" ? "last 30 days" : p === "month" ? "last 12 months" : "all years";
  const trP = sm("produced") / TRAY, trS = sm("sold") / TRAY, profit = sm("revenue") - sm("expense") - sm("manLoss");
  const pie = Object.entries(A.expBreak).map(([name, value]) => ({ name, value: Math.round(value) }));
  const stat = Object.entries(A.statusCount).map(([name, value]) => ({ name, value }));
  const buyers = Object.entries(A.buyers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, trays]) => ({ name, trays: Math.round(trays) }));
  const cmp = A.perBatch.filter((x) => !fid || x.b.farmId === fid).map((x) => ({ name: x.b.name, mortality: Math.round(x.mortPct * 10) / 10, henDay: x.hdp === null ? 0 : Math.round(x.hdp * 10) / 10 }));
  const noData = !A.batches.length;
  return (
    <>
      <div className="bar"><h3>All graphs, {label}</h3>
        <div className="row">
          <select aria-label="Farm" value={fid} onChange={(e) => { setFid(e.target.value); setBid(""); }} style={{ width: "auto" }}><option value="">All farms</option>{A.farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <select aria-label="Flock" value={bid} onChange={(e) => setBid(e.target.value)} style={{ width: "auto" }}><option value="">All flocks</option>{A.batches.filter((b) => !fid || b.farmId === fid).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <div className="seg">{["day", "month", "year"].map((x) => <button key={x} className={x === p ? "on" : ""} onClick={() => setP(x)}>{x === "day" ? "Day wise" : x === "month" ? "Month wise" : "Year wise"}</button>)}</div>
        </div></div>
      <Alerts list={A.alerts} />
      {fid && <p className="muted">Showing {A.farms.find((f) => f.id === fid)?.name}. Costs and production are for this farm only. Sales are shared by all farms, so revenue and profit here are this farm's share of eggs produced. Stock is for all farms.</p>}
      {noData && <p className="muted">Add your first flock under Flocks and start the daily log. Charts fill in as you record.</p>}

      <h3 className="sh">Flock</h3>
      <div className="kpis">
        <Kpi l="Chicks bought" v={nf(t.purchased)} /><Kpi l="Birds alive now" v={nf(t.alive)} t="good" /><Kpi l="Birds died" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}% of bought`} /><Kpi l="Culled or sold" v={nf(t.culled)} /><Kpi l="Value lost to deaths" v={inr(t.mortalityValue)} t="bad" />
      </div>
      <div className="two">
        <ChartCard title="Birds alive" hint="Total hens and growing chicks over time"><AreaChart data={s}>{G}{X}{Y}<Tooltip /><Area dataKey="alive" name="Birds alive" stroke={COL.dark} fill={COL.green} fillOpacity={0.35} /></AreaChart></ChartCard>
        <ChartCard title="Deaths and mortality" hint="Birds lost per period, and total mortality % since purchase"><ComposedChart data={s}>{G}{X}{Y}{YR}<Tooltip /><Legend /><Bar dataKey="deaths" name="Died" fill={COL.red} radius={[4, 4, 0, 0]} /><Bar dataKey="culled" name="Culled" fill={COL.orange} radius={[4, 4, 0, 0]} /><Line yAxisId="r" dataKey="mortPct" name="Mortality %" stroke={COL.dark} strokeWidth={2} dot={false} /></ComposedChart></ChartCard>
      </div>

      <h3 className="sh">Feed and nutrition</h3>
      <div className="kpis">
        <Kpi l="Feed used" v={nf(sm("feedKg")) + " kg"} /><Kpi l="Feed per bird per day" v={nf(t.gPerBird7) + " g"} hint="last 7 days; layers need about 110 to 120 g" /><Kpi l="Protein per bird per day" v={nf(t.protein7, 1) + " g"} hint="layers need about 17 to 19 g" /><Kpi l="Energy per bird per day" v={nf(t.energy7) + " kcal"} hint="layers need about 290 to 320" /><Kpi l="Feed in stock" v={nf(t.feedLeft) + " kg"} /><Kpi l="Feed lasts about" v={t.daysLeft === null ? "–" : nf(t.daysLeft, 1) + " days"} t={t.daysLeft !== null && t.daysLeft < 7 ? "bad" : "good"} />
      </div>
      <div className="two">
        <ChartCard title="Feed given" hint="Kilograms per period, and grams per bird per day"><ComposedChart data={s}>{G}{X}{Y}{YR}<Tooltip /><Legend /><Bar dataKey="feedKg" name="Feed (kg)" fill={COL.yolk} radius={[4, 4, 0, 0]} /><Line yAxisId="r" dataKey="gPerBird" name="g per bird per day" stroke={COL.dark} strokeWidth={2} dot={false} connectNulls /><ReferenceLine yAxisId="r" y={115} stroke={COL.green} strokeDasharray="5 4" label={{ value: "Layer target 115 g", fontSize: 10, fill: COL.green, position: "insideTopRight" }} /></ComposedChart></ChartCard>
        <ChartCard title="Nutrition per bird per day" hint="Protein in grams (left), energy in kcal (right)"><LineChart data={s}>{G}{X}{Y}{YR}<Tooltip /><Legend /><Line dataKey="proteinG" name="Protein (g)" stroke={COL.blue} strokeWidth={2} dot={false} connectNulls /><Line yAxisId="r" dataKey="energyKcal" name="Energy (kcal)" stroke={COL.orange} strokeWidth={2} dot={false} connectNulls /></LineChart></ChartCard>
        <ChartCard title="Feed efficiency" hint="Kilograms of feed needed per dozen eggs (lower is better)"><LineChart data={s}>{G}{X}{Y}<Tooltip /><Line dataKey="fcr" name="kg feed per dozen" stroke={COL.dark} strokeWidth={2} dot={false} connectNulls /></LineChart></ChartCard>
        <ChartCard title="Feed in stock by type" hint="Kilograms left"><BarChart data={A.feedByType}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Bar dataKey="kg" name="kg left" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      </div>

      <h3 className="sh">Eggs and stock</h3>
      <div className="kpis">
        <Kpi l="Eggs collected" v={nf(sm("eggs"))} /><Kpi l="Hen-day production" v={t.hdp7 === null ? "–" : nf(t.hdp7, 1) + "%"} hint="last 7 days, laying hens only" t={t.hdp7 !== null && t.hdp7 < 70 ? "bad" : "good"} /><Kpi l="Trays produced" v={nf(trP)} /><Kpi l="Trays sold" v={nf(trS)} /><Kpi l="Trays in stock now" v={nf(t.stockTrays)} t={t.stockTrays < 20 ? "bad" : "good"} /><Kpi l="Boxes in stock" v={nf(t.boxStock)} t={t.boxStock < 20 ? "bad" : "good"} /><Kpi l="Eggs broken" v={nf(sm("eggs") ? (sm("broken") / sm("eggs")) * 100 : 0, 1) + "%"} />
      </div>
      <div className="two">
        <ChartCard title="Egg production" hint="Good and broken eggs (bars), hen-day production % (line)"><ComposedChart data={s}>{G}{X}{Y}{YR}<Tooltip /><Legend /><Bar dataKey="good" name="Good eggs" stackId="e" fill={COL.green} /><Bar dataKey="broken" name="Broken" stackId="e" fill={COL.red} radius={[4, 4, 0, 0]} /><Line yAxisId="r" dataKey="hdp" name="Hen-day %" stroke={COL.dark} strokeWidth={2} dot={false} connectNulls /></ComposedChart></ChartCard>
        <ChartCard title="Trays produced, sold and in stock" hint="Stock level at the end of each period"><ComposedChart data={s}>{G}{X}{Y}<Tooltip /><Legend /><Area dataKey="stockTrays" name="In stock" stroke={COL.dark} fill={COL.yolk} fillOpacity={0.35} /><Bar dataKey="producedTrays" name="Produced" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="soldTrays" name="Sold" fill={COL.blue} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
      </div>

      <h3 className="sh">Money</h3>
      <div className="kpis">
        <Kpi l="Revenue" v={inr(sm("revenue"))} /><Kpi l="Expenses" v={inr(sm("expense"))} /><Kpi l={profit >= 0 ? "Profit" : "Net loss"} v={inr(Math.abs(profit))} t={profit >= 0 ? "good" : "bad"} /><Kpi l="Running cost per tray" v={trP ? inr(sm("opCost") / trP) : "–"} hint="feed used plus labour, power and other costs" /><Kpi l="Profit per tray sold" v={trS ? inr(profit / trS) : "–"} />
      </div>
      <div className="two">
        <ChartCard title="Revenue, expenses and profit"><ComposedChart data={s}>{G}{X}{Y}<Tooltip {...money} /><Legend /><Bar dataKey="revenue" name="Revenue" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="expense" name="Expenses" fill={COL.yolk} radius={[4, 4, 0, 0]} /><Line dataKey="profit" name="Profit" stroke={COL.dark} strokeWidth={3} dot={false} /></ComposedChart></ChartCard>
        <ChartCard title="Cost per tray" hint="What it costs to produce one tray"><LineChart data={s}>{G}{X}{Y}<Tooltip {...money} /><Legend /><Line dataKey="costPerTray" name="Running cost per tray" stroke={COL.red} strokeWidth={2} dot={false} connectNulls /><Line dataKey="feedCostPerTray" name="Feed cost per tray" stroke={COL.yolk} strokeWidth={2} dot={false} connectNulls /></LineChart></ChartCard>
        <ChartCard title="Where the money goes" hint="All expenses so far">{pie.length ? <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip {...money} /><Legend /></PieChart> : <div />}</ChartCard>
        <ChartCard title="Flock comparison" hint="Mortality % and hen-day % per batch"><BarChart data={cmp}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Legend /><Bar dataKey="mortality" name="Mortality %" fill={COL.red} radius={[4, 4, 0, 0]} /><Bar dataKey="henDay" name="Hen-day % (7 days)" fill={COL.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      </div>

      <h3 className="sh">Farms</h3>
      <div className="two">
        <ChartCard title="Hens alive by farm"><BarChart data={A.farmStats.map((x) => ({ name: x.farm.name, alive: x.alive, died: x.died }))}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip /><Legend /><Bar dataKey="alive" name="Alive" fill={COL.green} radius={[4, 4, 0, 0]} /><Bar dataKey="died" name="Died" fill={COL.red} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <ChartCard title="Spending by farm" hint="Chicks, feed and daily costs so far"><BarChart data={A.farmStats.map((x) => ({ name: x.farm.name, expense: Math.round(x.expense) }))}>{G}<XAxis dataKey="name" tick={{ fontSize: 11 }} />{Y}<Tooltip {...money} /><Bar dataKey="expense" name="Spent" fill={COL.yolk} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      </div>

      <h3 className="sh">Orders and buyers</h3>
      <div className="two">
        <ChartCard title="Orders by status">{stat.length ? <PieChart><Pie data={stat} dataKey="value" nameKey="name" outerRadius={90} label>{stat.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart> : <div />}</ChartCard>
        <ChartCard title="Top buyers" hint="Trays ordered, all time"><BarChart data={buyers} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} /><Tooltip /><Bar dataKey="trays" name="Trays" fill={COL.blue} radius={[0, 4, 4, 0]} /></BarChart></ChartCard>
      </div>
    </>
  );
}
