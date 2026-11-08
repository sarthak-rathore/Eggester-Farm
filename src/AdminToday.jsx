import React, { useState, useEffect } from "react";
import { useFarmData, useAnalysis, TRAY, EXP_CATS } from "./farm.js";
import { inr, today, uid } from "./store.js";
import { Kpi, Alerts, nf } from "./charts.jsx";

const n = (v) => +v || 0;
const blankLog = () => ({ feedType: "ft3", feedKg: "", deaths: "", culled: "", eggs: "", broken: "", note: "" });
const blankX = (p) => ({ feedType: "ft3", feedKg: "", feedCost: "", boxBought: "", boxCost: "", boxDamaged: "", eggLost: "", eggReason: "", saleProduct: p?.[0]?.id || "", saleTrays: "", salePrice: "" });
const Msg = ({ m }) => (m ? <p className={m[0] === "e" ? "out" : "okmsg"} role="status">{m.slice(2)}</p> : null);

export default function Today({ orders, setOrders, txns, products }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns);
  const [date, setDate] = useState(today());
  const [farmSel, setFarmSel] = useState(""); const [batchSel, setBatchSel] = useState("");
  const farmId = F.farms.some((f) => f.id === farmSel) ? farmSel : F.farms[0]?.id || "";
  const batches = F.batches.filter((b) => b.farmId === farmId && b.status !== "Closed");
  const batchId = batches.some((b) => b.id === batchSel) ? batchSel : batches[0]?.id || "";
  const existing = F.logs.find((l) => l.date === date && l.batchId === batchId);
  const [f, setF] = useState(blankLog()); const [x, setX] = useState(blankX(products)); const [lines, setLines] = useState([]); const [msg, setMsg] = useState("");
  useEffect(() => { setF(existing ? { feedType: existing.feedType, feedKg: String(existing.feedKg ?? ""), deaths: String(existing.deaths ?? ""), culled: String(existing.culled ?? ""), eggs: String(existing.eggs ?? ""), broken: String(existing.broken ?? ""), note: existing.note || "" } : blankLog()); }, [date, batchId, existing?.id]);
  const row = A.rows.find((r) => r.date === date) || {};
  const dayExp = F.exp.filter((e) => e.date === date), dayExpTotal = dayExp.reduce((a, e) => a + n(e.amount), 0);
  const fn = Object.fromEntries(F.farms.map((fm) => [fm.id, fm.name])), bn = Object.fromEntries(F.batches.map((b) => [b.id, b.name]));
  const dayLogs = F.logs.filter((l) => l.date === date);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }), setx = (k) => (e) => setX({ ...x, [k]: e.target.value });
  const tn = F.types;

  const save = () => {
    const done = [];
    const eggsAdded = n(f.eggs) - n(f.broken);
    if (batchId && (f.feedKg || f.deaths || f.culled || f.eggs || f.broken)) {
      const rec = { id: existing?.id || uid(), date, batchId, feedType: f.feedType, feedKg: n(f.feedKg), deaths: n(f.deaths), culled: n(f.culled), eggs: n(f.eggs), broken: n(f.broken), note: f.note };
      F.setLogs((ls) => (existing ? ls.map((l) => (l.id === existing.id ? rec : l)) : [rec, ...ls])); done.push("flock entry");
    }
    if (n(x.feedKg) > 0) { F.setFeed((fs) => [{ id: uid(), date, farmId, feedType: x.feedType, kg: n(x.feedKg), cost: n(x.feedCost), supplier: "" }, ...fs]); done.push("feed bought"); }
    if (n(x.boxBought) > 0) { F.setBoxes((bs) => [{ id: uid(), date, qty: n(x.boxBought), cost: n(x.boxCost), supplier: "" }, ...bs]); done.push("boxes bought"); }
    if (n(x.boxDamaged) > 0) { F.setBoxAdj((bs) => [{ id: uid(), date, qty: -n(x.boxDamaged), reason: "Damaged or extra used" }, ...bs]); done.push("boxes lost"); }
    if (n(x.eggLost) > 0) { F.setAdj((as) => [{ id: uid(), date, eggs: -n(x.eggLost), reason: x.eggReason || "Lost, gifted or used" }, ...as]); done.push("eggs removed from stock"); }
    const good = lines.filter((l) => n(l.amount) > 0);
    if (good.length) { F.setExp((es) => [...good.map((l) => ({ id: uid(), date, farmId: l.farmId, category: l.category, amount: n(l.amount), note: l.note })), ...es]); done.push(`${good.length} expense${good.length > 1 ? "s" : ""}`); }
    if (n(x.saleTrays) > 0) {
      const p = products.find((q) => q.id === x.saleProduct) || products[0], q = n(x.saleTrays), price = n(x.salePrice) || n(p?.price);
      if (q * TRAY > A.tot.stockEggs + Math.max(0, eggsAdded - (existing ? n(existing.eggs) - n(existing.broken) : 0))) { setMsg(`e|Only ${A.tot.stockTrays} trays are in stock. Reduce the walk-in sale or add today's eggs first.`); return; }
      const total = q * price;
      setOrders((os) => [{ id: "WALK" + uid().toUpperCase().slice(0, 4), date, userId: null, name: "Walk-in sale", phone: "", address: "Farm gate", note: "", items: [{ id: p.id, name: p.name, unit: "tray", price, qty: q, eggs: n(p.eggs) || TRAY }], subtotal: total, discount: 0, coupon: "", gst: 0, gstMode: "inclusive", delivery: 0, charges: [], total, payMethod: "COD", payStatus: "Paid", payRef: "", status: "Delivered" }, ...os]); done.push("walk-in sale");
    }
    if (!done.length) return setMsg("e|Nothing to save yet. Enter some of today's numbers first.");
    setX(blankX(products)); setLines([]); setMsg(`s|Saved for ${date}: ${done.join(", ")}. The dashboard, stock and money are updated.`);
  };
  const addLine = () => setLines([...lines, { id: uid(), category: "Labour", amount: "", note: "", farmId: farmId || "all" }]);
  const upLine = (id, k, v) => setLines(lines.map((l) => (l.id === id ? { ...l, [k]: v } : l)));

  if (!F.farms.length) return <><h2>Today's update</h2><p className="muted">Add your farms and flocks first (Flocks tab), then come back here to record each day.</p></>;
  return (
    <>
      <h2>Today's update</h2>
      <p className="muted">Record the whole day in one place. Pick the date, farm and flock, fill in what happened, and press Save. Stock, expenses, money and graphs update everywhere.</p>
      <Alerts list={A.alerts} />
      <div className="kpis"><Kpi l={`Eggs collected (${date === today() ? "today" : date})`} v={nf(row.eggs)} /><Kpi l="Birds died" v={nf(row.deaths)} t={row.deaths ? "bad" : "good"} /><Kpi l="Feed given" v={nf(row.feedKg, 1) + " kg"} /><Kpi l="Expenses entered" v={inr(dayExpTotal)} /><Kpi l="Trays in stock" v={nf(A.tot.stockTrays)} t={A.tot.stockTrays < 20 ? "bad" : "good"} /><Kpi l="Boxes in stock" v={nf(A.tot.boxStock)} /></div>

      <section className="card form grid2">
        <h3 className="wide">1. Which day, farm and flock?</h3>
        <label>Date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></label>
        <label>Farm<select value={farmId} onChange={(e) => { setFarmSel(e.target.value); setBatchSel(""); }}>{F.farms.map((fm) => <option key={fm.id} value={fm.id}>{fm.name}</option>)}</select></label>
        <label>Flock<select value={batchId} onChange={(e) => setBatchSel(e.target.value)}>{batches.length ? batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>) : <option value="">No active flock on this farm</option>}</select></label>
        <div className="wide status">{F.farms.map((fm) => F.batches.filter((b) => b.farmId === fm.id && b.status !== "Closed").map((b) => { const has = dayLogs.some((l) => l.batchId === b.id); return <button type="button" key={b.id} className={"stat " + (has ? "done" : "todo")} onClick={() => { setFarmSel(fm.id); setBatchSel(b.id); }}>{has ? "✓" : "○"} {fm.name.split(" · ")[0]}, {b.name}</button>; }))}</div>
        <p className="muted wide">{existing ? "An entry already exists for this flock and day. Saving will replace it." : "No entry yet for this flock and day."} ✓ means that flock has been recorded for the date.</p>
      </section>

      {batchId && <section className="card form grid2">
        <h3 className="wide">2. Flock: feed, deaths and eggs</h3>
        <label>Feed type<select value={f.feedType} onChange={set("feedType")}>{tn.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Feed given (kg)<input type="number" min="0" step="any" value={f.feedKg} onChange={set("feedKg")} /></label>
        <label>Birds died<input type="number" min="0" value={f.deaths} onChange={set("deaths")} /></label>
        <label>Birds culled or sold<input type="number" min="0" value={f.culled} onChange={set("culled")} /></label>
        <label>Eggs collected<input type="number" min="0" value={f.eggs} onChange={set("eggs")} /></label>
        <label>Eggs broken<input type="number" min="0" value={f.broken} onChange={set("broken")} /></label>
        <label className="wide">Note (optional)<input value={f.note} onChange={set("note")} /></label>
        {n(f.eggs) > 0 && <p className="muted wide">That is {nf((n(f.eggs) - n(f.broken)) / TRAY, 1)} trays of good eggs added to stock.</p>}
      </section>}

      <section className="card form grid2">
        <h3 className="wide">3. Supplies and stock</h3>
        <label>Feed bought for {fn[farmId] || "this farm"} (kg)<input type="number" min="0" value={x.feedKg} onChange={setx("feedKg")} /></label>
        <label>Feed cost (₹)<input type="number" min="0" value={x.feedCost} onChange={setx("feedCost")} /></label>
        <label>Boxes bought<input type="number" min="0" value={x.boxBought} onChange={setx("boxBought")} /></label>
        <label>Boxes cost (₹)<input type="number" min="0" value={x.boxCost} onChange={setx("boxCost")} /></label>
        <label>Boxes damaged or lost<input type="number" min="0" value={x.boxDamaged} onChange={setx("boxDamaged")} /></label>
        <label>Eggs lost, gifted or used at the farm<input type="number" min="0" value={x.eggLost} onChange={setx("eggLost")} /></label>
        {n(x.eggLost) > 0 && <label className="wide">Reason<input value={x.eggReason} onChange={setx("eggReason")} /></label>}
      </section>

      <section className="card form">
        <div className="bar"><h3>4. Expenses for the day</h3><button type="button" className="btn sm ghost" onClick={addLine}>Add expense</button></div>
        {!lines.length && <p className="muted">No new expenses added. Use “Add expense” for labour, electricity, medicine, repairs and so on.</p>}
        {lines.map((l) => (
          <div className="expline" key={l.id}>
            <select aria-label="Category" value={l.category} onChange={(e) => upLine(l.id, "category", e.target.value)}>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select aria-label="Farm" value={l.farmId} onChange={(e) => upLine(l.id, "farmId", e.target.value)}><option value="all">All farms (shared)</option>{F.farms.map((fm) => <option key={fm.id} value={fm.id}>{fm.name}</option>)}</select>
            <input aria-label="Amount" type="number" min="0" placeholder="Amount (₹)" value={l.amount} onChange={(e) => upLine(l.id, "amount", e.target.value)} />
            <input aria-label="Note" placeholder="Note (optional)" value={l.note} onChange={(e) => upLine(l.id, "note", e.target.value)} />
            <button type="button" className="link" onClick={() => setLines(lines.filter((q) => q.id !== l.id))}>Remove</button>
          </div>))}
        {!!dayExp.length && <p className="muted">Already recorded for {date}: {dayExp.map((e) => `${e.category} ${inr(e.amount)} (${e.farmId === "all" ? "shared" : fn[e.farmId]?.split(" · ")[0] || ""})`).join(", ")}.</p>}
      </section>

      <section className="card form grid2">
        <h3 className="wide">5. Walk-in sale at the farm gate (optional)</h3>
        <label>Product<select value={x.saleProduct} onChange={setx("saleProduct")}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Trays sold<input type="number" min="0" value={x.saleTrays} onChange={setx("saleTrays")} /></label>
        <label>Price per tray (₹, blank = list price)<input type="number" min="0" value={x.salePrice} onChange={setx("salePrice")} /></label>
      </section>

      <div className="card savebar"><button type="button" className="btn" onClick={save}>Save today's update</button><Msg m={msg} /></div>

      {!!dayLogs.length && <section className="card"><h3>Recorded for {date}</h3><div className="scroll"><table><thead><tr><th>Farm</th><th>Flock</th><th>Feed (kg)</th><th>Died</th><th>Culled</th><th>Eggs</th><th>Broken</th></tr></thead>
        <tbody>{dayLogs.map((l) => { const b = F.batches.find((q) => q.id === l.batchId); return <tr key={l.id}><td>{fn[b?.farmId] || "–"}</td><td>{bn[l.batchId] || "–"}</td><td>{l.feedKg}</td><td>{l.deaths}</td><td>{l.culled}</td><td>{l.eggs}</td><td>{l.broken}</td></tr>; })}</tbody></table></div></section>}
    </>
  );
}
