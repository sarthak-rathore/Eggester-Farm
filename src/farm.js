import { useMemo } from "react";
import { useLS, uid } from "./store.js";
import { SEED_PRODUCTS } from "./config.js";

export const TRAY = 30;
export const EXP_CATS = ["Labour", "Electricity", "Water & maintenance", "Medicine & vaccines", "Transport", "Packaging", "Repairs", "Rent", "Fuel", "Other"];
export const LAY_AGE = 126; // days: hens older than 18 weeks are counted as laying
export const DEFAULT_TYPES = [
  { id: "ft1", name: "Chick starter", protein: 20, energy: 2900 },
  { id: "ft2", name: "Grower", protein: 16, energy: 2750 },
  { id: "ft3", name: "Layer", protein: 17, energy: 2700 },
];
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => ymd(new Date(s + "T00:00:00Z").getTime() + n * 864e5);
const sum = (a, f) => a.reduce((x, y) => x + (+f(y) || 0), 0);
const by = (arr, kf, vf) => { const m = {}; arr.forEach((x) => { const k = kf(x); m[k] = (m[k] || 0) + (+vf(x) || 0); }); return m; };
const r1 = (n) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n * 10) / 10);
export const upsert = (set) => ({ onSave: (r) => set((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [r, ...rs])), onDelete: (id) => set((rs) => rs.filter((x) => x.id !== id)) });

/* ---------- bulk prices ---------- */
export function tiers(p) {
  const t = String(p.tiers || "").split(",").map((s) => s.trim().split(":").map(Number)).filter(([m, pr]) => m > 0 && pr > 0).map(([min, price]) => ({ min, price }));
  return [{ min: +p.moq || 1, price: +p.price }, ...t].sort((a, b) => a.min - b.min);
}
export const tierPrice = (p, qty) => tiers(p).filter((t) => qty >= t.min).pop()?.price ?? +p.price;
export const stepQty = (p, cur, d, max) => { const moq = +p.moq || 1; const n = d > 0 && cur === 0 ? moq : d < 0 && cur <= moq ? 0 : cur + d; return Math.max(0, Math.min(max, n)); };
export const makeLines = (products, cart, stockOf) => products.filter((p) => cart[p.id] > 0 && p.active !== "No").map((p) => {
  const qty = Math.min(cart[p.id], stockOf(p));
  return { id: p.id, name: p.name, unit: p.unit || "tray", price: tierPrice(p, qty), base: +p.price, qty, moq: +p.moq || 1, eggs: +p.eggs || TRAY };
}).filter((l) => l.qty > 0);

/* ---------- egg stock (derived: collected - broken - sold + adjustments) ---------- */
export const eggsOfOrder = (o) => (o.items || []).reduce((s, i) => s + i.qty * (i.eggs || TRAY), 0);
export const poolEggs = (logs, orders, adj) => Math.max(0, sum(logs, (l) => (+l.eggs || 0) - (+l.broken || 0)) + sum(adj, (a) => a.eggs) - sum(orders.filter((o) => o.status !== "Cancelled"), eggsOfOrder));
export function useStock(orders) {
  const [logs] = useLS("kf_logs", []); const [adj] = useLS("kf_adj", []);
  const pool = poolEggs(logs, orders, adj);
  return { pool, stockOf: (p) => Math.max(0, Math.floor(pool / (+p.eggs || TRAY))) };
}

