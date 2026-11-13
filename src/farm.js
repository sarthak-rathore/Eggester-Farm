import { useMemo } from "react";
import { useLS, uid } from "./store.js";
import { SEED_PRODUCTS } from "./config.js";

export const TRAY = 30;
export const EXP_CATS = ["Feed / Raw Materials", "Chicks / Birds Purchase", "Medicines & Vaccines", "Electricity & Water", "Labor Salary", "Transport", "Trays, Boxes & Packaging", "Repairs & Maintenance", "Miscellaneous"];
export const [FEED_CAT, CHICK_CAT, MED_CAT, , LABOR_CAT, , PACK_CAT] = EXP_CATS;
export const PER_BOX = 9; // 1 tray = 30 eggs, 1 box = 9 trays = 270 eggs
export const RAW_DEFAULT = [
  { id: "r1", name: "Maize / Corn", unit: "kg" }, { id: "r2", name: "Corn Seeds", unit: "kg" }, { id: "r3", name: "Soybean Meal", unit: "kg" }, { id: "r4", name: "Rice Bran", unit: "kg" },
  { id: "r5", name: "Wheat Bran", unit: "kg" }, { id: "r6", name: "Calcium (Limestone / Grit)", unit: "kg" }, { id: "r7", name: "DCP (Phosphorus)", unit: "kg" }, { id: "r8", name: "Mineral Mix", unit: "kg" },
  { id: "r9", name: "Vitamins", unit: "kg" }, { id: "r10", name: "Salt", unit: "kg" }, { id: "r11", name: "Oil", unit: "ltr" },
];
export const RECIPE_DEFAULT = [{ id: "rc1", name: "Sample layer mix (edit to your own recipe)", feedType: "ft3", lines: [{ itemId: "r1", kg: 55 }, { itemId: "r3", kg: 22 }, { itemId: "r4", kg: 9 }, { itemId: "r6", kg: 9 }, { itemId: "r7", kg: 1.5 }, { itemId: "r10", kg: 0.3 }, { itemId: "r8", kg: 0.5 }, { itemId: "r9", kg: 0.25 }] }];
export const NOTIF_DEFAULT = { feedDays: 7, trayLow: 20, boxLow: 20, emptyTrayLow: 100, mortality: true, remind: true };
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
  const [boxCfg, setBoxCfg] = useLS("kf_boxcfg", { perBox: PER_BOX, alert: 20 });
  const [raw, setRaw] = useLS("kf_raw", RAW_DEFAULT);
  const [rawBuy, setRawBuy] = useLS("kf_rawbuy", []);
  const [mix, setMix] = useLS("kf_mix", []);
  const [recipes, setRecipes] = useLS("kf_recipes", RECIPE_DEFAULT);
  const [trays, setTrays] = useLS("kf_trays", []);
  const [trayAdj, setTrayAdj] = useLS("kf_trayadj", []);
  const [staff, setStaff] = useLS("kf_staff", []);
  const [sup, setSup] = useLS("kf_sup", []);
  const [cust, setCust] = useLS("kf_cust", []);
  const [cf, setCf] = useLS("kf_cf", []);
  const [notif, setNotif] = useLS("kf_notif", NOTIF_DEFAULT);
  const [tasks, setTasks] = useLS("kf_tasks", []);
  const [docs, setDocs] = useLS("kf_docs", []);
  return { farms, setFarms, batches, setBatches, logs, setLogs, feed, setFeed, types, setTypes, adj, setAdj, exp, setExp, boxes, setBoxes, boxAdj, setBoxAdj, boxCfg, setBoxCfg,
    raw, setRaw, rawBuy, setRawBuy, mix, setMix, recipes, setRecipes, trays, setTrays, trayAdj, setTrayAdj, staff, setStaff, sup, setSup, cust, setCust, cf, setCf, notif, setNotif, tasks, setTasks, docs, setDocs };
}
export function useAnalysis(orders, txns, batchId = "", farmId = "") {
  const F = useFarmData();
  return useMemo(() => analyze({ ...F, orders, txns }, batchId, farmId), [...Object.values(F), orders, txns, batchId, farmId]);
}

