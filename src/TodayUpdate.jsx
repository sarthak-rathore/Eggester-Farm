import React, { useState, useEffect } from "react";
import { useFarmData, useAnalysis, TRAY, EXP_CATS, FEED_CAT, MED_CAT, LABOR_CAT, PACK_CAT, rawStock } from "./farm.js";
import { inr, today, uid } from "./store.js";
import { Kpi, Alerts, nf } from "./charts.jsx";
import { Msg, Num, Qty, Sect } from "./ui.jsx";
import { WUNITS, toBase, kgText } from "./units.js";
import { n, addExpense, addPurchase, makeFeed, makeSaleOrder, unitPrice, saleEggs } from "./actions.js";

const CAUSES = ["Not known", "Sickness", "Heat or cold", "Accident or animal", "Old age", "Other"];
const blank = (feedType) => ({ eggs: "", broken: "", deaths: "", cause: "Not known", culled: "", feedType, feed: { q: "", u: "Kg" }, note: "" });

export default function TodayUpdate({ batchId, orders, setOrders, txns, products }) {
  const F = useFarmData(); const A = useAnalysis(orders, txns, batchId);
  const batch = F.batches.find((b) => b.id === batchId);
  const [date, setDate] = useState(today());
  const existing = F.logs.find((l) => l.date === date && l.batchId === batchId);
  const layer = F.types.find((t) => /layer/i.test(t.name))?.id || F.types[0]?.id || "";
  const [f, setF] = useState(blank(layer)); const [extra, setExtra] = useState({});
  const [sales, setSales] = useState([]); const [exps, setExps] = useState([]); const [buy, setBuy] = useState({ feedType: layer, feed: { q: "", u: "Kg" }, feedCost: "", rawLines: [], trays: "", trayCost: "", boxes: "", boxCost: "", trayLost: "", boxLost: "" });
  const [mx, setMx] = useState({ on: false, feedType: layer, kg: "", recipe: "", lines: [] }); const [msg, setMsg] = useState("");
  useEffect(() => {
    setF(existing ? { eggs: String(existing.eggs ?? ""), broken: String(existing.broken ?? ""), deaths: String(existing.deaths ?? ""), cause: existing.cause || "Not known", culled: String(existing.culled ?? ""), feedType: existing.feedType, feed: { q: String(existing.feedKg ?? ""), u: "Kg" }, note: existing.note || "" } : blank(layer));
    setExtra(existing?.extra || {});
  }, [date, batchId, existing?.id]);
  if (!batch) return <p className="muted">Open a farm first.</p>;

  const perBox = +F.boxCfg.perBox || 9;
  const customers = [{ id: "", name: "Walk-in sale", phone: "", address: "Farm gate" }, ...F.cust];
  const row = A.rows.find((r) => r.date === date) || {};
  const dayLogs = F.logs.filter((l) => l.date === date && l.batchId === batchId);
  const addSale = () => setSales([...sales, { id: uid(), custId: "", productId: products[0]?.id || "", unit: "Box", qty: "", price: "", paid: "Paid" }]);
  const upSale = (id, k, v) => setSales(sales.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const addExp = () => setExps([...exps, { id: uid(), category: EXP_CATS[3], sub: "", amount: "", note: "" }]);
  const upExp = (id, k, v) => setExps(exps.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const addRaw = () => setBuy({ ...buy, rawLines: [...buy.rawLines, { id: uid(), itemId: F.raw[0]?.id || "", q: "", u: "Kg", cost: "" }] });
  const upRaw = (id, k, v) => setBuy({ ...buy, rawLines: buy.rawLines.map((s) => (s.id === id ? { ...s, [k]: v } : s)) });
  const unitsOf = (itemId) => (F.raw.find((r) => r.id === itemId)?.unit === "ltr" ? ["Litre"] : WUNITS);
  const pickRecipe = (id) => { const r = F.recipes.find((x) => x.id === id); if (!r) return setMx({ ...mx, recipe: "", lines: [] }); const kg = n(mx.kg) || 100, sc = kg / 100; setMx({ ...mx, recipe: id, feedType: r.feedType || mx.feedType, kg: String(kg), lines: r.lines.map((l) => ({ id: uid(), itemId: l.itemId, qty: String(Math.round(l.kg * sc * 100) / 100) })) }); };
  const rescale = (kg) => { const r = F.recipes.find((x) => x.id === mx.recipe); setMx({ ...mx, kg, lines: r && n(kg) > 0 ? r.lines.map((l) => ({ id: uid(), itemId: l.itemId, qty: String(Math.round(l.kg * (n(kg) / 100) * 100) / 100) })) : mx.lines }); };
  const stockHere = rawStock({ rawBuy: F.rawBuy, mix: F.mix }, batch.farmId);

  const save = () => {
    const done = [];
    // 1. eggs available for sale (after today's eggs are added)
    const oldGood = existing ? n(existing.eggs) - n(existing.broken) : 0, newGood = n(f.eggs) - n(f.broken);
    const wantEggs = sales.filter((s) => n(s.qty) > 0).reduce((a, s) => a + saleEggs(s, perBox), 0);
    if (wantEggs > A.tot.stockEggs + (newGood - oldGood) + 1e-9) return setMsg(`e|You are selling more eggs than you have. In stock: ${nf(Math.floor((A.tot.stockEggs + newGood - oldGood) / TRAY))} trays. Check the sales or add today's eggs.`);
    if (mx.on && mx.lines.some((l) => n(l.qty) > 0)) { const e = makeFeed(F, batch, { date, feedType: mx.feedType, kg: n(mx.kg), lines: mx.lines }); if (e) return setMsg("e|" + e); done.push("feed made"); }
    // 2. the flock's day
    const kg = toBase(f.feed.q, f.feed.u);
    if (kg || n(f.deaths) || n(f.culled) || n(f.eggs) || n(f.broken) || Object.values(extra).some(Boolean)) {
      const rec = { id: existing?.id || uid(), date, batchId, feedType: f.feedType, feedKg: kg, deaths: n(f.deaths), cause: f.cause, culled: n(f.culled), eggs: n(f.eggs), broken: n(f.broken), note: f.note, extra };
      F.setLogs((ls) => (existing ? ls.map((l) => (l.id === existing.id ? rec : l)) : [rec, ...ls])); done.push("eggs, birds and feed");
    }
    // 3. sales
    sales.filter((s) => n(s.qty) > 0).forEach((s) => {
      const p = products.find((q) => q.id === s.productId) || products[0]; if (!p) return;
      const c = customers.find((x) => x.id === s.custId) || customers[0];
      setOrders((os) => [makeSaleOrder(batch, { ...s, cust: c }, p, date, perBox), ...os]);
    });
    if (wantEggs > 0) done.push(`${sales.filter((s) => n(s.qty) > 0).length} sale(s)`);
    // 4. purchases
    const sup = { date };
    if (n(buy.feed.q) > 0) { addPurchase(F, batch, "feed", { ...sup, feedType: buy.feedType, kg: toBase(buy.feed.q, buy.feed.u), cost: buy.feedCost }); done.push("feed bought"); }
    buy.rawLines.filter((l) => n(l.q) > 0).forEach((l) => addPurchase(F, batch, "raw", { ...sup, itemId: l.itemId, qty: toBase(l.q, l.u), cost: l.cost }));
    if (buy.rawLines.some((l) => n(l.q) > 0)) done.push("raw materials bought");
    if (n(buy.trays) > 0) { addPurchase(F, batch, "trays", { ...sup, qty: buy.trays, cost: buy.trayCost }); done.push("trays bought"); }
    if (n(buy.boxes) > 0) { addPurchase(F, batch, "boxes", { ...sup, qty: buy.boxes, cost: buy.boxCost }); done.push("boxes bought"); }
    if (n(buy.trayLost) > 0) { F.setTrayAdj((a) => [{ id: uid(), date, qty: -n(buy.trayLost), reason: "Damaged" }, ...a]); done.push("damaged trays"); }
    if (n(buy.boxLost) > 0) { F.setBoxAdj((a) => [{ id: uid(), date, qty: -n(buy.boxLost), reason: "Damaged" }, ...a]); done.push("damaged boxes"); }
    // 5. expenses
    const goodE = exps.filter((e) => n(e.amount) > 0);
    goodE.forEach((e) => (e.category === MED_CAT ? addPurchase(F, batch, "medicine", { date, cost: e.amount, sub: e.sub || "Medicine", note: e.note }) : addExpense(F, batch, { date, category: e.category, amount: e.amount, note: e.note, sub: e.sub })));
    if (goodE.length) done.push(`${goodE.length} expense(s)`);
    if (!done.length) return setMsg("e|Nothing to save yet. Fill in some of today's numbers first.");
    setSales([]); setExps([]); setMx({ ...mx, on: false, kg: "", recipe: "", lines: [] });
    setBuy({ feedType: layer, feed: { q: "", u: "Kg" }, feedCost: "", rawLines: [], trays: "", trayCost: "", boxes: "", boxCost: "", trayLost: "", boxLost: "" });
    setMsg(`s|Saved for ${date}: ${done.join(", ")}. Stock, money and reports are updated.`);
  };
  const prod = products.find((p) => p.id === sales[0]?.productId) || products[0];
  const setFv = (k) => (v) => setF({ ...f, [k]: v });
  const openTasks = F.tasks.filter((t) => t.status === "Open" && (!t.batchId || t.batchId === batchId) && t.date <= today());

  return (
    <>
      <div className="bar"><h2>Today's Update <small className="hi">आज का हिसाब</small></h2>
        <label className="inl">Date<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></label></div>
      <p className="muted">Fill in what happened today and press <b>Save</b> at the bottom. Leave empty what did not happen. Stock, money and reports update by themselves.</p>
      <Alerts list={A.alerts} />
      {!!openTasks.length && <div className="alerts">{openTasks.map((t) => <div key={t.id} className="alert info">Reminder: {t.title}</div>)}</div>}
      <div className="kpis"><Kpi l={date === today() ? "Eggs today" : "Eggs that day"} v={nf(row.eggs)} /><Kpi l="Birds died" v={nf(row.deaths)} t={row.deaths ? "bad" : "good"} /><Kpi l="Eggs ready to sell" v={nf(A.tot.stockTrays) + " trays"} t={A.tot.stockTrays < 20 ? "bad" : "good"} /><Kpi l="Feed left" v={nf(A.tot.feedLeft) + " kg"} /></div>
      {existing && <p className="hint">You already saved eggs, birds and feed for this day. Saving again will replace those numbers (sales and expenses are added, not replaced).</p>}

      <Sect n="1" title="Eggs" hint="How many eggs today" open>
        <Num label="Eggs collected" v={f.eggs} set={setFv("eggs")} />
        <Num label="Eggs broken" v={f.broken} set={setFv("broken")} />
        {n(f.eggs) > 0 && <p className="muted wide">That is {nf((n(f.eggs) - n(f.broken)) / TRAY, 1)} trays of good eggs. They are added to your stock.</p>}
      </Sect>

      <Sect n="2" title="Birds" hint="Deaths and birds sold" open>
        <Num label="Birds died" v={f.deaths} set={setFv("deaths")} />
        {n(f.deaths) > 0 && <label>Why did they die?<select value={f.cause} onChange={(e) => setFv("cause")(e.target.value)}>{CAUSES.map((c) => <option key={c}>{c}</option>)}</select></label>}
        <Num label="Birds sold or removed" v={f.culled} set={setFv("culled")} />
      </Sect>

      <Sect n="3" title="Feed given today" hint="How much feed the birds ate" open>
        <label>Which feed<select value={f.feedType} onChange={(e) => setFv("feedType")(e.target.value)}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <Qty label="How much" v={f.feed} set={setFv("feed")} hint={f.feed.q ? `= ${kgText(toBase(f.feed.q, f.feed.u))}` : "Kg, Quintal or Ton"} />
      </Sect>

      <Sect n="4" title="Sales today" hint="Eggs sold. Boxes, trays and eggs go down automatically">
        <div className="wide">
          {!sales.length && <p className="muted">No sale added. Tap “Add a sale” if you sold eggs today.</p>}
          {sales.map((s) => { const p = products.find((q) => q.id === s.productId) || prod, up = unitPrice(p, s.unit, s.qty, perBox), tot = n(s.qty) * (n(s.price) || up); return (
            <div className="line3" key={s.id}>
              <label>Customer<select value={s.custId} onChange={(e) => upSale(s.id, "custId", e.target.value)}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              {products.length > 1 && <label>Egg type<select value={s.productId} onChange={(e) => upSale(s.id, "productId", e.target.value)}>{products.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label>}
              <label>Sold in<select value={s.unit} onChange={(e) => upSale(s.id, "unit", e.target.value)}><option value="Box">Box ({perBox} trays = {perBox * TRAY} eggs)</option><option value="Tray">Tray ({TRAY} eggs)</option><option value="Egg">Single eggs</option></select></label>
              <Num label="How many" v={s.qty} set={(v) => upSale(s.id, "qty", v)} />
              <Num label={`Price per ${s.unit.toLowerCase()} (₹)`} v={s.price} set={(v) => upSale(s.id, "price", v)} placeholder={String(up)} />
              <label>Payment<select value={s.paid} onChange={(e) => upSale(s.id, "paid", e.target.value)}><option value="Paid">Money received</option><option value="Pending">Money pending (udhaar)</option></select></label>
              <p className="muted">{n(s.qty) > 0 ? `${nf(saleEggs(s, perBox))} eggs = ${nf(saleEggs(s, perBox) / TRAY, 1)} trays${s.unit === "Box" ? ` · ${nf(n(s.qty))} boxes` : ""} · Total ${inr(tot)}` : ""}</p>
              <button type="button" className="link" onClick={() => setSales(sales.filter((q) => q.id !== s.id))}>Remove</button>
            </div>); })}
          <button type="button" className="btn sm ghost" onClick={addSale}>+ Add a sale</button>
        </div>
      </Sect>

      <Sect n="5" title="Expenses today" hint="Salary, electricity, transport, medicine and so on">
        <div className="wide">
          {!exps.length && <p className="muted">No expense added. Feed, raw materials, trays and boxes are bought in step 6.</p>}
          {exps.map((e) => (
            <div className="line3" key={e.id}>
              <label>What for<select value={e.category} onChange={(x) => upExp(e.id, "category", x.target.value)}>{EXP_CATS.filter((c) => ![FEED_CAT, PACK_CAT, EXP_CATS[1]].includes(c)).map((c) => <option key={c}>{c}</option>)}</select></label>
              {e.category === MED_CAT && <label>Kind<select value={e.sub || "Medicine"} onChange={(x) => upExp(e.id, "sub", x.target.value)}><option>Medicine</option><option>Vaccine</option></select></label>}
              <Num label="Amount (₹)" v={e.amount} set={(v) => upExp(e.id, "amount", v)} />
              <label>Note (optional)<input value={e.note} onChange={(x) => upExp(e.id, "note", x.target.value)} /></label>
              <button type="button" className="link" onClick={() => setExps(exps.filter((q) => q.id !== e.id))}>Remove</button>
            </div>))}
          <button type="button" className="btn sm ghost" onClick={addExp}>+ Add an expense</button>
        </div>
      </Sect>

      <Sect n="6" title="Things bought today" hint="Feed, raw materials, trays, boxes. Stock goes up and the cost is saved as an expense">
        <h4 className="wide">Ready-made feed</h4>
        <label>Which feed<select value={buy.feedType} onChange={(e) => setBuy({ ...buy, feedType: e.target.value })}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <Qty label="How much bought" v={buy.feed} set={(v) => setBuy({ ...buy, feed: v })} />
        <Num label="Total cost (₹)" v={buy.feedCost} set={(v) => setBuy({ ...buy, feedCost: v })} />
        <h4 className="wide">Raw materials (maize, soybean, bran…)</h4>
        <div className="wide">
          {buy.rawLines.map((l) => (
            <div className="line3" key={l.id}>
              <label>Material<select value={l.itemId} onChange={(e) => upRaw(l.id, "itemId", e.target.value)}>{F.raw.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <Qty label="How much" v={{ q: l.q, u: unitsOf(l.itemId).includes(l.u) ? l.u : unitsOf(l.itemId)[0] }} units={unitsOf(l.itemId)} set={(v) => setBuy({ ...buy, rawLines: buy.rawLines.map((s) => (s.id === l.id ? { ...s, q: v.q, u: v.u } : s)) })} />
              <Num label="Total cost (₹)" v={l.cost} set={(v) => upRaw(l.id, "cost", v)} />
              <button type="button" className="link" onClick={() => setBuy({ ...buy, rawLines: buy.rawLines.filter((q) => q.id !== l.id) })}>Remove</button>
            </div>))}
          <button type="button" className="btn sm ghost" onClick={addRaw}>+ Add raw material</button>
        </div>
        <h4 className="wide">Empty trays and boxes</h4>
        <Num label="Trays bought" v={buy.trays} set={(v) => setBuy({ ...buy, trays: v })} /><Num label="Trays cost (₹)" v={buy.trayCost} set={(v) => setBuy({ ...buy, trayCost: v })} />
        <Num label="Boxes bought" v={buy.boxes} set={(v) => setBuy({ ...buy, boxes: v })} /><Num label="Boxes cost (₹)" v={buy.boxCost} set={(v) => setBuy({ ...buy, boxCost: v })} />
        <Num label="Trays damaged" v={buy.trayLost} set={(v) => setBuy({ ...buy, trayLost: v })} /><Num label="Boxes damaged" v={buy.boxLost} set={(v) => setBuy({ ...buy, boxLost: v })} />
      </Sect>

      <Sect n="7" title="Made your own feed today?" hint="Raw material goes down, feed goes up, cost is worked out">
        <label className="radio wide"><input type="checkbox" checked={mx.on} onChange={(e) => setMx({ ...mx, on: e.target.checked })} />Yes, I mixed feed today</label>
        {mx.on && <>
          <label>Use a saved recipe<select value={mx.recipe} onChange={(e) => pickRecipe(e.target.value)}><option value="">Choose (or fill in below)</option>{F.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Feed made<select value={mx.feedType} onChange={(e) => setMx({ ...mx, feedType: e.target.value })}>{F.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <Num label="How many kg made" v={mx.kg} set={rescale} />
          <div className="wide">
            {mx.lines.map((l) => (
              <div className="line3" key={l.id}><label>Material<select value={l.itemId} onChange={(e) => setMx({ ...mx, lines: mx.lines.map((q) => (q.id === l.id ? { ...q, itemId: e.target.value } : q)) })}>{F.raw.map((r) => <option key={r.id} value={r.id}>{r.name} (in stock {nf(stockHere[r.id] || 0, 1)} {r.unit})</option>)}</select></label>
                <Num label={`Used (${F.raw.find((r) => r.id === l.itemId)?.unit || "kg"})`} v={l.qty} set={(v) => setMx({ ...mx, lines: mx.lines.map((q) => (q.id === l.id ? { ...q, qty: v } : q)) })} />
                <button type="button" className="link" onClick={() => setMx({ ...mx, lines: mx.lines.filter((q) => q.id !== l.id) })}>Remove</button></div>))}
            <button type="button" className="btn sm ghost" onClick={() => setMx({ ...mx, lines: [...mx.lines, { id: uid(), itemId: F.raw[0]?.id || "", qty: "" }] })}>+ Add material</button>
          </div></>}
      </Sect>

      {!!F.cf.length && <Sect n="8" title="Your own notes" hint="Fields you added in Settings">
        {F.cf.map((c) => <label key={c.id}>{c.label}<input type={c.type === "number" ? "number" : "text"} value={extra[c.id] ?? ""} onChange={(e) => setExtra({ ...extra, [c.id]: e.target.value })} /></label>)}
      </Sect>}
      <Sect n={F.cf.length ? "9" : "8"} title="Note for today" hint="Anything you want to remember (optional)"><label className="wide">Note<input value={f.note} onChange={(e) => setFv("note")(e.target.value)} /></label></Sect>

      <div className="card savebar"><button type="button" className="btn big" onClick={save}>Save today's update</button><Msg m={msg} /></div>

      <SavedToday date={date} batchId={batchId} F={F} orders={orders} setOrders={setOrders} dayLogs={dayLogs} />
    </>
  );
}

/* what is already saved for the day, with a delete button for every line */
function SavedToday({ date, batchId, F, orders, setOrders }) {
  const mine = (r) => r.date === date && r.batchId === batchId;
  const items = [
    ...orders.filter((o) => mine(o)).map((o) => ({ k: "o" + o.id, t: "Sale", text: `${o.items.map((i) => `${i.qty} ${i.unit}`).join(", ")} to ${o.name}, ${inr(o.total)}${o.payStatus === "Unpaid" ? " (money pending)" : ""}`, del: () => setOrders((os) => os.filter((x) => x.id !== o.id)) })),
    ...F.exp.filter(mine).map((e) => ({ k: "e" + e.id, t: "Expense", text: `${e.category}${e.sub ? " · " + e.sub : ""}, ${inr(e.amount)}${e.note ? " (" + e.note + ")" : ""}`, del: () => F.setExp((a) => a.filter((x) => x.id !== e.id)) })),
    ...F.feed.filter(mine).map((x) => ({ k: "f" + x.id, t: "Feed bought", text: `${x.kg} kg, ${inr(x.cost)}`, del: () => F.setFeed((a) => a.filter((q) => q.id !== x.id)) })),
    ...F.rawBuy.filter(mine).map((x) => ({ k: "w" + x.id, t: "Raw material bought", text: `${F.raw.find((r) => r.id === x.itemId)?.name || ""} ${x.qty}, ${inr(x.cost)}`, del: () => F.setRawBuy((a) => a.filter((q) => q.id !== x.id)) })),
    ...F.mix.filter(mine).map((x) => ({ k: "m" + x.id, t: "Feed made", text: `${x.kg} kg, cost ${inr(x.cost)}`, del: () => F.setMix((a) => a.filter((q) => q.id !== x.id)) })),
    ...F.trays.filter(mine).map((x) => ({ k: "t" + x.id, t: "Trays bought", text: `${x.qty}, ${inr(x.cost)}`, del: () => F.setTrays((a) => a.filter((q) => q.id !== x.id)) })),
    ...F.boxes.filter(mine).map((x) => ({ k: "x" + x.id, t: "Boxes bought", text: `${x.qty}, ${inr(x.cost)}`, del: () => F.setBoxes((a) => a.filter((q) => q.id !== x.id)) })),
  ];
  return (
    <section className="card"><h3>Already saved for {date}</h3>
      {!items.length && <p className="muted">Sales, expenses and purchases you save will be listed here. Made a mistake? Delete the line and enter it again.</p>}
      {items.map((i) => <div className="line" key={i.k}><span><b>{i.t}:</b> {i.text}</span><button className="link" onClick={() => confirm("Delete this entry? Stock and money will adjust automatically.") && i.del()}>Delete</button></div>)}
    </section>
  );
}