/* ---------- farm data hook ---------- */
export function useFarmData() {
  const [farms, setFarms] = useLS("kf_farms", []);
  const [batches, setBatches] = useLS("kf_batches", []);
  const [logs, setLogs] = useLS("kf_logs", []);
  const [feed, setFeed] = useLS("kf_feed", []);
  const [types, setTypes] = useLS("kf_ftypes", DEFAULT_TYPES);
  const [adj, setAdj] = useLS("kf_adj", []);
  const [exp, setExp] = useLS("kf_exp", []);
  const [boxes, setBoxes] = useLS("kf_boxes", []);
  const [boxAdj, setBoxAdj] = useLS("kf_boxadj", []);
  const [boxCfg, setBoxCfg] = useLS("kf_boxcfg", { perBox: 12, alert: 20 });
  return { farms, setFarms, batches, setBatches, logs, setLogs, feed, setFeed, types, setTypes, adj, setAdj, exp, setExp, boxes, setBoxes, boxAdj, setBoxAdj, boxCfg, setBoxCfg };
}
export function useAnalysis(orders, txns, batchId = "", farmId = "") {
  const F = useFarmData();
  return useMemo(() => analyze({ ...F, orders, txns }, batchId, farmId), [F.farms, F.batches, F.logs, F.feed, F.types, F.adj, F.exp, F.boxes, F.boxAdj, F.boxCfg, orders, txns, batchId, farmId]);
}

/* ---------- per-batch performance ---------- */
export function batchStats(b, D) {
  const today = ymd(Date.now());
  const L = D.logs.filter((l) => l.batchId === b.id);
  const died = sum(L, (l) => l.deaths), culled = sum(L, (l) => l.culled);
  const alive = Math.max(0, (+b.count || 0) - died - culled);
  const age = Math.floor((Date.now() - new Date(b.date).getTime()) / 864e5 + (+b.ageDays || 0));
  const w = L.filter((l) => l.date > addDays(today, -7));
  const days = new Set(w.map((l) => l.date)).size || 1;
  return { alive, died, culled, age, weeks: Math.floor(age / 7), mortPct: b.count ? (died / b.count) * 100 : 0,
    gPerBird: alive ? (sum(w, (l) => l.feedKg) * 1000) / (alive * days) : 0,
    hdp: age >= LAY_AGE && alive ? (sum(w, (l) => l.eggs) / (alive * days)) * 100 : null,
    eggs: sum(L, (l) => l.eggs), feedKg: sum(L, (l) => l.feedKg), laying: age >= LAY_AGE };
}