/* ---------- raw material stock: bought minus used in feed mixing (per farm, or all farms) ---------- */
export function rawStock(D, farmId = "") {
  const m = {};
  (D.rawBuy || []).filter((b) => !farmId || b.farmId === farmId).forEach((b) => { m[b.itemId] = (m[b.itemId] || 0) + (+b.qty || 0); });
  (D.mix || []).filter((x) => !farmId || x.farmId === farmId).forEach((x) => (x.lines || []).forEach((l) => { m[l.itemId] = (m[l.itemId] || 0) - (+l.qty || 0); }));
  return m;
}
export function rawAvgPrice(D) {
  const q = {}, c = {};
  (D.rawBuy || []).forEach((b) => { q[b.itemId] = (q[b.itemId] || 0) + (+b.qty || 0); c[b.itemId] = (c[b.itemId] || 0) + (+b.cost || 0); });
  return Object.fromEntries(Object.keys(q).map((k) => [k, q[k] ? c[k] / q[k] : 0]));
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

/* ---------- the main analysis (optionally for one farm and/or one batch) ---------- */
export function analyze(D, batchId = "", farmId = "") {
  const { farms = [], batches, logs, types, adj, orders, txns, exp = [], boxes = [], boxAdj = [], boxCfg = {}, trays = [], trayAdj = [], rawBuy = [], mix = [], notif = {} } = D;
  const feed = [...D.feed, ...mix.map((m) => ({ id: m.id, date: m.date, farmId: m.farmId, batchId: m.batchId, feedType: m.feedType, kg: m.kg, cost: m.cost, made: true }))];
  const perBox = +boxCfg.perBox || PER_BOX;
  const lowFeedDays = +notif.feedDays || 7, lowTrays = notif.trayLow ?? 20, lowBoxes = notif.boxLow ?? boxCfg.alert ?? 20, lowEmpty = notif.emptyTrayLow ?? 100;
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
  const global = !effFarm, scoped = !!(batchId || farmId);
  // money and costs: a batch view counts records tagged to that batch, a farm view records of that farm
  const scopeRec = (r) => (batchId ? r.batchId === batchId : !farmId || r.farmId === farmId);
  const feedS = feed.filter(scopeRec), feedBought = feedS.filter((f) => !f.made), feedF = feed.filter((f) => !effFarm || f.farmId === effFarm);
  const expS = exp.filter(scopeRec), boxS = boxes.filter(scopeRec), trayS = trays.filter(scopeRec), rawS = rawBuy.filter(scopeRec);
  const avgFeedPrice = sum(feed, (f) => f.cost) / (sum(feed, (f) => f.kg) || 1) || 30;
  const share = effFarm ? sum(fl, (l) => (+l.eggs || 0) - (+l.broken || 0)) / (sum(logs, (l) => (+l.eggs || 0) - (+l.broken || 0)) || 1) : 1;
  // an order tagged to a batch belongs to it; shop orders are shared out by eggs produced
  const w = (o) => (!scoped ? 1 : o.batchId ? (ids.has(o.batchId) ? 1 : 0) : share);
  const starts = [...batches.map((b) => b.date), ...logs.map((l) => l.date), ...feed.map((f) => f.date), ...orders.map((o) => o.date), ...txns.map((t) => t.date), ...adj.map((a) => a.date), ...exp.map((e) => e.date), ...boxes.map((x) => x.date), ...boxAdj.map((x) => x.date), ...trays.map((x) => x.date), ...trayAdj.map((x) => x.date), ...rawBuy.map((x) => x.date)].filter(Boolean).sort();
  const dates = []; for (let d = starts[0] || today; d <= today && dates.length < 1500; d = addDays(d, 1)) dates.push(d);
  const lk = (l) => l.date + "|" + l.batchId;
  const dM = by(fl, lk, (l) => l.deaths), cM = by(fl, lk, (l) => l.culled);
  const dD = by(fl, (l) => l.date, (l) => l.deaths), cD = by(fl, (l) => l.date, (l) => l.culled), eD = by(fl, (l) => l.date, (l) => l.eggs), bD = by(fl, (l) => l.date, (l) => l.broken), fD = by(fl, (l) => l.date, (l) => l.feedKg);
  const pD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * ((T[l.feedType]?.protein || 0) / 100)), nD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * (T[l.feedType]?.energy || 0));
  const goodAll = by(logs, (l) => l.date, (l) => (+l.eggs || 0) - (+l.broken || 0));
  const soldAllD = by(live, (o) => o.date, eggsOfOrder), soldD = by(live, (o) => o.date, (o) => eggsOfOrder(o) * w(o)), revD = by(delivered, (o) => o.date, (o) => o.total * w(o)), adjD = by(adj, (a) => a.date, (a) => a.eggs);
  const chickD = by(fb, (b) => b.date, (b) => (+b.count || 0) * (+b.chickCost || 0)), buyD = by(feedBought, (f) => f.date, (f) => f.cost), expD = by(expS, (e) => e.date, (e) => e.amount), rawD = by(rawS, (x) => x.date, (x) => x.cost);
  const boxBuyD = by(boxS, (x) => x.date, (x) => x.cost), trayBuyD = by(trayS, (x) => x.date, (x) => x.cost);
  const boxQD = by(boxes, (x) => x.date, (x) => x.qty), boxAdjD = by(boxAdj, (x) => x.date, (x) => x.qty), trayQD = by(trays, (x) => x.date, (x) => x.qty), trayAdjD = by(trayAdj, (x) => x.date, (x) => x.qty);
  const boxUsedD = by(live, (o) => o.date, (o) => Math.ceil(eggsOfOrder(o) / TRAY / perBox)), trayUsedD = by(live, (o) => o.date, (o) => Math.ceil(eggsOfOrder(o) / TRAY));
  const mExp = by(manual("expense"), (t) => t.date, (t) => t.amount), mRev = by(manual("revenue"), (t) => t.date, (t) => t.amount), mLoss = by(manual("loss"), (t) => t.date, (t) => t.amount);
  let stock = 0, boxStock = 0, trayStock = 0, cumDied = 0, cumBought = 0; const alive = {};
  const rows = dates.map((date) => {
    let a = 0, lay = 0;
    fb.forEach((b) => {
      if (b.date === date) { alive[b.id] = (alive[b.id] || 0) + (+b.count || 0); cumBought += +b.count || 0; }
      if (alive[b.id] !== undefined) { const k = date + "|" + b.id; alive[b.id] = Math.max(0, alive[b.id] - (dM[k] || 0) - (cM[k] || 0)); }
      const n = alive[b.id] || 0; a += n;
      if ((new Date(date) - new Date(b.date)) / 864e5 + (+b.ageDays || 0) >= LAY_AGE) lay += n;
    });
    cumDied += dD[date] || 0;
    stock += (goodAll[date] || 0) - (soldAllD[date] || 0) + (adjD[date] || 0);
    boxStock += (boxQD[date] || 0) + (boxAdjD[date] || 0) - (boxUsedD[date] || 0);
    trayStock += (trayQD[date] || 0) + (trayAdjD[date] || 0) - (trayUsedD[date] || 0);
    const feedCost = (fD[date] || 0) * avgFeedPrice, packBuy = (boxBuyD[date] || 0) + (trayBuyD[date] || 0), extra = packBuy + (rawD[date] || 0) + (global ? mExp[date] || 0 : 0), opExtra = packBuy + (global ? mExp[date] || 0 : 0);
    return { date, alive: a, lay, deaths: dD[date] || 0, culled: cD[date] || 0, eggs: eD[date] || 0, broken: bD[date] || 0, good: (eD[date] || 0) - (bD[date] || 0),
      feedKg: fD[date] || 0, protein: pD[date] || 0, energy: nD[date] || 0, produced: (eD[date] || 0) - (bD[date] || 0), sold: soldD[date] || 0, stock: Math.max(0, stock),
      boxBought: boxQD[date] || 0, boxUsed: boxUsedD[date] || 0, boxStock: Math.max(0, boxStock), trayStock: Math.max(0, trayStock),
      revenue: (revD[date] || 0) + (mRev[date] || 0) * share, expense: (chickD[date] || 0) + (buyD[date] || 0) + (expD[date] || 0) + extra, manLoss: global ? mLoss[date] || 0 : 0,
      feedCost, opCost: feedCost + (expD[date] || 0) + opExtra, cumDied, cumBought };
  });
  const last = rows[rows.length - 1] || {};
  const w7 = rows.slice(-7), bd7 = sum(w7, (r) => r.alive), ld7 = sum(w7, (r) => r.lay);
  const usedByType = by(farmLogs, (l) => l.feedType, (l) => l.feedKg), boughtByType = by(feedF.filter((f) => !f.made), (f) => f.feedType, (f) => f.kg), madeByType = by(feedF.filter((f) => f.made), (f) => f.feedType, (f) => f.kg);
  const feedLeft = sum(feedF, (f) => f.kg) - sum(farmLogs, (l) => l.feedKg);
  const avgUse7 = sum(farmLogs.filter((l) => l.date > addDays(today, -7)), (l) => l.feedKg) / 7;
  const feedTable = types.map((t) => { const p = boughtByType[t.id] || 0, m = madeByType[t.id] || 0, u = usedByType[t.id] || 0; return { id: t.id, name: t.name, purchased: p, made: m, used: u, left: Math.max(0, p + m - u) }; });
  const feedByType = feedTable.map((t) => ({ name: t.name, kg: Math.round(t.left) })).filter((t) => t.kg > 0);
  const delRev = sum(delivered, (o) => o.total * w(o)), delEggs = sum(delivered, (o) => eggsOfOrder(o) * w(o)), eggPrice = delEggs ? delRev / delEggs : 7;
  const soldEggs = sum(live, (o) => eggsOfOrder(o) * w(o));
  const expBreak = {}; const add = (k, v) => { if (v) expBreak[k] = (expBreak[k] || 0) + v; };
  add(CHICK_CAT, sum(fb, (b) => (+b.count || 0) * (+b.chickCost || 0))); add(FEED_CAT, sum(feedBought, (f) => f.cost) + sum(rawS, (x) => x.cost)); add(PACK_CAT, sum(boxS, (x) => x.cost) + sum(trayS, (x) => x.cost));
  expS.forEach((e) => add(e.category || "Miscellaneous", +e.amount)); if (global) manual("expense").forEach((t) => add(t.category || "Miscellaneous", +t.amount));
  const buyers = {}; live.forEach((o) => { buyers[o.name] = (buyers[o.name] || 0) + eggsOfOrder(o) / TRAY; });
  const statusCount = {}; orders.forEach((o) => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
  const tot = {
    purchased: sum(fb, (b) => b.count), died: sum(fl, (l) => l.deaths), culled: sum(fl, (l) => l.culled), alive: last.alive || 0,
    feedKg: sum(fl, (l) => l.feedKg), eggs: sum(fl, (l) => l.eggs), broken: sum(fl, (l) => l.broken),
    stockEggs: last.stock || 0, stockTrays: Math.floor((last.stock || 0) / TRAY), producedTrays: sum(fl, (l) => (+l.eggs || 0) - (+l.broken || 0)) / TRAY,
    soldEggs, soldTrays: soldEggs / TRAY, deliveredTrays: delEggs / TRAY, pendingTrays: (soldEggs - delEggs) / TRAY, owed: sum(delivered.filter((o) => o.payStatus === "Unpaid"), (o) => o.total * w(o)),
    boxStock: last.boxStock || 0, boxBought: sum(boxes, (x) => x.qty), boxUsed: sum(rows, (r) => r.boxUsed), boxLost: -sum(boxAdj, (x) => x.qty), perBox,
    trayEmpty: last.trayStock || 0, trayBought: sum(trays, (x) => x.qty), trayLost: -sum(trayAdj, (x) => x.qty),
    revenue: sum(rows, (r) => r.revenue), expense: sum(rows, (r) => r.expense), manLoss: sum(rows, (r) => r.manLoss),
    gPerBird7: bd7 ? (sum(w7, (r) => r.feedKg) * 1000) / bd7 : 0, protein7: bd7 ? (sum(w7, (r) => r.protein) * 1000) / bd7 : 0, energy7: bd7 ? sum(w7, (r) => r.energy) / bd7 : 0,
    hdp7: ld7 ? (sum(w7, (r) => r.eggs) / ld7) * 100 : null, mortalityValue: sum(fl, (l) => (+l.deaths || 0) * (+bOf[l.batchId]?.chickCost || 0)), brokenValue: sum(fl, (l) => l.broken) * eggPrice,
    feedLeft: Math.max(0, feedLeft), feedMade: sum(feedF.filter((f) => f.made), (f) => f.kg), feedBoughtKg: sum(feedF.filter((f) => !f.made), (f) => f.kg), avgUse7, daysLeft: avgUse7 > 0 ? Math.max(0, feedLeft) / avgUse7 : null, avgFeedPrice,
  };
  tot.profit = tot.revenue - tot.expense - tot.manLoss; tot.mortPct = tot.purchased ? (tot.died / tot.purchased) * 100 : 0;
  const farmStats = farms.map((f) => {
    const bs = batches.filter((b) => b.farmId === f.id), idset = new Set(bs.map((b) => b.id)), L = logs.filter((l) => idset.has(l.batchId));
    const purchased = sum(bs, (b) => b.count), died = sum(L, (l) => l.deaths), culled = sum(L, (l) => l.culled);
    const lastDay = L.reduce((m, l) => (l.date > m ? l.date : m), "");
    return { farm: f, flocks: bs.length, purchased, died, culled, alive: Math.max(0, purchased - died - culled), mortPct: purchased ? (died / purchased) * 100 : 0, eggs: sum(L, (l) => l.eggs), trays: sum(L, (l) => (+l.eggs || 0) - (+l.broken || 0)) / TRAY,
      eggsToday: sum(L.filter((l) => l.date === today), (l) => l.eggs), feedKg: sum(L, (l) => l.feedKg), feedLeft: Math.max(0, sum(feed.filter((x) => x.farmId === f.id), (x) => x.kg) - sum(L, (l) => l.feedKg)), lastLog: lastDay,
      expense: sum(bs, (b) => (+b.count || 0) * (+b.chickCost || 0)) + sum(feed.filter((x) => x.farmId === f.id && !x.made), (x) => x.cost) + sum(rawBuy.filter((e) => e.farmId === f.id), (e) => e.cost) + sum(exp.filter((e) => e.farmId === f.id), (e) => e.amount) };
  });
  const alerts = [];
  if (tot.daysLeft !== null && tot.daysLeft < lowFeedDays) alerts.push({ level: "bad", text: `Feed is running low: about ${r1(tot.daysLeft)} days left (${Math.round(tot.feedLeft)} kg).` });
  if (global && batches.length && tot.stockTrays < lowTrays) alerts.push({ level: "warn", text: `Only ${tot.stockTrays} trays of eggs in stock.` });
  if (global && (boxes.length || boxAdj.length) && tot.boxStock < lowBoxes) alerts.push({ level: "warn", text: `Only ${tot.boxStock} empty boxes left for packing.` });
  if (global && (trays.length || trayAdj.length) && tot.trayEmpty < lowEmpty) alerts.push({ level: "warn", text: `Only ${tot.trayEmpty} empty trays left.` });
  const avgDeaths = sum(rows.slice(-8, -1), (r) => r.deaths) / 7;
  if (notif.mortality !== false && (last.deaths || 0) >= Math.max(3, avgDeaths * 3)) alerts.push({ level: "bad", text: `More birds died today than usual: ${last.deaths} (normal is about ${r1(avgDeaths)} a day).` });
  if (tot.hdp7 !== null && tot.hdp7 < 70) alerts.push({ level: "warn", text: `Egg laying is low this week: ${r1(tot.hdp7)}% of hens laid an egg per day.` });
  const pend = orders.filter((o) => o.status === "Pending").length;
  if (global && pend) alerts.push({ level: "info", text: `${pend} online order${pend > 1 ? "s" : ""} waiting for your OK.` });
  return { rows, tot, alerts, feedByType, feedTable, expBreak, buyers, statusCount, batches, farms, farmStats, perBatch: batches.map((b) => ({ b, ...batchStats(b, D) })) };
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
  const fn = Object.fromEntries((D.farms || []).map((f) => [f.id, f.name])), bn = Object.fromEntries(D.batches.map((b) => [b.id, b.name]));
  const L = [];
  const row = (id, r, type, category, amount, note, source) => L.push({ id, date: r.date, type, category, amount: +amount || 0, note, farm: r.farmId === "all" ? "All farms" : fn[r.farmId] || "", batch: bn[r.batchId] || "", batchId: r.batchId || "", source, srcId: r.id });
  D.orders.filter((o) => o.status === "Delivered").forEach((o) => row("o" + o.id, o, "revenue", "Egg sales", o.total, `${o.name}${o.payStatus === "Unpaid" ? " (payment pending)" : ""}`, "Sales"));
  D.batches.forEach((b) => row("b" + b.id, { ...b, batchId: b.id }, "expense", CHICK_CAT, (+b.count || 0) * (+b.chickCost || 0), `${b.count} chicks`, "Purchases"));
  D.feed.forEach((f) => row("f" + f.id, f, "expense", FEED_CAT, f.cost, `Ready feed ${f.kg} kg`, "Purchases"));
  (D.rawBuy || []).forEach((x) => row("w" + x.id, x, "expense", FEED_CAT, x.cost, `Raw material ${x.qty}`, "Purchases"));
  (D.boxes || []).forEach((x) => row("x" + x.id, x, "expense", PACK_CAT, x.cost, `${x.qty} boxes`, "Purchases"));
  (D.trays || []).forEach((x) => row("t" + x.id, x, "expense", PACK_CAT, x.cost, `${x.qty} trays`, "Purchases"));
  (D.exp || []).forEach((e) => row("e" + e.id, e, "expense", e.category, e.amount, e.note || "", "Expenses"));
  D.txns.forEach((t) => L.push({ ...t, farm: "", batch: "", source: "Other income/loss" }));
  return L.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- demo data: 3 farms ---------- */
export function seedDemo(withDemoUser = true) {
  const put = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); dispatchEvent(new CustomEvent("kf-ls", { detail: k })); };
  const today = ymd(Date.now()); const ago = (n) => addDays(today, -n); const rnd = (a, b) => a + Math.random() * (b - a);
  const farms = [{ id: "f1", name: "Farm 1 · Kesariya", location: "Kesariya" }, { id: "f2", name: "Farm 2 · Motihari", location: "Motihari" }, { id: "f3", name: "Farm 3 · Bettiah", location: "Bettiah" }];
  const mkB = (id, farmId, name, days, count, cost) => ({ id, farmId, name, breed: "White layer (day-old chicks)", date: ago(days), count, chickCost: cost, ageDays: 1, supplier: "Sunrise Hatchery", status: "Active", note: "" });
  const batches = [mkB("b1", "f1", "Batch A", 190, 500, 38), mkB("b2", "f1", "Batch B", 60, 300, 40), mkB("b3", "f2", "Batch C", 150, 400, 39), mkB("b4", "f3", "Batch D", 100, 350, 40)];
  const farmFirst = { f1: "b1", f2: "b3", f3: "b4" };
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
  Object.entries(cons).forEach(([k, m]) => { const [farmId, t] = k.split("|"); let s = 0; for (let i = 190; i >= 0; i--) { const d = ago(i); if (s < (m[d] || 0)) { let need = 0; for (let j = 0; j < 14; j++) need += m[ago(i - j)] || 0; const kg = Math.max(50, Math.ceil(need / 50) * 50); feed.push({ id: uid(), date: d, farmId, batchId: farmFirst[farmId], feedType: t, kg, cost: Math.round(kg * price[t] * rnd(0.97, 1.03)), supplier: "Bihar Feeds" }); s += kg; } s -= m[d] || 0; } });
  const exp = [], ex = (i, farmId, category, amount, note = "", batchId = farmFirst[farmId]) => exp.push({ id: uid(), date: ago(i), farmId, batchId, category, amount, note });
  farms.forEach((f, n) => { for (let i = 190 - n * 2; i >= 0; i -= 7) ex(i, f.id, "Labor Salary", 1500 + n * 150, "Weekly wages"); for (let i = 188 - n; i >= 0; i -= 30) ex(i, f.id, "Electricity & Water", 2200 + n * 150); for (let i = 186 - n; i >= 0; i -= 30) ex(i, f.id, "Transport", 2000, "Feed and egg transport"); });
  batches.forEach((b) => [7, 14, 28, 56].forEach((d) => left[b.id] - d >= 0 && ex(left[b.id] - d, b.farmId, "Medicines & Vaccines", b.count * 3, "Vaccination round", b.id)));
  ex(70, "f2", "Repairs & Maintenance", 4200, "Shed roof"); ex(33, "f1", "Repairs & Maintenance", 1800, "Water line");
