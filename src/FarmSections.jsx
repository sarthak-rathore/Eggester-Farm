import React, { useState, useMemo } from "react";
import { BarChart, Bar, ComposedChart, Line, Area, AreaChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useFarmData, useAnalysis, aggregate, ledger, upsert, TRAY, EXP_CATS, FEED_CAT, CHICK_CAT, MED_CAT, LABOR_CAT, PACK_CAT, rawStock, rawAvgPrice } from "./farm.js";
import { inr, today, uid } from "./store.js";
import { COL, PIE, ChartCard, Kpi, Alerts, nf, RangeFilter, rangeOf, inRange } from "./charts.jsx";
import { Msg, Num, Qty, Empty } from "./ui.jsx";
import { WUNITS, toBase, kgText, qtyText } from "./units.js";
import { n, addExpense, addPurchase, makeFeed } from "./actions.js";
import Crud from "./Crud.jsx";

const G = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
const X = <XAxis dataKey="k" tick={{ fontSize: 11 }} minTickGap={18} />;
const Y = <YAxis tick={{ fontSize: 11 }} width={46} />;
const newest = (a) => [...a].sort((x, y) => (x.date < y.date ? 1 : -1));
const sum = (a, f) => a.reduce((x, y) => x + (+f(y) || 0), 0);
const Chips = ({ list, v, set }) => <div className="chips">{list.map(([k, l]) => <button key={k} className={k === v ? "on" : ""} onClick={() => set(k)}>{l}</button>)}</div>;
const go = (p) => (location.hash = "#/admin/" + p);
const Tbl = ({ heads, rows, empty = "Nothing here yet." }) => (
  <div className="scroll"><table><thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="muted">{empty}</p>}</div>
);
function useCtx(batchId, d) {
  const F = useFarmData(); const A = useAnalysis(d.orders, d.txns, batchId);
  const batch = F.batches.find((b) => b.id === batchId); const fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  return { F, A, batch, fn, t: A.tot, perBox: +F.boxCfg.perBox || 9 };
}
const monthRows = (rows) => rows.filter((r) => r.date >= today().slice(0, 8) + "01");
function usePeriod() { const [rv, setRv] = useState({ preset: "month" }); return { rv, setRv, r: rangeOf(rv) }; }
const Period = ({ p, count }) => <div className="periodbar"><RangeFilter v={p.rv} set={p.setRv} /><small className="muted">Showing {count} {count === 1 ? "entry" : "entries"} for the chosen time. Pick “All time” to see everything.</small></div>;
const Del = ({ onDo }) => <button className="link" onClick={() => confirm("Delete this entry? Stock and money will adjust automatically.") && onDo()}>Delete</button>;