/* ---------- the main analysis (optionally for one farm and/or one flock) ---------- */
export function analyze(D, batchId = "", farmId = "") {
  const { farms = [], batches, logs, feed, types, adj, orders, txns, exp = [], boxes = [], boxAdj = [], boxCfg = {} } = D;
  const perBox = +boxCfg.perBox || 12, boxAlert = +boxCfg.alert || 20;
  const today = ymd(Date.now());
  const bOf = Object.fromEntries(batches.map((b) => [b.id, b]));
  const effFarm = farmId || (batchId ? bOf[batchId]?.farmId || "" : "");
  const fb = batches.filter((b) => (!batchId || b.id === batchId) && (!farmId || b.farmId === farmId));
  const ids = new Set(fb.map((b) => b.id));
  const fl = logs.filter((l) => ids.has(l.batchId));
  const farmLogs = logs.filter((l) => !effFarm || bOf[l.batchId]?.farmId === effFarm);
  const T = Object.fromEntries(types.map((t) => [t.id, t]));
  const live = orders.filter((o) => o.status !== "Cancelled"), delivered = orders.filter((o) => o.status === "Delivered");
  const manual = (ty) => txns.filter((t) => t.type === ty);
  const global = !effFarm;
  const avgFeedPrice = sum(feed, (f) => f.cost) / (sum(feed, (f) => f.kg) || 1) || 30;
  const feedS = feed.filter((f) => !effFarm || f.farmId === effFarm), expS = exp.filter((e) => !effFarm || e.farmId === effFarm);
  const share = effFarm ? sum(fl, (l) => (+l.eggs || 0) - (+l.broken || 0)) / (sum(logs, (l) => (+l.eggs || 0) - (+l.broken || 0)) || 1) : 1;
  const starts = [...batches.map((b) => b.date), ...logs.map((l) => l.date), ...feed.map((f) => f.date), ...orders.map((o) => o.date), ...txns.map((t) => t.date), ...adj.map((a) => a.date), ...exp.map((e) => e.date), ...boxes.map((x) => x.date), ...boxAdj.map((x) => x.date)].filter(Boolean).sort();
  const dates = []; for (let d = starts[0] || today; d <= today && dates.length < 1500; d = addDays(d, 1)) dates.push(d);
  const lk = (l) => l.date + "|" + l.batchId;
  const dM = by(fl, lk, (l) => l.deaths), cM = by(fl, lk, (l) => l.culled);
  const dD = by(fl, (l) => l.date, (l) => l.deaths), cD = by(fl, (l) => l.date, (l) => l.culled), eD = by(fl, (l) => l.date, (l) => l.eggs), bD = by(fl, (l) => l.date, (l) => l.broken), fD = by(fl, (l) => l.date, (l) => l.feedKg);
  const pD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * ((T[l.feedType]?.protein || 0) / 100)), nD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * (T[l.feedType]?.energy || 0));
  const goodAll = by(logs, (l) => l.date, (l) => (+l.eggs || 0) - (+l.broken || 0));
  const soldD = by(live, (o) => o.date, eggsOfOrder), revD = by(delivered, (o) => o.date, (o) => o.total), adjD = by(adj, (a) => a.date, (a) => a.eggs);
  const chickD = by(fb, (b) => b.date, (b) => (+b.count || 0) * (+b.chickCost || 0)), buyD = by(feedS, (f) => f.date, (f) => f.cost), expD = by(expS, (e) => e.date, (e) => e.amount);
  const boxBuyD = by(boxes, (x) => x.date, (x) => x.cost), boxQD = by(boxes, (x) => x.date, (x) => x.qty), boxAdjD = by(boxAdj, (x) => x.date, (x) => x.qty);
  const boxUsedD = by(live, (o) => o.date, (o) => Math.ceil(eggsOfOrder(o) / TRAY / perBox));
  const mExp = by(manual("expense"), (t) => t.date, (t) => t.amount), mRev = by(manual("revenue"), (t) => t.date, (t) => t.amount), mLoss = by(manual("loss"), (t) => t.date, (t) => t.amount);
  let stock = 0, boxStock = 0, cumDied = 0, cumBought = 0; const alive = {};
  const rows = dates.map((date) => {
    let a = 0, lay = 0;
    fb.forEach((b) => {
      if (b.date === date) { alive[b.id] = (alive[b.id] || 0) + (+b.count || 0); cumBought += +b.count || 0; }
      if (alive[b.id] !== undefined) { const k = date + "|" + b.id; alive[b.id] = Math.max(0, alive[b.id] - (dM[k] || 0) - (cM[k] || 0)); }
      const n = alive[b.id] || 0; a += n;
      if ((new Date(date) - new Date(b.date)) / 864e5 + (+b.ageDays || 0) >= LAY_AGE) lay += n;
    });
    cumDied += dD[date] || 0;
    stock += (goodAll[date] || 0) - (soldD[date] || 0) + (adjD[date] || 0);
    boxStock += (boxQD[date] || 0) + (boxAdjD[date] || 0) - (boxUsedD[date] || 0);
    const feedCost = (fD[date] || 0) * avgFeedPrice, extra = global ? (boxBuyD[date] || 0) + (mExp[date] || 0) : 0;
    return { date, alive: a, lay, deaths: dD[date] || 0, culled: cD[date] || 0, eggs: eD[date] || 0, broken: bD[date] || 0, good: (eD[date] || 0) - (bD[date] || 0),
      feedKg: fD[date] || 0, protein: pD[date] || 0, energy: nD[date] || 0, produced: (eD[date] || 0) - (bD[date] || 0), sold: (soldD[date] || 0) * share, stock: Math.max(0, stock),
      boxBought: boxQD[date] || 0, boxUsed: boxUsedD[date] || 0, boxStock: Math.max(0, boxStock),
      revenue: ((revD[date] || 0) + (mRev[date] || 0)) * share, expense: (chickD[date] || 0) + (buyD[date] || 0) + (expD[date] || 0) + extra, manLoss: global ? mLoss[date] || 0 : 0,
      feedCost, opCost: feedCost + (expD[date] || 0) + extra, cumDied, cumBought };
  });
  const last = rows[rows.length - 1] || {};
  const w7 = rows.slice(-7), bd7 = sum(w7, (r) => r.alive), ld7 = sum(w7, (r) => r.lay);
  const usedByType = by(farmLogs, (l) => l.feedType, (l) => l.feedKg), boughtByType = by(feedS, (f) => f.feedType, (f) => f.kg);
  const feedLeft = sum(feedS, (f) => f.kg) - sum(farmLogs, (l) => l.feedKg);
  const avgUse7 = sum(farmLogs.filter((l) => l.date > addDays(today, -7)), (l) => l.feedKg) / 7;
  const feedByType = types.map((t) => ({ name: t.name, kg: Math.max(0, Math.round((boughtByType[t.id] || 0) - (usedByType[t.id] || 0))) })).filter((t) => t.kg > 0);
  const delRev = sum(delivered, (o) => o.total), delEggs = sum(delivered, eggsOfOrder), eggPrice = delEggs ? delRev / delEggs : 7;
  const expBreak = {}; const add = (k, v) => { if (v) expBreak[k] = (expBreak[k] || 0) + v; };
  add("Chicks", sum(fb, (b) => (+b.count || 0) * (+b.chickCost || 0))); add("Feed", sum(feedS, (f) => f.cost)); if (global) add("Boxes", sum(boxes, (x) => x.cost));
  expS.forEach((e) => add(e.category || "Other", +e.amount)); if (global) manual("expense").forEach((t) => add(t.category || "Other", +t.amount));
  const buyers = {}; live.forEach((o) => { buyers[o.name] = (buyers[o.name] || 0) + eggsOfOrder(o) / TRAY; });
  const statusCount = {}; orders.forEach((o) => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
  const tot = {
    purchased: sum(fb, (b) => b.count), died: sum(fl, (l) => l.deaths), culled: sum(fl, (l) => l.culled), alive: last.alive || 0,
    feedKg: sum(fl, (l) => l.feedKg), eggs: sum(fl, (l) => l.eggs), broken: sum(fl, (l) => l.broken),
    stockEggs: last.stock || 0, stockTrays: Math.floor((last.stock || 0) / TRAY), producedTrays: sum(fl, (l) => (+l.eggs || 0) - (+l.broken || 0)) / TRAY,
    soldTrays: sum(live, eggsOfOrder) / TRAY, deliveredTrays: delEggs / TRAY, pendingTrays: (sum(live, eggsOfOrder) - delEggs) / TRAY,
    boxStock: last.boxStock || 0, boxBought: sum(boxes, (x) => x.qty), boxUsed: sum(rows, (r) => r.boxUsed), boxLost: -sum(boxAdj, (x) => x.qty), perBox,
    revenue: sum(rows, (r) => r.revenue), expense: sum(rows, (r) => r.expense), manLoss: sum(rows, (r) => r.manLoss),
    gPerBird7: bd7 ? (sum(w7, (r) => r.feedKg) * 1000) / bd7 : 0, protein7: bd7 ? (sum(w7, (r) => r.protein) * 1000) / bd7 : 0, energy7: bd7 ? sum(w7, (r) => r.energy) / bd7 : 0,
    hdp7: ld7 ? (sum(w7, (r) => r.eggs) / ld7) * 100 : null, mortalityValue: sum(fl, (l) => (+l.deaths || 0) * (+bOf[l.batchId]?.chickCost || 0)), brokenValue: sum(fl, (l) => l.broken) * eggPrice,
    feedLeft: Math.max(0, feedLeft), avgUse7, daysLeft: avgUse7 > 0 ? Math.max(0, feedLeft) / avgUse7 : null, avgFeedPrice,
  };
  tot.profit = tot.revenue - tot.expense - tot.manLoss; tot.mortPct = tot.purchased ? (tot.died / tot.purchased) * 100 : 0;
  const farmStats = farms.map((f) => {
    const bs = batches.filter((b) => b.farmId === f.id), idset = new Set(bs.map((b) => b.id)), L = logs.filter((l) => idset.has(l.batchId));
    const purchased = sum(bs, (b) => b.count), died = sum(L, (l) => l.deaths), culled = sum(L, (l) => l.culled);
    const lastDay = L.reduce((m, l) => (l.date > m ? l.date : m), "");
    return { farm: f, flocks: bs.length, purchased, died, culled, alive: Math.max(0, purchased - died - culled), mortPct: purchased ? (died / purchased) * 100 : 0, eggs: sum(L, (l) => l.eggs), trays: sum(L, (l) => (+l.eggs || 0) - (+l.broken || 0)) / TRAY,
      eggsToday: sum(L.filter((l) => l.date === today), (l) => l.eggs), feedKg: sum(L, (l) => l.feedKg), feedLeft: Math.max(0, sum(feed.filter((x) => x.farmId === f.id), (x) => x.kg) - sum(L, (l) => l.feedKg)), lastLog: lastDay,
      expense: sum(bs, (b) => (+b.count || 0) * (+b.chickCost || 0)) + sum(feed.filter((x) => x.farmId === f.id), (x) => x.cost) + sum(exp.filter((e) => e.farmId === f.id), (e) => e.amount) };
  });
  const alerts = [];
  if (tot.daysLeft !== null && tot.daysLeft < 7) alerts.push({ level: "bad", text: `Feed is running low: about ${r1(tot.daysLeft)} days left (${Math.round(tot.feedLeft)} kg).` });
  if (global && batches.length && tot.stockTrays < 20) alerts.push({ level: "warn", text: `Only ${tot.stockTrays} egg trays in stock.` });
  if (global && (boxes.length || boxAdj.length) && tot.boxStock < boxAlert) alerts.push({ level: "warn", text: `Only ${tot.boxStock} boxes left for packing trays.` });
  const avgDeaths = sum(rows.slice(-8, -1), (r) => r.deaths) / 7;
  if ((last.deaths || 0) >= Math.max(3, avgDeaths * 3)) alerts.push({ level: "bad", text: `Unusual deaths today: ${last.deaths} birds (normal is about ${r1(avgDeaths)} a day).` });
  if (tot.hdp7 !== null && tot.hdp7 < 70) alerts.push({ level: "warn", text: `Egg production is low: ${r1(tot.hdp7)}% of laying hens per day this week.` });
  const pend = orders.filter((o) => o.status === "Pending").length;
  if (pend) alerts.push({ level: "info", text: `${pend} order${pend > 1 ? "s" : ""} waiting for confirmation.` });
  return { rows, tot, alerts, feedByType, expBreak, buyers, statusCount, batches, farms, farmStats, perBatch: batches.map((b) => ({ b, ...batchStats(b, D) })) };
}