const txns = []; const tx = (i, type, category, amount, note = "") => txns.push({ id: uid(), date: ago(i), type, category, amount, note });
  for (let i = 188; i >= 0; i -= 30) tx(i, "revenue", "Manure sale", 5000, "Droppings sold to farmers");
  tx(95, "loss", "Feed spoiled by rain", 2400); tx(40, "loss", "Damaged egg trays", 900);
  const boxes = [[62, 150], [30, 150], [8, 100]].map(([i, qty]) => ({ id: uid(), date: ago(i), farmId: "f1", batchId: "b1", qty, cost: qty * 55, supplier: "Pack & Ship" }));
  const trays = [[60, 800], [20, 700]].map(([i, qty]) => ({ id: uid(), date: ago(i), farmId: "f1", batchId: "b1", qty, cost: qty * 7, supplier: "Pack & Ship" }));
  const rawBuy = [], mixes = []; const rb = (i, itemId, qty, price) => rawBuy.push({ id: uid(), date: ago(i), farmId: "f1", batchId: "b1", itemId, qty, cost: Math.round(qty * price), supplier: "Local mandi" });
  rb(40, "r1", 3000, 24); rb(40, "r3", 1200, 48); rb(40, "r4", 800, 16); rb(40, "r6", 600, 9); rb(40, "r7", 60, 38); rb(40, "r8", 20, 90); rb(40, "r9", 8, 400); rb(40, "r10", 20, 8);
  rb(10, "r1", 2000, 25); rb(10, "r3", 800, 47);
  const mk1 = (i, kg) => { const sc = kg / 100; const lines = [["r1", 55], ["r3", 22], ["r4", 9], ["r6", 9], ["r7", 1.5], ["r10", 0.3], ["r8", 0.5], ["r9", 0.25]].map(([itemId, q]) => ({ itemId, qty: Math.round(q * sc * 100) / 100 })); const pr = { r1: 24, r3: 48, r4: 16, r6: 9, r7: 38, r10: 8, r8: 90, r9: 400 }; mixes.push({ id: uid(), date: ago(i), farmId: "f1", batchId: "b1", feedType: "ft3", kg, lines, cost: Math.round(lines.reduce((a, l) => a + l.qty * pr[l.itemId], 0)) }); };
  mk1(30, 500); mk1(14, 500); mk1(3, 500);
  const staff = [{ id: "s1", name: "Ramesh Yadav", role: "Supervisor", phone: "9810000101", salary: 9000, farmId: "f1", active: "Yes" }, { id: "s2", name: "Sunita Devi", role: "Egg collector", phone: "9810000102", salary: 6000, farmId: "f1", active: "Yes" }, { id: "s3", name: "Mohan Singh", role: "Helper", phone: "9810000103", salary: 6500, farmId: "f2", active: "Yes" }];
  const sup = [{ id: "u1", name: "Sunrise Hatchery", phone: "9810000201", supplies: "Day-old chicks" }, { id: "u2", name: "Bihar Feeds", phone: "9810000202", supplies: "Ready feed" }, { id: "u3", name: "Local mandi", phone: "9810000203", supplies: "Maize, bran, soybean" }, { id: "u4", name: "Pack & Ship", phone: "9810000204", supplies: "Trays and boxes" }];
  const products = [{ id: "p1", name: "Farm eggs, standard tray (30)", price: 210, tiers: "50:205,100:200,200:195", moq: 10 }, { id: "p2", name: "Large eggs, premium tray (30)", price: 235, tiers: "50:230,100:225", moq: 10 }];
  const cust = [["Sri Ram Sweets", "9810000011", "Main Bazar, Motihari"], ["Hotel Annapurna", "9810000022", "Station Road, Motihari"], ["City Bakery", "9810000033", "Bettiah Road, Kesariya"], ["Gupta General Store", "9810000044", "Chakia Chowk"], ["Maa Tara Caterers", "9810000055", "Ramgarhwa"]];
  const goodBy = by(logs, (l) => l.date, (l) => l.eggs - l.broken); let pool = -3500, k = 0; const orders = [];
  const mk = (id, date, c, pr, qty, status, userId, price2) => { const pr2 = price2 || tierPrice(pr, qty), subtotal = qty * pr2, delivery = subtotal >= 5000 ? 0 : 150, total = subtotal + delivery + 10;
    return { id, date, userId: userId || null, name: c[0], phone: c[1], address: c[2], note: "", items: [{ id: pr.id, name: pr.name, unit: "tray", price: pr2, qty, eggs: 30 }], subtotal, discount: 0, coupon: "", gst: 0, gstMode: "inclusive", delivery, charges: [{ label: "Packaging", amount: 10 }], total,
      payMethod: k % 3 ? "COD" : "UPI", payStatus: status === "Delivered" ? "Paid" : "Unpaid", payRef: "", status }; };
  for (let i = 190; i >= 0; i--) {
    pool += goodBy[ago(i)] || 0;
    if (i <= 150 && i % 2 === 0) { const c = cust[k % 5], pr = products[k % 4 === 3 ? 1 : 0]; let qty = Math.round(rnd(12, 70)); qty = Math.min(qty, Math.floor((pool * 0.8) / 30)); k++; if (qty < 10) continue; pool -= qty * 30; orders.push(mk("W" + uid().toUpperCase().slice(0, 5), ago(i), c, pr, qty, i > 3 ? "Delivered" : i > 0 ? "Confirmed" : "Pending")); }
  }
  const walk = mk("WALK1", ago(3), ["Walk-in sale", "", "Farm gate"], products[0], 10, "Delivered", null, 215); walk.delivery = 0; walk.charges = []; walk.total = 2150; walk.batchId = "b1"; walk.farmId = "f1"; walk.address = "Farm gate"; orders.push(walk);
  if (withDemoUser) { const dc = ["Demo Customer", "9876500000", "12 Market Road, Muzaffarpur, Bihar"]; orders.push(mk("DEMO01", ago(5), dc, products[0], 20, "Delivered", "demo-user"), mk("DEMO02", today, dc, products[0], 15, "Confirmed", "demo-user")); }
  put("kf_farms", farms); put("kf_trays", trays); put("kf_rawbuy", rawBuy); put("kf_mix", mixes); put("kf_staff", staff); put("kf_sup", sup);
  put("kf_cust", cust.map((c, i) => ({ id: "c" + i, name: c[0], phone: c[1], address: c[2], type: "Regular" })));
  put("kf_tasks", [{ id: uid(), date: ago(-2), title: "Vaccination for Batch B", batchId: "b2", status: "Open" }, { id: uid(), date: ago(-5), title: "Clean water tanks", batchId: "b1", status: "Open" }]); put("kf_batches", batches); put("kf_logs", logs); put("kf_feed", feed); put("kf_exp", exp); put("kf_boxes", boxes);
  put("kf_boxadj", [{ id: uid(), date: ago(15), qty: -6, reason: "Damaged in the rain" }]);
  put("kf_adj", [{ id: uid(), date: ago(20), eggs: -90, reason: "Breakage in transit" }, { id: uid(), date: ago(8), eggs: -60, reason: "Kept for farm use" }]);
  put("kf_txns", txns); put("kf_orders", orders.sort((a, b) => (a.date < b.date ? 1 : -1)));
}