/* ================= Overview ================= */
export function FarmOverview({ batchId, d }) {
  const { F, A, batch, t } = useCtx(batchId, d);
  if (!batch) return null;
  const m = monthRows(A.rows), rev = sum(m, (r) => r.revenue), ex = sum(m, (r) => r.expense), profit = rev - ex;
  const done = F.logs.some((l) => l.batchId === batchId && l.date === today());
  const day = aggregate(A.rows, "day"), st = A.perBatch.find((x) => x.b.id === batchId) || {};
  return (
    <>
      <div className={"todaybox " + (done ? "done" : "todo")}><div><b>{done ? "✓ Today's update is saved" : "Today's update is not done yet"}</b><br /><span>{done ? "You can add sales or expenses anytime." : "Enter today's eggs, feed, birds, sales and expenses."}</span></div><button className="btn" onClick={() => go(`farm/${batchId}/today`)}>{done ? "Add more" : "Enter today's update"}</button></div>
      <Alerts list={A.alerts} />
      <h3 className="sh">{batch.name} at a glance</h3>
      <div className="kpis">
        <Kpi l="Eggs today" v={nf(A.rows[A.rows.length - 1]?.eggs)} /><Kpi l="Eggs ready to sell" v={nf(t.stockTrays) + " trays"} t={t.stockTrays < 20 ? "bad" : "good"} />
        <Kpi l="Birds alive" v={nf(t.alive)} t="good" hint={`${st.weeks ?? 0} weeks old${st.laying ? "" : ", still growing"}`} /><Kpi l="Birds died (total)" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}% of birds bought`} />
      </div>
      <div className="kpis">
        <Kpi l="Money earned this month" v={inr(rev)} t="good" /><Kpi l="Money spent this month" v={inr(ex)} /><Kpi l={profit >= 0 ? "Profit this month" : "Loss this month"} v={inr(Math.abs(profit))} t={profit >= 0 ? "good" : "bad"} />
        <Kpi l="Money to receive" v={inr(t.owed)} t={t.owed ? "bad" : ""} hint="sales not yet paid" /><Kpi l="Feed left" v={nf(t.feedLeft) + " kg"} hint={t.daysLeft === null ? "" : `about ${nf(t.daysLeft, 0)} days`} />
      </div>
      <ChartCard title="Eggs, last 30 days" hint="Good eggs and broken eggs each day"><ComposedChart data={day}>{G}{X}{Y}<Tooltip /><Legend /><Bar dataKey="good" name="Good eggs" stackId="e" fill={COL.green} /><Bar dataKey="broken" name="Broken" stackId="e" fill={COL.red} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
    </>
  );
}

/* ================= Production ================= */
export function Production({ batchId, d }) {
  const { F, A, batch, t } = useCtx(batchId, d); const day = aggregate(A.rows, "day");
  const types = Object.fromEntries(F.types.map((x) => [x.id, x.name]));
  const P = usePeriod(); const rows = newest(F.logs.filter((l) => l.batchId === batchId && inRange(l.date, P.r)));
  return (
    <>
      <div className="kpis"><Kpi l="Eggs so far" v={nf(t.eggs)} /><Kpi l="Good trays so far" v={nf(t.producedTrays)} /><Kpi l="Laying rate (7 days)" v={t.hdp7 === null ? "not laying yet" : nf(t.hdp7, 1) + "%"} hint="of hens that laid an egg each day" t={t.hdp7 !== null && t.hdp7 < 70 ? "bad" : "good"} /><Kpi l="Eggs broken" v={nf(t.eggs ? (t.broken / t.eggs) * 100 : 0, 1) + "%"} hint={`worth about ${inr(t.brokenValue)}`} /></div>
      <ChartCard title="Eggs per day" hint="Last 30 days"><ComposedChart data={day}>{G}{X}{Y}<Tooltip /><Legend /><Bar dataKey="good" name="Good eggs" stackId="e" fill={COL.green} /><Bar dataKey="broken" name="Broken" stackId="e" fill={COL.red} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
      <p className="muted">To add a new day use <button className="link" onClick={() => go(`farm/${batchId}/today`)}>Today's Update</button>. Use this list to correct a day.</p>
      <Period p={P} count={rows.length} />
      <Crud title="Daily records" rows={rows} blank={{ date: today(), batchId, feedType: F.types[0]?.id || "", feedKg: 0, deaths: 0, culled: 0, eggs: 0, broken: 0, note: "" }} {...upsert(F.setLogs)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "eggs", label: "Eggs collected", type: "number" }, { k: "broken", label: "Eggs broken", type: "number" }, { k: "feedType", label: "Feed", opts: F.types.map((x) => ({ v: x.id, l: x.name })), fmt: (v) => types[v] || "–" }, { k: "feedKg", label: "Feed given (kg)", type: "number" },
          { k: "deaths", label: "Birds died", type: "number" }, { k: "culled", label: "Birds sold or removed", type: "number", req: false }, { k: "note", label: "Note", req: false },
          { k: "extra", label: "Your own fields", noForm: true, fmt: (v) => Object.entries(v || {}).filter(([, x]) => x).map(([k, x]) => `${F.cf.find((c) => c.id === k)?.label || ""}: ${x}`).join(", ") }]} />
    </>
  );
}

/* ================= Sales ================= */
export function Sales({ batchId, d }) {
  const { F, A, batch, t } = useCtx(batchId, d); const [sub, setSub] = useState("sales"); const day = aggregate(A.rows, "day");
  const P = usePeriod(); const mine = newest(d.orders.filter((o) => o.batchId === batchId && inRange(o.date, P.r))), online = newest(d.orders.filter((o) => !o.batchId && inRange(o.date, P.r)));
  const owing = d.orders.filter((o) => o.status === "Delivered" && o.payStatus === "Unpaid" && (!o.batchId || o.batchId === batchId));
  const m = monthRows(A.rows);
  const itemsFmt = (v) => (v || []).map((i) => `${i.qty} ${i.unit}`).join(", ");
  return (
    <>
      <div className="kpis"><Kpi l="Money from sales this month" v={inr(sum(m, (r) => r.revenue))} t="good" /><Kpi l="Trays sold this month" v={nf(sum(m, (r) => r.sold) / TRAY, 1)} /><Kpi l="Money to receive" v={inr(t.owed)} t={t.owed ? "bad" : ""} /></div>
      <button className="btn" onClick={() => go(`farm/${batchId}/today`)}>+ Add a sale (Today's Update)</button>
      <Chips list={[["sales", "My sales"], ["owed", `Money to receive${owing.length ? " (" + owing.length + ")" : ""}`], ["online", "Online orders"]]} v={sub} set={setSub} />
      {(sub === "sales" || sub === "online") && <Period p={P} count={sub === "sales" ? mine.length : online.length} />}
      {sub === "sales" && <>
        <ChartCard title="Sales per day" hint="Last 30 days"><ComposedChart data={day}>{G}{X}{Y}<Tooltip formatter={(v) => inr(v)} /><Bar dataKey="revenue" name="Money from sales" fill={COL.green} radius={[4, 4, 0, 0]} /></ComposedChart></ChartCard>
        <Crud title="Sales entered for this batch" rows={mine} blank={{}} noAdd {...upsert(d.setOrders)}
          fields={[{ k: "date", label: "Date", type: "date" }, { k: "name", label: "Customer", req: false }, { k: "items", label: "What was sold", noForm: true, fmt: itemsFmt }, { k: "total", label: "Amount (₹)", type: "number", fmt: inr }, { k: "payStatus", label: "Money received?", opts: [{ v: "Paid", l: "Yes, received" }, { v: "Unpaid", l: "No, pending" }] }]} />
      </>}
      {sub === "owed" && <section className="card"><h3>Customers who have not paid yet</h3>
        {!owing.length && <Empty text="Nobody owes you money. 🎉" />}
        {owing.map((o) => <div className="line" key={o.id}><span><b>{o.name}</b> · {o.date}<br /><small className="muted">{itemsFmt(o.items)}</small></span><span><b>{inr(o.total)}</b> <button className="btn sm" onClick={() => d.setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, payStatus: "Paid" } : x)))}>Money received</button></span></div>)}</section>}
      {sub === "online" && <Crud title="Orders from the online shop" rows={online} blank={{}} noAdd {...upsert(d.setOrders)}
        fields={[{ k: "date", label: "Date", type: "date" }, { k: "name", label: "Customer" }, { k: "phone", label: "Phone" }, { k: "items", label: "Items", noForm: true, fmt: (v) => (v || []).map((i) => `${i.name} × ${i.qty}`).join(", ") }, { k: "total", label: "Total", type: "number", fmt: inr }, { k: "payStatus", label: "Paid?", opts: ["Unpaid", "Paid", "Refunded"] }, { k: "status", label: "Order status", opts: ["Pending", "Confirmed", "Out for delivery", "Delivered", "Cancelled"] }]} />}
    </>
  );
}

/* ================= Expenses ================= */
function AddExpense({ F, batch, onDone }) {
  const [c, setC] = useState(EXP_CATS[3]); const [date, setDate] = useState(today()); const [amt, setAmt] = useState(""); const [note, setNote] = useState(""); const [sub, setSub] = useState("");
  const [q, setQ] = useState({ q: "", u: "Kg" }); const [msg, setMsg] = useState(""); const [staffId, setStaffId] = useState(""); const [due, setDue] = useState("");
  const feedOpts = [...F.types.map((t) => ({ v: "feed:" + t.id, l: "Ready feed: " + t.name })), ...F.raw.map((r) => ({ v: "raw:" + r.id, l: r.name }))];
  const trayOpts = [["trays", "Empty trays"], ["boxes", "Empty boxes"], ["other", "Other packaging (tape, bags…)"]];
  const kind = sub.split(":")[0], rawItem = F.raw.find((r) => r.id === sub.split(":")[1]);
  const units = kind === "raw" && rawItem?.unit === "ltr" ? ["Litre"] : WUNITS;
  const save = (e) => {
    e.preventDefault(); let err = "";
    if (c === FEED_CAT) { const s = sub || feedOpts[0]?.v || ""; const [k, id] = s.split(":"); err = k === "feed" ? addPurchase(F, batch, "feed", { date, feedType: id, kg: toBase(q.q, q.u), cost: amt, supplier: note }) : addPurchase(F, batch, "raw", { date, itemId: id, qty: toBase(q.q, units.includes(q.u) ? q.u : units[0]), cost: amt, supplier: note }); }
    else if (c === PACK_CAT && (sub === "trays" || sub === "boxes" || !sub)) err = addPurchase(F, batch, sub || "trays", { date, qty: q.q, cost: amt, supplier: note });
    else if (c === MED_CAT) err = addPurchase(F, batch, "medicine", { date, cost: amt, sub: sub || "Medicine", note, due });
    else if (n(amt) <= 0) err = "Enter the amount.";
    else addExpense(F, batch, { date, category: c, amount: amt, note, sub: c === PACK_CAT ? "Other packaging" : "", staffId });
    if (err) return setMsg("e|" + err);
    setAmt(""); setNote(""); setQ({ q: "", u: "Kg" }); setDue(""); setMsg("s|Saved. Stock and reports are updated."); onDone?.();
  };
  return (
    <form className="card form grid2" onSubmit={save}><h3 className="wide">Add an expense</h3>
      <label>What for<select value={c} onChange={(e) => { setC(e.target.value); setSub(""); }}>{EXP_CATS.filter((x) => x !== CHICK_CAT).map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></label>
      {c === FEED_CAT && <><label>What did you buy?<select value={sub || feedOpts[0]?.v} onChange={(e) => setSub(e.target.value)}>{feedOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label><Qty label="How much" v={q} set={setQ} units={units} /></>}
      {c === PACK_CAT && <><label>What did you buy?<select value={sub || "trays"} onChange={(e) => setSub(e.target.value)}>{trayOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>{(sub || "trays") !== "other" && <Num label="How many" v={q.q} set={(v) => setQ({ ...q, q: v })} />}</>}
      {c === MED_CAT && <><label>Kind<select value={sub || "Medicine"} onChange={(e) => setSub(e.target.value)}><option>Medicine</option><option>Vaccine</option></select></label><label>Next due date (optional)<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label></>}
      {c === LABOR_CAT && <label>Whose salary<select value={staffId} onChange={(e) => { setStaffId(e.target.value); const s = F.staff.find((x) => x.id === e.target.value); if (s && !amt) setAmt(String(s.salary || "")); }}><option value="">Not listed</option>{F.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <Num label="Total amount (₹)" v={amt} set={setAmt} />
      <label>{c === FEED_CAT || c === PACK_CAT ? "Bought from (optional)" : "Note (optional)"}<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {(c === FEED_CAT || (c === PACK_CAT && sub !== "other")) && <p className="muted wide">This also adds to your stock, so you do not enter it anywhere else.</p>}
      <div className="row wide"><button className="btn sm">Save expense</button></div><div className="wide"><Msg m={msg} /></div></form>
  );
}
export function Expenses({ batchId, d }) {
  const { F, A, batch } = useCtx(batchId, d); const [rv, setRv] = useState({ preset: "month" }); const [cat, setCat] = useState(""); const [adding, setAdding] = useState(false);
  const r = rangeOf(rv);
  const all = ledger({ orders: [], batches: F.batches, feed: F.feed, rawBuy: F.rawBuy, boxes: F.boxes, trays: F.trays, txns: [], farms: F.farms, exp: F.exp }).filter((x) => x.batchId === batchId);
  const rows = all.filter((x) => inRange(x.date, r) && (!cat || x.category === cat));
  const total = sum(rows, (x) => x.amount), byCat = {}; rows.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const pie = Object.entries(byCat).map(([name, value]) => ({ name, value: Math.round(value) })), top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const delRow = (x) => ({ Expenses: () => F.setExp((a) => a.filter((q) => q.id !== x.srcId)), Purchases: null }[x.source]);
  return (
    <>
      <div className="row"><button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ Add an expense"}</button></div>
      {adding && <AddExpense F={F} batch={batch} onDone={() => setAdding(false)} />}
      <RangeFilter v={rv} set={setRv} />
      <div className="row filt"><label className="inl">Show<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All expenses</option>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div className="kpis"><Kpi l="Total spent" v={inr(total)} t="bad" /><Kpi l="Biggest cost" v={top ? top[0] : "–"} hint={top ? inr(top[1]) : ""} /><Kpi l="Entries" v={rows.length} /></div>
      <ChartCard title="Where the money went">{pie.length ? <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v) => inr(v)} /><Legend /></PieChart> : <div />}</ChartCard>
      <section className="card"><h3>All expenses</h3><p className="muted">Feed, raw materials, chicks, trays and boxes you bought are added here automatically. To delete a purchase, open <button className="link" onClick={() => go(`farm/${batchId}/purchases`)}>Purchases</button>.</p>
        <div className="scroll"><table><thead><tr><th>Date</th><th>What for</th><th>Amount</th><th>Details</th><th /></tr></thead><tbody>{rows.slice(0, 300).map((x) => <tr key={x.id}><td>{x.date}</td><td>{x.category}</td><td><b>{inr(x.amount)}</b></td><td>{x.note}</td><td>{delRow(x) ? <Del onDo={delRow(x)} /> : <small className="muted">auto</small>}</td></tr>)}</tbody></table>{!rows.length && <p className="muted">No expenses in this period.</p>}</div></section>
    </>
  );
}

/* ================= Stock ================= */
export function Stock({ batchId, d }) {
  const { F, A, batch, t, perBox } = useCtx(batchId, d); const [msg, setMsg] = useState(""); const [adj, setAdj] = useState({ what: "eggs", dir: "lost", qty: "", reason: "" });
  const D = { rawBuy: F.rawBuy, mix: F.mix }, rs = rawStock(D, batch.farmId);
  const st = A.perBatch.find((x) => x.b.id === batchId) || {};
  const adjust = (e) => {
    e.preventDefault(); const q = n(adj.qty) * (adj.dir === "lost" ? -1 : 1); if (!q) return setMsg("e|Enter a number.");
    const rec = { id: uid(), date: today(), reason: adj.reason || (adj.dir === "lost" ? "Lost or damaged" : "Found") };
    if (adj.what === "eggs") F.setAdj((a) => [{ ...rec, eggs: q }, ...a]); else if (adj.what === "trays") F.setTrayAdj((a) => [{ ...rec, qty: q }, ...a]); else F.setBoxAdj((a) => [{ ...rec, qty: q }, ...a]);
    setAdj({ ...adj, qty: "", reason: "" }); setMsg("s|Stock updated.");
  };
  return (
    <>
      <p className="muted">Everything here updates by itself from Today's Update. Eggs, trays and boxes are shared by all your farms because they are sold from one place. Feed and raw materials are for this batch's farm.</p>
      <Alerts list={A.alerts.filter((a) => /trays|boxes|Feed/.test(a.text))} />
      <section className="card"><h3>🥚 Eggs</h3><div className="kpis">
        <Kpi l="Produced (good)" v={nf(t.producedTrays, 1) + " trays"} hint={`${nf(t.eggs - t.broken)} eggs`} /><Kpi l="Sold" v={nf(t.soldTrays, 1) + " trays"} /><Kpi l="Broken" v={nf(t.broken) + " eggs"} t="bad" /><Kpi l="Available now" v={nf(t.stockTrays) + " trays"} t={t.stockTrays < 20 ? "bad" : "good"} hint={`${nf(t.stockEggs)} eggs`} /></div></section>
      <section className="card"><h3>🐔 Birds</h3><div className="kpis">
        <Kpi l="Active" v={nf(t.alive)} t="good" /><Kpi l="Purchased" v={nf(t.purchased)} /><Kpi l="Dead" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} hint={`${nf(t.mortPct, 1)}%`} /><Kpi l="Sold or removed" v={nf(t.culled)} /></div></section>
      <section className="card"><h3>🌾 Feed</h3><Tbl heads={["Feed", "Made by you", "Bought", "Eaten by birds", "Available"]} rows={A.feedTable.map((x) => [x.name, kgText(x.made), kgText(x.purchased), kgText(x.used), <b>{kgText(x.left)}</b>])} /></section>
      <section className="card"><h3>🧺 Raw materials</h3><Tbl heads={["Material", "Available"]} rows={F.raw.map((r) => [r.name, <b>{qtyText(rs[r.id] || 0, r.unit)}</b>])} /></section>
      <section className="card"><h3>📦 Trays and boxes</h3>
        <Tbl heads={["", "Empty (ready to use)", "Filled", "Damaged"]} rows={[["Trays (30 eggs each)", <b>{nf(t.trayEmpty)}</b>, `${nf(t.stockTrays)} trays of eggs ready`, nf(t.trayLost)], [`Boxes (${perBox} trays = ${perBox * TRAY} eggs)`, <b>{nf(t.boxStock)}</b>, `${nf(t.boxUsed)} sent out with sales`, nf(t.boxLost)]]} /></section>
      <form className="card form grid2" onSubmit={adjust}><h3 className="wide">Eggs, trays or boxes lost, damaged or found</h3>
        <label>What<select value={adj.what} onChange={(e) => setAdj({ ...adj, what: e.target.value })}><option value="eggs">Eggs</option><option value="trays">Empty trays</option><option value="boxes">Empty boxes</option></select></label>
        <label>Happened<select value={adj.dir} onChange={(e) => setAdj({ ...adj, dir: e.target.value })}><option value="lost">Lost or damaged</option><option value="found">Found extra</option></select></label>
        <Num label="How many" v={adj.qty} set={(v) => setAdj({ ...adj, qty: v })} /><label>Reason (optional)<input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save</button></div><div className="wide"><Msg m={msg} /></div></form>
    </>
  );
}

/* ================= Feed Management ================= */
function BuyForm({ F, batch, kind, label }) {
  const [p, setP] = useState({ date: today(), feedType: F.types[0]?.id || "", itemId: F.raw[0]?.id || "", q: { q: "", u: "Kg" }, cost: "", supplier: "" }); const [msg, setMsg] = useState("");
  const item = F.raw.find((r) => r.id === p.itemId), units = kind === "raw" && item?.unit === "ltr" ? ["Litre"] : WUNITS;
  const save = (e) => { e.preventDefault(); const u = units.includes(p.q.u) ? p.q.u : units[0]; const err = addPurchase(F, batch, kind, { date: p.date, feedType: p.feedType, itemId: p.itemId, kg: toBase(p.q.q, u), qty: toBase(p.q.q, u), cost: p.cost, supplier: p.supplier }); if (err) return setMsg("e|" + err); setP({ ...p, q: { q: "", u: "Kg" }, cost: "", supplier: "" }); setMsg("s|Saved. Stock and expenses are updated."); };
  return (
    <form className="card form grid2" onSubmit={save}><h3 className="wide">{label}</h3>
      <label>Date<input type="date" value={p.date} max={today()} onChange={(e) => setP({ ...p, date: e.target.value || today() })} /></label>
      {kind === "feed" ? <label>Which feed<select value={p.feedType} onChange={(e) => setP({ ...p, feedType: e.target.value })}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        : <label>Which material<select value={p.itemId} onChange={(e) => setP({ ...p, itemId: e.target.value })}>{F.raw.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
      <Qty label="How much" v={{ q: p.q.q, u: units.includes(p.q.u) ? p.q.u : units[0] }} units={units} set={(q) => setP({ ...p, q })} />
      <Num label="Total cost (₹)" v={p.cost} set={(v) => setP({ ...p, cost: v })} />
      <label>Bought from (optional)<input list="suppliers" value={p.supplier} onChange={(e) => setP({ ...p, supplier: e.target.value })} /></label>
      <datalist id="suppliers">{F.sup.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      <div className="row wide"><button className="btn sm">Save</button></div><div className="wide"><Msg m={msg} /></div></form>
  );
}
function MixForm({ F, batch }) {
  const [m, setM] = useState({ date: today(), feedType: F.types.find((t) => /layer/i.test(t.name))?.id || F.types[0]?.id || "", kg: "", recipe: "", lines: [] }); const [msg, setMsg] = useState("");
  const have = rawStock({ rawBuy: F.rawBuy, mix: F.mix }, batch.farmId), avg = rawAvgPrice({ rawBuy: F.rawBuy });
  const fill = (id, kg) => { const r = F.recipes.find((x) => x.id === id); if (!r) return setM({ ...m, recipe: "", kg: kg ?? m.kg }); const k = n(kg ?? m.kg) || 100; setM({ ...m, recipe: id, feedType: r.feedType || m.feedType, kg: String(kg ?? (m.kg || 100)), lines: r.lines.map((l) => ({ id: uid(), itemId: l.itemId, qty: String(Math.round(l.kg * (k / 100) * 100) / 100) })) }); };
  const cost = Math.round(m.lines.reduce((a, l) => a + n(l.qty) * (avg[l.itemId] || 0), 0));
  const save = (e) => { e.preventDefault(); const err = makeFeed(F, batch, { date: m.date, feedType: m.feedType, kg: m.kg, lines: m.lines }); if (err) return setMsg("e|" + err); setM({ ...m, kg: "", recipe: "", lines: [] }); setMsg("s|Done. Raw materials went down, feed stock went up, and the cost is saved."); };
  return (
    <form className="card form grid2" onSubmit={save}><h3 className="wide">Make your own feed</h3>
      <label>Date<input type="date" value={m.date} max={today()} onChange={(e) => setM({ ...m, date: e.target.value || today() })} /></label>
      <label>Use a saved recipe<select value={m.recipe} onChange={(e) => fill(e.target.value)}><option value="">Choose (or add materials below)</option>{F.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Feed you are making<select value={m.feedType} onChange={(e) => setM({ ...m, feedType: e.target.value })}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <Num label="How many kg of feed" v={m.kg} set={(v) => (m.recipe ? fill(m.recipe, v) : setM({ ...m, kg: v }))} />
      <div className="wide">
        {m.lines.map((l) => { const it = F.raw.find((r) => r.id === l.itemId); return (
          <div className="line3" key={l.id}><label>Material<select value={l.itemId} onChange={(e) => setM({ ...m, lines: m.lines.map((q) => (q.id === l.id ? { ...q, itemId: e.target.value } : q)) })}>{F.raw.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <Num label={`Used (${it?.unit || "kg"})`} v={l.qty} set={(v) => setM({ ...m, lines: m.lines.map((q) => (q.id === l.id ? { ...q, qty: v } : q)) })} hint={`in stock: ${nf(have[l.itemId] || 0, 1)} ${it?.unit || "kg"}`} />
            <button type="button" className="link" onClick={() => setM({ ...m, lines: m.lines.filter((q) => q.id !== l.id) })}>Remove</button></div>); })}
        <button type="button" className="btn sm ghost" onClick={() => setM({ ...m, lines: [...m.lines, { id: uid(), itemId: F.raw[0]?.id || "", qty: "" }] })}>+ Add material</button>
      </div>
      {!!m.lines.length && <p className="muted wide">Cost of this feed: <b>{inr(cost)}</b>{n(m.kg) ? <> · <b>{inr(cost / n(m.kg))}</b> per kg</> : null}. It is worked out from what you paid for the raw materials.</p>}
      <div className="row wide"><button className="btn sm">Make feed</button></div><div className="wide"><Msg m={msg} /></div></form>
  );
}
function Recipes({ F }) {
  const [ed, setEd] = useState(null);
  const save = (e) => { e.preventDefault(); const r = { ...ed, id: ed.id || uid(), lines: ed.lines.filter((l) => n(l.kg) > 0).map((l) => ({ itemId: l.itemId, kg: n(l.kg) })) }; F.setRecipes((a) => (a.some((x) => x.id === r.id) ? a.map((x) => (x.id === r.id ? r : x)) : [r, ...a])); setEd(null); };
  return (
    <>
      <p className="muted">A recipe says how much of each raw material goes into 100 kg of feed. Then “Make feed” fills everything in for you.</p>
      <div className="row"><button className="btn sm" onClick={() => setEd({ name: "", feedType: F.types[0]?.id || "", lines: [{ itemId: F.raw[0]?.id || "", kg: "" }] })}>+ New recipe</button></div>
      {ed && <form className="card form" onSubmit={save}><h3>Recipe</h3>
        <label>Name<input required value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></label>
        <label>Makes which feed<select value={ed.feedType} onChange={(e) => setEd({ ...ed, feedType: e.target.value })}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {ed.lines.map((l, i) => <div className="line3" key={i}><label>Material<select value={l.itemId} onChange={(e) => setEd({ ...ed, lines: ed.lines.map((q, j) => (j === i ? { ...q, itemId: e.target.value } : q)) })}>{F.raw.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <Num label="Kg in every 100 kg of feed" v={l.kg} set={(v) => setEd({ ...ed, lines: ed.lines.map((q, j) => (j === i ? { ...q, kg: v } : q)) })} /><button type="button" className="link" onClick={() => setEd({ ...ed, lines: ed.lines.filter((_, j) => j !== i) })}>Remove</button></div>)}
        <button type="button" className="btn sm ghost" onClick={() => setEd({ ...ed, lines: [...ed.lines, { itemId: F.raw[0]?.id || "", kg: "" }] })}>+ Add material</button>
        <p className="muted">Total: {nf(sum(ed.lines, (l) => l.kg), 2)} kg per 100 kg</p>
        <div className="row"><button className="btn sm">Save recipe</button><button type="button" className="btn sm ghost" onClick={() => setEd(null)}>Cancel</button></div></form>}
      {F.recipes.map((r) => <section className="card" key={r.id}><div className="bar"><h3>{r.name}</h3><div className="row"><button className="btn sm ghost" onClick={() => setEd({ ...r, lines: r.lines.map((l) => ({ ...l })) })}>Edit</button><Del onDo={() => F.setRecipes((a) => a.filter((x) => x.id !== r.id))} /></div></div>
        <p className="muted">{r.lines.map((l) => `${F.raw.find((x) => x.id === l.itemId)?.name || "?"} ${l.kg} kg`).join(" · ")}</p></section>)}
    </>
  );
}
export function FeedMgmt({ batchId, d }) {
  const { F, A, batch, t } = useCtx(batchId, d); const [sub, setSub] = useState("stock");
  const rs = rawStock({ rawBuy: F.rawBuy, mix: F.mix }, batch.farmId);
  const tn = Object.fromEntries(F.types.map((x) => [x.id, x.name])), rn = Object.fromEntries(F.raw.map((x) => [x.id, x]));
  const P = usePeriod(); const mine = (r) => r.farmId === batch.farmId && inRange(r.date, P.r);
  return (
    <>
      <Chips list={[["stock", "Feed stock"], ["make", "Make feed"], ["buy", "Buy ready feed"], ["raw", "Raw materials"], ["recipes", "Recipes"], ["types", "Feed types"]]} v={sub} set={setSub} />
      {sub === "stock" && <>
        <Alerts list={A.alerts.filter((a) => /Feed/.test(a.text))} />
        <div className="kpis"><Kpi l="Feed available" v={kgText(t.feedLeft)} /><Kpi l="Will last about" v={t.daysLeft === null ? "–" : nf(t.daysLeft, 0) + " days"} t={t.daysLeft !== null && t.daysLeft < 7 ? "bad" : "good"} /><Kpi l="Made by you" v={kgText(t.feedMade)} /><Kpi l="Bought ready-made" v={kgText(t.feedBoughtKg)} /><Kpi l="Average cost" v={inr(t.avgFeedPrice) + "/kg"} /></div>
        <section className="card"><h3>Feed by type</h3><Tbl heads={["Feed", "Made by you", "Bought", "Eaten by birds", "Available"]} rows={A.feedTable.map((x) => [x.name, kgText(x.made), kgText(x.purchased), kgText(x.used), <b>{kgText(x.left)}</b>])} /></section></>}
      {["make", "buy", "raw"].includes(sub) && <Period p={P} count={sub === "make" ? F.mix.filter(mine).length : sub === "buy" ? F.feed.filter(mine).length : F.rawBuy.filter(mine).length} />}
      {sub === "make" && <><MixForm F={F} batch={batch} />
        <section className="card"><h3>Feed you made</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Feed</th><th>Made</th><th>Raw materials used</th><th>Cost</th><th /></tr></thead><tbody>{newest(F.mix.filter(mine)).map((x) => <tr key={x.id}><td>{x.date}</td><td>{tn[x.feedType]}</td><td>{kgText(x.kg)}</td><td>{x.lines.map((l) => `${rn[l.itemId]?.name || "?"} ${nf(l.qty, 1)}`).join(", ")}</td><td>{inr(x.cost)} ({inr(x.cost / (x.kg || 1))}/kg)</td><td><Del onDo={() => F.setMix((a) => a.filter((q) => q.id !== x.id))} /></td></tr>)}</tbody></table>{!F.mix.filter(mine).length && <p className="muted">Nothing made yet.</p>}</div></section></>}
      {sub === "buy" && <><BuyForm F={F} batch={batch} kind="feed" label="Buy ready-made feed" />
        <section className="card"><h3>Feed you bought</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Feed</th><th>Quantity</th><th>Cost</th><th>From</th><th /></tr></thead><tbody>{newest(F.feed.filter(mine)).map((x) => <tr key={x.id}><td>{x.date}</td><td>{tn[x.feedType]}</td><td>{kgText(x.kg)}</td><td>{inr(x.cost)}</td><td>{x.supplier}</td><td><Del onDo={() => F.setFeed((a) => a.filter((q) => q.id !== x.id))} /></td></tr>)}</tbody></table>{!F.feed.filter(mine).length && <p className="muted">Nothing bought yet.</p>}</div></section></>}
      {sub === "raw" && <>
        <section className="card"><h3>Raw materials in stock</h3><Tbl heads={["Material", "Available"]} rows={F.raw.map((r) => [r.name, <b>{qtyText(rs[r.id] || 0, r.unit)}</b>])} /><p className="muted">Add your own materials in Settings → Farms. Or ask for “Custom ingredients” below.</p></section>
        <CustomRaw F={F} /><BuyForm F={F} batch={batch} kind="raw" label="Buy raw material" />
        <section className="card"><h3>Raw materials you bought</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Material</th><th>Quantity</th><th>Cost</th><th>From</th><th /></tr></thead><tbody>{newest(F.rawBuy.filter(mine)).map((x) => <tr key={x.id}><td>{x.date}</td><td>{rn[x.itemId]?.name}</td><td>{qtyText(x.qty, rn[x.itemId]?.unit)}</td><td>{inr(x.cost)}</td><td>{x.supplier}</td><td><Del onDo={() => F.setRawBuy((a) => a.filter((q) => q.id !== x.id))} /></td></tr>)}</tbody></table>{!F.rawBuy.filter(mine).length && <p className="muted">Nothing bought yet.</p>}</div></section></>}
      {sub === "recipes" && <Recipes F={F} />}
      {sub === "types" && <Crud title="Feed types and nutrition" rows={F.types} blank={{ name: "", protein: 17, energy: 2700 }} {...upsert(F.setTypes)} fields={[{ k: "name", label: "Feed name" }, { k: "protein", label: "Protein (%)", type: "number" }, { k: "energy", label: "Energy (kcal per kg)", type: "number" }]} />}
    </>
  );
}
export function CustomRaw({ F }) {
  return <Crud title="Your raw material list (add your own)" rows={F.raw} blank={{ name: "", unit: "kg" }} {...upsert(F.setRaw)} fields={[{ k: "name", label: "Name (e.g. Broken rice, Fish meal)" }, { k: "unit", label: "Measured in", opts: [{ v: "kg", l: "Kg / Quintal / Ton" }, { v: "ltr", l: "Litre" }] }]} />;
}

/* ================= Mortality ================= */
export function Mortality({ batchId, d }) {
  const { F, A, batch, t } = useCtx(batchId, d); const day = aggregate(A.rows, "day");
  const P = usePeriod(); const L = F.logs.filter((l) => l.batchId === batchId && n(l.deaths) > 0 && inRange(l.date, P.r)), cause = {}; L.forEach((l) => { const c = l.cause || "Not known"; cause[c] = (cause[c] || 0) + n(l.deaths); });
  return (
    <>
      <div className="kpis"><Kpi l="Birds died (total)" v={nf(t.died)} t={t.mortPct > 8 ? "bad" : ""} /><Kpi l="Mortality" v={nf(t.mortPct, 1) + "%"} hint="of birds bought" t={t.mortPct > 8 ? "bad" : "good"} /><Kpi l="Birds alive" v={nf(t.alive)} t="good" /><Kpi l="Value lost" v={inr(t.mortalityValue)} t="bad" hint="what the dead chicks cost" /></div>
      <Alerts list={A.alerts.filter((a) => /died/.test(a.text))} />
      <ChartCard title="Deaths per day" hint="Last 30 days"><BarChart data={day}>{G}{X}{Y}<Tooltip /><Bar dataKey="deaths" name="Died" fill={COL.red} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      <Period p={P} count={L.length} />
      <section className="card"><h3>Why birds died</h3><Tbl heads={["Reason", "Birds"]} rows={Object.entries(cause).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, nf(v)])} empty="No deaths recorded." /></section>
      <section className="card"><h3>Days with deaths</h3><Tbl heads={["Date", "Birds died", "Reason", "Note"]} rows={newest(L).slice(0, 60).map((l) => [l.date, l.deaths, l.cause || "–", l.note || ""])} empty="No deaths recorded." /><p className="muted">Record deaths in Today's Update. To correct an old day, use Production → Daily records.</p></section>
    </>
  );
}

/* ================= Health & Medicine ================= */
export function Health({ batchId, d }) {
  const { F, batch } = useCtx(batchId, d); const [p, setP] = useState({ date: today(), sub: "Vaccine", note: "", cost: "", due: "" }); const [msg, setMsg] = useState("");
  const P = usePeriod(); const rows = newest(F.exp.filter((e) => e.batchId === batchId && e.category === MED_CAT && inRange(e.date, P.r))), due = F.tasks.filter((t) => t.status === "Open" && t.batchId === batchId && /due:/.test(t.title));
  const save = (e) => { e.preventDefault(); const err = addPurchase(F, batch, "medicine", p); if (err) return setMsg("e|" + err); setP({ ...p, note: "", cost: "", due: "" }); setMsg("s|Saved. The cost is added to expenses."); };
  return (
    <>
      <div className="kpis"><Kpi l="Spent on medicine and vaccines" v={inr(sum(rows, (e) => e.amount))} /><Kpi l="Entries" v={rows.length} /><Kpi l="Coming up" v={due.length} t={due.length ? "bad" : "good"} /></div>
      {!!due.length && <div className="alerts">{due.map((t) => <div key={t.id} className="alert warn">{t.date}: {t.title}</div>)}</div>}
      <form className="card form grid2" onSubmit={save}><h3 className="wide">Add medicine or vaccine</h3>
        <label>Date<input type="date" value={p.date} max={today()} onChange={(e) => setP({ ...p, date: e.target.value || today() })} /></label>
        <label>Kind<select value={p.sub} onChange={(e) => setP({ ...p, sub: e.target.value })}><option>Vaccine</option><option>Medicine</option></select></label>
        <label>Name (e.g. Ranikhet, Lasota)<input required value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></label>
        <Num label="Cost (₹)" v={p.cost} set={(v) => setP({ ...p, cost: v })} />
        <label>Next one due on (optional)<input type="date" value={p.due} onChange={(e) => setP({ ...p, due: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save</button></div><div className="wide"><Msg m={msg} /></div></form>
      <Period p={P} count={rows.length} />
      <section className="card"><h3>History</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Kind</th><th>Name</th><th>Cost</th><th /></tr></thead><tbody>{rows.map((e) => <tr key={e.id}><td>{e.date}</td><td>{e.sub || "Medicine"}</td><td>{e.note}</td><td>{inr(e.amount)}</td><td><Del onDo={() => F.setExp((a) => a.filter((x) => x.id !== e.id))} /></td></tr>)}</tbody></table>{!rows.length && <p className="muted">Nothing recorded yet.</p>}</div></section>
    </>
  );
}

/* ================= Purchases ================= */
export function Purchases({ batchId, d }) {
  const { F, A, batch } = useCtx(batchId, d); const [sub, setSub] = useState("list"); const [msg, setMsg] = useState("");
  const P = usePeriod(); const [c, setC] = useState({ date: today(), name: "", count: "", chickCost: "", supplier: "", ageDays: 1 });
  const [q, setQ] = useState({ date: today(), qty: "", cost: "", supplier: "" });
  const rows = ledger({ orders: [], batches: F.batches, feed: F.feed, rawBuy: F.rawBuy, boxes: F.boxes, trays: F.trays, txns: [], farms: F.farms, exp: [] }).filter((x) => x.batchId === batchId && inRange(x.date, P.r));
  const newBatch = (e) => { e.preventDefault(); if (n(c.count) <= 0) return setMsg("e|Enter how many chicks."); F.setBatches((b) => [{ id: uid(), farmId: batch.farmId, name: c.name || "New batch", breed: "", date: c.date, count: n(c.count), chickCost: n(c.chickCost), ageDays: n(c.ageDays), supplier: c.supplier, status: "Active", note: "" }, ...b]); setC({ ...c, name: "", count: "", chickCost: "" }); setMsg("s|New batch added on this farm. Find it in My Farms."); };
  const qf = (kind) => (e) => { e.preventDefault(); const err = addPurchase(F, batch, kind, q); if (err) return setMsg("e|" + err); setQ({ ...q, qty: "", cost: "", supplier: "" }); setMsg("s|Saved. Stock and expenses are updated."); };
  const del = (x) => ({ f: () => F.setFeed((a) => a.filter((r) => r.id !== x.srcId)), w: () => F.setRawBuy((a) => a.filter((r) => r.id !== x.srcId)), t: () => F.setTrays((a) => a.filter((r) => r.id !== x.srcId)), x: () => F.setBoxes((a) => a.filter((r) => r.id !== x.srcId)) }[x.id[0]]);
  return (
    <>
      <p className="muted">Everything you bought for stock. The cost is saved as an expense automatically. Medicines are under Health & Medicine.</p>
      <Chips list={[["list", "All purchases"], ["feed", "Feed"], ["raw", "Raw materials"], ["trays", "Trays"], ["boxes", "Boxes"], ["chicks", "New chicks"]]} v={sub} set={(s) => { setSub(s); setMsg(""); }} />
      {sub === "list" && <Period p={P} count={rows.length} />}
      {sub === "list" && <section className="card"><h3>All purchases for this batch</h3><div className="scroll"><table><thead><tr><th>Date</th><th>What</th><th>Details</th><th>Cost</th><th /></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td>{x.date}</td><td>{x.id[0] === "b" ? "Chicks" : x.id[0] === "f" ? "Ready feed" : x.id[0] === "w" ? "Raw material" : x.id[0] === "t" ? "Trays" : "Boxes"}</td><td>{x.note}</td><td>{inr(x.amount)}</td><td>{del(x) ? <Del onDo={del(x)} /> : <small className="muted">see Settings</small>}</td></tr>)}</tbody></table>{!rows.length && <p className="muted">No purchases yet.</p>}</div></section>}
      {sub === "feed" && <BuyForm F={F} batch={batch} kind="feed" label="Buy ready-made feed" />}
      {sub === "raw" && <BuyForm F={F} batch={batch} kind="raw" label="Buy raw material" />}
      {sub === "trays" && <form className="card form grid2" onSubmit={qf("trays")}><h3 className="wide">Buy empty trays</h3><label>Date<input type="date" value={q.date} max={today()} onChange={(e) => setQ({ ...q, date: e.target.value || today() })} /></label><Num label="How many trays" v={q.qty} set={(v) => setQ({ ...q, qty: v })} /><Num label="Total cost (₹)" v={q.cost} set={(v) => setQ({ ...q, cost: v })} /><label>Bought from<input list="suppliers" value={q.supplier} onChange={(e) => setQ({ ...q, supplier: e.target.value })} /></label><div className="row wide"><button className="btn sm">Save</button></div></form>}
      {sub === "boxes" && <form className="card form grid2" onSubmit={qf("boxes")}><h3 className="wide">Buy empty boxes</h3><label>Date<input type="date" value={q.date} max={today()} onChange={(e) => setQ({ ...q, date: e.target.value || today() })} /></label><Num label="How many boxes" v={q.qty} set={(v) => setQ({ ...q, qty: v })} /><Num label="Total cost (₹)" v={q.cost} set={(v) => setQ({ ...q, cost: v })} /><label>Bought from<input list="suppliers" value={q.supplier} onChange={(e) => setQ({ ...q, supplier: e.target.value })} /></label><div className="row wide"><button className="btn sm">Save</button></div></form>}
      {sub === "chicks" && <form className="card form grid2" onSubmit={newBatch}><h3 className="wide">Buy new chicks (starts a new batch on this farm)</h3>
        <label>Batch name (e.g. Batch E)<input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label><label>Date<input type="date" value={c.date} max={today()} onChange={(e) => setC({ ...c, date: e.target.value || today() })} /></label>
        <Num label="How many chicks" v={c.count} set={(v) => setC({ ...c, count: v })} /><Num label="Cost per chick (₹)" v={c.chickCost} set={(v) => setC({ ...c, chickCost: v })} /><Num label="Age of chicks in days" v={c.ageDays} set={(v) => setC({ ...c, ageDays: v })} />
        <label>Bought from<input list="suppliers" value={c.supplier} onChange={(e) => setC({ ...c, supplier: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save new batch</button></div></form>}
      <datalist id="suppliers">{F.sup.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      <Msg m={msg} />
    </>
  );
}

/* ================= Staff & Labor ================= */
export function StaffLabor({ batchId, d }) {
  const { F, batch } = useCtx(batchId, d); const [pay, setPay] = useState({ staffId: "", amount: "", date: today(), note: "" }); const [msg, setMsg] = useState("");
  const mine = F.staff.filter((s) => !s.farmId || s.farmId === batch.farmId), paidAll = F.exp.filter((e) => e.batchId === batchId && e.category === LABOR_CAT), P = usePeriod(), paid = paidAll.filter((e) => inRange(e.date, P.r));
  const month = today().slice(0, 7), paidBy = (id) => sum(paidAll.filter((e) => e.staffId === id && e.date.slice(0, 7) === month), (e) => e.amount);
  const save = (e) => { e.preventDefault(); if (n(pay.amount) <= 0) return setMsg("e|Enter the amount."); const s = F.staff.find((x) => x.id === pay.staffId); addExpense(F, batch, { date: pay.date, category: LABOR_CAT, amount: pay.amount, note: pay.note || (s ? `Salary: ${s.name}` : "Wages"), staffId: pay.staffId }); setPay({ ...pay, amount: "", note: "" }); setMsg("s|Saved as an expense."); };
  return (
    <>
      <div className="kpis"><Kpi l="Workers" v={mine.filter((s) => s.active !== "No").length} /><Kpi l="Paid this month" v={inr(sum(paidAll.filter((e) => e.date.slice(0, 7) === month), (e) => e.amount))} /><Kpi l="Monthly salaries" v={inr(sum(mine.filter((s) => s.active !== "No"), (s) => s.salary))} /></div>
      <section className="card"><h3>Your workers</h3><Tbl heads={["Name", "Work", "Phone", "Salary", "Paid this month"]} rows={mine.map((s) => [s.name, s.role, s.phone, inr(s.salary), inr(paidBy(s.id))])} empty="No workers added. Add them in Settings → Staff." /></section>
      <form className="card form grid2" onSubmit={save}><h3 className="wide">Pay a salary or wages</h3>
        <label>Who<select value={pay.staffId} onChange={(e) => { const s = F.staff.find((x) => x.id === e.target.value); setPay({ ...pay, staffId: e.target.value, amount: s ? String(s.salary || "") : pay.amount }); }}><option value="">Daily labour / not listed</option>{mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Date<input type="date" value={pay.date} max={today()} onChange={(e) => setPay({ ...pay, date: e.target.value || today() })} /></label>
        <Num label="Amount (₹)" v={pay.amount} set={(v) => setPay({ ...pay, amount: v })} /><label>Note (optional)<input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save payment</button></div><div className="wide"><Msg m={msg} /></div></form>
      <Period p={P} count={paid.length} />
      <section className="card"><h3>Payments made</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Details</th><th>Amount</th><th /></tr></thead><tbody>{newest(paid).slice(0, 100).map((e) => <tr key={e.id}><td>{e.date}</td><td>{e.note}</td><td>{inr(e.amount)}</td><td><Del onDo={() => F.setExp((a) => a.filter((x) => x.id !== e.id))} /></td></tr>)}</tbody></table>{!paid.length && <p className="muted">No payments yet.</p>}</div></section>
    </>
  );
}

/* ================= Tasks & Reminders ================= */
export function Tasks({ batchId, d }) {
  const { F } = useCtx(batchId, d); const [p, setP] = useState({ date: today(), title: "" });
  const mine = F.tasks.filter((t) => !t.batchId || t.batchId === batchId), open = mine.filter((t) => t.status === "Open").sort((a, b) => (a.date < b.date ? -1 : 1)), done = mine.filter((t) => t.status !== "Open");
  const set = (id, st) => F.setTasks((a) => a.map((t) => (t.id === id ? { ...t, status: st } : t)));
  const add = (e) => { e.preventDefault(); F.setTasks((a) => [{ id: uid(), date: p.date, title: p.title, batchId, status: "Open" }, ...a]); setP({ ...p, title: "" }); };
  return (
    <>
      <form className="card form grid2" onSubmit={add}><h3 className="wide">New reminder</h3><label>What to do<input required value={p.title} placeholder="e.g. Vaccinate Batch B" onChange={(e) => setP({ ...p, title: e.target.value })} /></label><label>On which day<input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></label><div className="row wide"><button className="btn sm">Add reminder</button></div></form>
      <section className="card"><h3>To do</h3>{!open.length && <Empty text="Nothing to do. 🎉" />}{open.map((t) => <div className="line" key={t.id}><span><b className={t.date < today() ? "out" : ""}>{t.date}</b> {t.title}</span><span><button className="btn sm" onClick={() => set(t.id, "Done")}>Done ✓</button> <Del onDo={() => F.setTasks((a) => a.filter((x) => x.id !== t.id))} /></span></div>)}</section>
      {!!done.length && <section className="card"><h3>Finished</h3>{done.slice(0, 20).map((t) => <div className="line muted" key={t.id}><span>{t.date} {t.title}</span><span><button className="link" onClick={() => set(t.id, "Open")}>Undo</button> <Del onDo={() => F.setTasks((a) => a.filter((x) => x.id !== t.id))} /></span></div>)}</section>}
    </>
  );
}

/* ================= Documents & Records ================= */
export function Documents({ batchId, d }) {
  const { F } = useCtx(batchId, d); const [p, setP] = useState({ date: today(), title: "", type: "Bill", note: "", file: "", fname: "" }); const [msg, setMsg] = useState("");
  const P = usePeriod(); const rows = newest(F.docs.filter((x) => (!x.batchId || x.batchId === batchId) && inRange(x.date, P.r)));
  const pick = (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 300 * 1024) { e.target.value = ""; return setMsg("e|The file is too big (limit 300 KB). Take a smaller photo or add a note instead."); } const r = new FileReader(); r.onload = () => { setP({ ...p, file: r.result, fname: f.name }); setMsg(""); }; r.readAsDataURL(f); };
  const add = (e) => { e.preventDefault(); F.setDocs((a) => [{ ...p, id: uid(), batchId }, ...a]); setP({ date: today(), title: "", type: "Bill", note: "", file: "", fname: "" }); setMsg("s|Saved."); e.target.reset(); };
  return (
    <>
      <p className="muted">Keep bills, vaccination cards, licences and lab reports together. You can attach a small photo or PDF (up to 300 KB). Use Backup in Settings to keep a copy.</p>
      <form className="card form grid2" onSubmit={add}><h3 className="wide">Add a record</h3>
        <label>Title<input required value={p.title} placeholder="e.g. Feed bill, Vaccination card" onChange={(e) => setP({ ...p, title: e.target.value })} /></label>
        <label>Kind<select value={p.type} onChange={(e) => setP({ ...p, type: e.target.value })}>{["Bill", "Vaccination record", "Licence or certificate", "Lab report", "Agreement", "Other"].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Date<input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></label><label>Photo or file (optional)<input type="file" accept="image/*,application/pdf" onChange={pick} /></label>
        <label className="wide">Note<input value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save record</button></div><div className="wide"><Msg m={msg} /></div></form>
      <Period p={P} count={rows.length} />
      <section className="card"><h3>Your records</h3><div className="scroll"><table><thead><tr><th>Date</th><th>Title</th><th>Kind</th><th>Note</th><th>File</th><th /></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td>{x.date}</td><td><b>{x.title}</b></td><td>{x.type}</td><td>{x.note}</td><td>{x.file ? <a href={x.file} download={x.fname || x.title}>Open</a> : "–"}</td><td><Del onDo={() => F.setDocs((a) => a.filter((q) => q.id !== x.id))} /></td></tr>)}</tbody></table>{!rows.length && <p className="muted">No records yet.</p>}</div></section>
    </>
  );
}