/* hens or eggs per day for every farm, for stacked charts */
export function farmSeries(D, field, n = 30) {
  const out = {};
  (D.farms || []).forEach((f) => analyze(D, "", f.id).rows.slice(-n).forEach((r) => { (out[r.date] = out[r.date] || { k: r.date })[f.name] = r[field]; }));
  return { data: Object.values(out).sort((a, b) => (a.k < b.k ? -1 : 1)), names: (D.farms || []).map((f) => f.name) };
}

/* ---------- chart series per day / month / year ---------- */
export function aggregate(rows, p) {
  const key = (d) => (p === "day" ? d : p === "month" ? d.slice(0, 7) : d.slice(0, 4));
  const F = ["deaths", "culled", "eggs", "broken", "good", "feedKg", "protein", "energy", "sold", "produced", "revenue", "expense", "manLoss", "opCost", "feedCost", "boxBought", "boxUsed"];
  const m = new Map();
  rows.forEach((r) => {
    let a = m.get(key(r.date));
    if (!a) { a = { k: key(r.date), birdDays: 0, layDays: 0 }; F.forEach((f) => (a[f] = 0)); m.set(a.k, a); }
    F.forEach((f) => (a[f] += r[f])); a.birdDays += r.alive; a.layDays += r.lay;
    a.alive = r.alive; a.stock = r.stock; a.boxStock = r.boxStock; a.cumDied = r.cumDied; a.cumBought = r.cumBought;
  });
  let out = [...m.values()]; out = p === "day" ? out.slice(-30) : p === "month" ? out.slice(-12) : out;
  return out.map((a) => ({ ...a, profit: a.revenue - a.expense - a.manLoss, gPerBird: r1(a.birdDays ? (a.feedKg * 1000) / a.birdDays : null), proteinG: r1(a.birdDays ? (a.protein * 1000) / a.birdDays : null),
    energyKcal: r1(a.birdDays ? a.energy / a.birdDays : null), hdp: r1(a.layDays && a.eggs ? (a.eggs / a.layDays) * 100 : null), fcr: r1(a.eggs ? a.feedKg / (a.eggs / 12) : null),
    producedTrays: r1(a.produced / TRAY), soldTrays: r1(a.sold / TRAY), stockTrays: Math.round(a.stock / TRAY), mortPct: r1(a.cumBought ? (a.cumDied / a.cumBought) * 100 : 0),
    costPerTray: r1(a.produced ? a.opCost / (a.produced / TRAY) : null), feedCostPerTray: r1(a.produced ? a.feedCost / (a.produced / TRAY) : null) }));
}

/* ---------- full ledger (automatic and manual) ---------- */
export function ledger(D) {
  const fn = Object.fromEntries((D.farms || []).map((f) => [f.id, f.name])); const bf = Object.fromEntries(D.batches.map((b) => [b.id, b.farmId]));
  const L = [];
  D.orders.filter((o) => o.status === "Delivered").forEach((o) => L.push({ id: "o" + o.id, date: o.date, type: "revenue", category: "Egg sales", amount: +o.total, note: `Order ${o.id}, ${o.name}`, farm: "", source: "Orders" }));
  D.batches.forEach((b) => L.push({ id: "b" + b.id, date: b.date, type: "expense", category: "Chicks", amount: (+b.count || 0) * (+b.chickCost || 0), note: `${b.count} chicks, ${b.name}`, farm: fn[b.farmId] || "", source: "Flocks" }));
  D.feed.forEach((f) => L.push({ id: "f" + f.id, date: f.date, type: "expense", category: "Feed", amount: +f.cost, note: `${f.kg} kg`, farm: fn[f.farmId] || "", source: "Feed" }));
  (D.boxes || []).forEach((x) => L.push({ id: "x" + x.id, date: x.date, type: "expense", category: "Boxes", amount: +x.cost, note: `${x.qty} boxes`, farm: "", source: "Boxes" }));
  (D.exp || []).forEach((e) => L.push({ id: "e" + e.id, date: e.date, type: "expense", category: e.category, amount: +e.amount, note: e.note || "", farm: e.farmId === "all" ? "All farms" : fn[e.farmId] || "", source: "Expenses" }));
  D.txns.forEach((t) => L.push({ ...t, farm: "", source: "Manual" }));
  return L.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- demo data: 3 farms ---------- */
export function seedDemo(withDemoUser = true) {
  const put = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); dispatchEvent(new CustomEvent("kf-ls", { detail: k })); };
  const today = ymd(Date.now()); const ago = (n) => addDays(today, -n); const rnd = (a, b) => a + Math.random() * (b - a);
  const farms = [{ id: "f1", name: "Farm 1 · Kesariya", location: "Kesariya" }, { id: "f2", name: "Farm 2 · Motihari", location: "Motihari" }, { id: "f3", name: "Farm 3 · Bettiah", location: "Bettiah" }];
  const mkB = (id, farmId, name, days, count, cost) => ({ id, farmId, name, breed: "White layer (day-old chicks)", date: ago(days), count, chickCost: cost, ageDays: 1, supplier: "Sunrise Hatchery", status: "Active", note: "" });
  const batches = [mkB("b1", "f1", "Batch A", 190, 500, 38), mkB("b2", "f1", "Batch B", 60, 300, 40), mkB("b3", "f2", "Batch C", 150, 400, 39), mkB("b4", "f3", "Batch D", 100, 350, 40)];
  const left = { b1: 190, b2: 60, b3: 150, b4: 100 }, alive = { b1: 500, b2: 300, b3: 400, b4: 350 }, fOf = { b1: "f1", b2: "f1", b3: "f2", b4: "f3" }, logs = [];
  for (let i = 190; i >= 0; i--) batches.forEach((b) => {
    if (i > left[b.id]) return;
    const age = left[b.id] - i + 1, n = alive[b.id];
    const deaths = Math.min(n, Math.round(n * (age < 14 ? 0.004 : age < 42 ? 0.0015 : 0.0004) * rnd(0.4, 1.6)));
    const g = age < 42 ? 10 + age : age < 126 ? 52 + (age - 42) * 0.45 : rnd(110, 118);
    const hdp = age >= 126 ? Math.min(0.92, 0.12 + Math.max(0, (age - 126) / 7) * 0.15) * rnd(0.96, 1.02) : 0, eggs = Math.round(n * hdp);
    logs.push({ id: uid(), date: ago(i), batchId: b.id, feedType: age < 42 ? "ft1" : age < 126 ? "ft2" : "ft3", feedKg: Math.round((n * g) / 100) / 10, deaths, culled: 0, eggs, broken: Math.round(eggs * rnd(0.008, 0.02)), note: "" });
    alive[b.id] = n - deaths;
  });
  const cons = {}; logs.forEach((l) => { const k = fOf[l.batchId] + "|" + l.feedType; (cons[k] = cons[k] || {})[l.date] = ((cons[k] || {})[l.date] || 0) + l.feedKg; });
  const price = { ft1: 36, ft2: 31, ft3: 29 }, feed = [];
  Object.entries(cons).forEach(([k, m]) => { const [farmId, t] = k.split("|"); let s = 0; for (let i = 190; i >= 0; i--) { const d = ago(i); if (s < (m[d] || 0)) { let need = 0; for (let j = 0; j < 14; j++) need += m[ago(i - j)] || 0; const kg = Math.max(50, Math.ceil(need / 50) * 50); feed.push({ id: uid(), date: d, farmId, feedType: t, kg, cost: Math.round(kg * price[t] * rnd(0.97, 1.03)), supplier: "Bihar Feeds" }); s += kg; } s -= m[d] || 0; } });
  const exp = [], ex = (i, farmId, category, amount, note = "") => exp.push({ id: uid(), date: ago(i), farmId, category, amount, note });
  farms.forEach((f, n) => { for (let i = 190 - n * 2; i >= 0; i -= 7) ex(i, f.id, "Labour", 3500 + n * 300); for (let i = 188 - n; i >= 0; i -= 30) ex(i, f.id, "Electricity", 2200 + n * 150); });
  for (let i = 186; i >= 0; i -= 30) ex(i, "all", "Transport", 6000, "Feed and egg transport");
  batches.forEach((b) => [7, 14, 28, 56].forEach((d) => left[b.id] - d >= 0 && ex(left[b.id] - d, b.farmId, "Medicine & vaccines", b.count * 3, "Vaccination round")));
  ex(70, "f2", "Repairs", 4200, "Shed roof"); ex(33, "f1", "Repairs", 1800, "Water line");
  const txns = []; const tx = (i, type, category, amount, note = "") => txns.push({ id: uid(), date: ago(i), type, category, amount, note });
  for (let i = 188; i >= 0; i -= 30) tx(i, "revenue", "Manure sale", 5000, "Droppings sold to farmers");
  tx(95, "loss", "Feed spoiled by rain", 2400); tx(40, "loss", "Damaged egg trays", 900);
  const boxes = [[62, 150], [30, 150], [8, 100]].map(([i, qty]) => ({ id: uid(), date: ago(i), qty, cost: qty * 55, supplier: "Pack & Ship" }));
  const products = [{ id: "p1", name: "Farm eggs, standard tray (30)", price: 210, tiers: "50:205,100:200,200:195", moq: 10 }, { id: "p2", name: "Large eggs, premium tray (30)", price: 235, tiers: "50:230,100:225", moq: 10 }];
  const cust = [["Sri Ram Sweets", "9810000011", "Main Bazar, Motihari"], ["Hotel Annapurna", "9810000022", "Station Road, Motihari"], ["City Bakery", "9810000033", "Bettiah Road, Kesariya"], ["Gupta General Store", "9810000044", "Chakia Chowk"], ["Maa Tara Caterers", "9810000055", "Ramgarhwa"]];
  const goodBy = by(logs, (l) => l.date, (l) => l.eggs - l.broken); let pool = -3500, k = 0; const orders = [];
  const mk = (id, date, c, pr, qty, status, userId, price2) => { const pr2 = price2 || tierPrice(pr, qty), subtotal = qty * pr2, delivery = subtotal >= 5000 ? 0 : 150, total = subtotal + delivery + 10;
    return { id, date, userId: userId || null, name: c[0], phone: c[1], address: c[2], note: "", items: [{ id: pr.id, name: pr.name, unit: "tray", price: pr2, qty, eggs: 30 }], subtotal, discount: 0, coupon: "", gst: 0, gstMode: "inclusive", delivery, charges: [{ label: "Packaging", amount: 10 }], total,
      payMethod: k % 3 ? "COD" : "UPI", payStatus: status === "Delivered" ? "Paid" : "Unpaid", payRef: "", status }; };
  for (let i = 190; i >= 0; i--) {
    pool += goodBy[ago(i)] || 0;
    if (i <= 58 && i % 2 === 0) { const c = cust[k % 5], pr = products[k % 4 === 3 ? 1 : 0]; let qty = Math.round(rnd(12, 70)); qty = Math.min(qty, Math.floor((pool * 0.8) / 30)); k++; if (qty < 10) continue; pool -= qty * 30; orders.push(mk("W" + uid().toUpperCase().slice(0, 5), ago(i), c, pr, qty, i > 3 ? "Delivered" : i > 0 ? "Confirmed" : "Pending")); }
  }
  const walk = mk("WALK1", ago(3), ["Walk-in sale", "", "Farm gate"], products[0], 10, "Delivered", null, 215); walk.delivery = 0; walk.charges = []; walk.total = 2150; walk.address = "Farm gate"; orders.push(walk);
  if (withDemoUser) { const dc = ["Demo Customer", "9876500000", "12 Market Road, Muzaffarpur, Bihar"]; orders.push(mk("DEMO01", ago(5), dc, products[0], 20, "Delivered", "demo-user"), mk("DEMO02", today, dc, products[0], 15, "Confirmed", "demo-user")); }
  put("kf_farms", farms); put("kf_batches", batches); put("kf_logs", logs); put("kf_feed", feed); put("kf_exp", exp); put("kf_boxes", boxes);
  put("kf_boxadj", [{ id: uid(), date: ago(15), qty: -6, reason: "Damaged in the rain" }]);
  put("kf_adj", [{ id: uid(), date: ago(20), eggs: -90, reason: "Breakage in transit" }, { id: uid(), date: ago(8), eggs: -60, reason: "Kept for farm use" }]);
  put("kf_txns", txns); put("kf_orders", orders.sort((a, b) => (a.date < b.date ? 1 : -1)));
}
