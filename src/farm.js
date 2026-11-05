import { useMemo } from "react";
import { useLS, uid } from "./store.js";
import { SEED_PRODUCTS } from "./config.js";

export const TRAY = 30;
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
  const [batches, setBatches] = useLS("kf_batches", []);
  const [logs, setLogs] = useLS("kf_logs", []);
  const [feed, setFeed] = useLS("kf_feed", []);
  const [types, setTypes] = useLS("kf_ftypes", DEFAULT_TYPES);
  const [adj, setAdj] = useLS("kf_adj", []);
  return { batches, setBatches, logs, setLogs, feed, setFeed, types, setTypes, adj, setAdj };
}
export function useAnalysis(orders, txns, batchId = "") {
  const F = useFarmData();
  return useMemo(() => analyze({ batches: F.batches, logs: F.logs, feed: F.feed, types: F.types, adj: F.adj, orders, txns }, batchId), [F.batches, F.logs, F.feed, F.types, F.adj, orders, txns, batchId]);
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

/* ---------- the main analysis ---------- */
export function analyze(D, batchId = "") {
  const { batches, logs, feed, types, adj, orders, txns } = D;
  const today = ymd(Date.now());
  const fb = batches.filter((b) => !batchId || b.id === batchId);
  const fl = logs.filter((l) => !batchId || l.batchId === batchId);
  const T = Object.fromEntries(types.map((t) => [t.id, t]));
  const live = orders.filter((o) => o.status !== "Cancelled");
  const delivered = orders.filter((o) => o.status === "Delivered");
  const manual = (ty) => txns.filter((t) => t.type === ty);
  const avgFeedPrice = sum(feed, (f) => f.cost) / (sum(feed, (f) => f.kg) || 1) || 30;
  const starts = [...batches.map((b) => b.date), ...logs.map((l) => l.date), ...feed.map((f) => f.date), ...orders.map((o) => o.date), ...txns.map((t) => t.date), ...adj.map((a) => a.date)].filter(Boolean).sort();
  const start = starts[0] || today;
  const dates = []; for (let d = start; d <= today && dates.length < 1500; d = addDays(d, 1)) dates.push(d);
  const lk = (l) => l.date + "|" + l.batchId;
  const dM = by(fl, lk, (l) => l.deaths), cM = by(fl, lk, (l) => l.culled);
  const dD = by(fl, (l) => l.date, (l) => l.deaths), cD = by(fl, (l) => l.date, (l) => l.culled), eD = by(fl, (l) => l.date, (l) => l.eggs), bD = by(fl, (l) => l.date, (l) => l.broken), fD = by(fl, (l) => l.date, (l) => l.feedKg);
  const pD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * ((T[l.feedType]?.protein || 0) / 100)), nD = by(fl, (l) => l.date, (l) => (+l.feedKg || 0) * (T[l.feedType]?.energy || 0));
  const goodAll = by(logs, (l) => l.date, (l) => (+l.eggs || 0) - (+l.broken || 0)), feedAll = by(logs, (l) => l.date, (l) => l.feedKg);
  const soldD = by(live, (o) => o.date, eggsOfOrder), revD = by(delivered, (o) => o.date, (o) => o.total), adjD = by(adj, (a) => a.date, (a) => a.eggs);
  const chickD = by(batches, (b) => b.date, (b) => (+b.count || 0) * (+b.chickCost || 0)), buyD = by(feed, (f) => f.date, (f) => f.cost);
  const mExp = by(manual("expense"), (t) => t.date, (t) => t.amount), mRev = by(manual("revenue"), (t) => t.date, (t) => t.amount), mLoss = by(manual("loss"), (t) => t.date, (t) => t.amount);
  let stock = 0, cumDied = 0, cumBought = 0; const alive = {};
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
    const feedCost = (feedAll[date] || 0) * avgFeedPrice;
    return { date, alive: a, lay, deaths: dD[date] || 0, culled: cD[date] || 0, eggs: eD[date] || 0, broken: bD[date] || 0, good: (eD[date] || 0) - (bD[date] || 0),
      feedKg: fD[date] || 0, protein: pD[date] || 0, energy: nD[date] || 0, produced: goodAll[date] || 0, sold: soldD[date] || 0, stock: Math.max(0, stock),
      revenue: (revD[date] || 0) + (mRev[date] || 0), expense: (chickD[date] || 0) + (buyD[date] || 0) + (mExp[date] || 0), manLoss: mLoss[date] || 0,
      feedCost, opCost: feedCost + (mExp[date] || 0), cumDied, cumBought };
  });
  const last = rows[rows.length - 1] || {};
  const w7 = rows.slice(-7), bd7 = sum(w7, (r) => r.alive), ld7 = sum(w7, (r) => r.lay);
  const usedByType = by(logs, (l) => l.feedType, (l) => l.feedKg), boughtByType = by(feed, (f) => f.feedType, (f) => f.kg);
  const feedLeft = sum(feed, (f) => f.kg) - sum(logs, (l) => l.feedKg);
  const avgUse7 = sum(logs.filter((l) => l.date > addDays(today, -7)), (l) => l.feedKg) / 7;
  const feedByType = types.map((t) => ({ name: t.name, kg: Math.max(0, Math.round((boughtByType[t.id] || 0) - (usedByType[t.id] || 0))) })).filter((t) => t.kg > 0 || (usedByType[t.name] || 0) > 0);
  const batchName = Object.fromEntries(batches.map((b) => [b.id, b]));
  const mortalityValue = sum(logs, (l) => (+l.deaths || 0) * (+batchName[l.batchId]?.chickCost || 0));
  const delRev = sum(delivered, (o) => o.total), delEggs = sum(delivered, eggsOfOrder);
  const eggPrice = delEggs ? delRev / delEggs : 7;
  const expBreak = {}; const add = (k, v) => { if (v) expBreak[k] = (expBreak[k] || 0) + v; };
  add("Chicks", sum(batches, (b) => (+b.count || 0) * (+b.chickCost || 0))); add("Feed", sum(feed, (f) => f.cost));
  manual("expense").forEach((t) => add(t.category || "Other", +t.amount));
  const buyers = {}; live.forEach((o) => { buyers[o.name] = (buyers[o.name] || 0) + eggsOfOrder(o) / TRAY; });
  const statusCount = {}; orders.forEach((o) => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
  const tot = {
    purchased: sum(fb, (b) => b.count), died: sum(fl, (l) => l.deaths), culled: sum(fl, (l) => l.culled), alive: last.alive || 0,
    feedKg: sum(fl, (l) => l.feedKg), eggs: sum(fl, (l) => l.eggs), broken: sum(fl, (l) => l.broken),
    stockEggs: last.stock || 0, stockTrays: Math.floor((last.stock || 0) / TRAY), producedTrays: sum(logs, (l) => (+l.eggs || 0) - (+l.broken || 0)) / TRAY,
    soldTrays: sum(live, eggsOfOrder) / TRAY, deliveredTrays: delEggs / TRAY, pendingTrays: (sum(live, eggsOfOrder) - delEggs) / TRAY,
    revenue: sum(rows, (r) => r.revenue), expense: sum(rows, (r) => r.expense), manLoss: sum(rows, (r) => r.manLoss),
    gPerBird7: bd7 ? (sum(w7, (r) => r.feedKg) * 1000) / bd7 : 0, protein7: bd7 ? (sum(w7, (r) => r.protein) * 1000) / bd7 : 0, energy7: bd7 ? sum(w7, (r) => r.energy) / bd7 : 0,
    hdp7: ld7 ? (sum(w7, (r) => r.eggs) / ld7) * 100 : null, mortalityValue, brokenValue: sum(logs, (l) => l.broken) * eggPrice,
    feedLeft: Math.max(0, feedLeft), avgUse7, daysLeft: avgUse7 > 0 ? Math.max(0, feedLeft) / avgUse7 : null, avgFeedPrice,
  };
  tot.profit = tot.revenue - tot.expense - tot.manLoss; tot.mortPct = tot.purchased ? (tot.died / tot.purchased) * 100 : 0;
  const alerts = [];
  if (tot.daysLeft !== null && tot.daysLeft < 7) alerts.push({ level: "bad", text: `Feed is running low: about ${r1(tot.daysLeft)} days left (${Math.round(tot.feedLeft)} kg).` });
  if (batches.length && tot.stockTrays < 20) alerts.push({ level: "warn", text: `Only ${tot.stockTrays} egg trays in stock.` });
  const avgDeaths = sum(rows.slice(-8, -1), (r) => r.deaths) / 7;
  if ((last.deaths || 0) >= Math.max(3, avgDeaths * 3)) alerts.push({ level: "bad", text: `Unusual deaths today: ${last.deaths} birds (normal is about ${r1(avgDeaths)} a day).` });
  if (tot.hdp7 !== null && tot.hdp7 < 70) alerts.push({ level: "warn", text: `Egg production is low: ${r1(tot.hdp7)}% of laying hens per day this week.` });
  const pend = orders.filter((o) => o.status === "Pending").length;
  if (pend) alerts.push({ level: "info", text: `${pend} order${pend > 1 ? "s" : ""} waiting for confirmation.` });
  return { rows, tot, alerts, feedByType, expBreak, buyers, statusCount, batches, perBatch: batches.map((b) => ({ b, ...batchStats(b, D) })) };
}

/* ---------- chart series per day / month / year ---------- */
export function aggregate(rows, p) {
  const key = (d) => (p === "day" ? d : p === "month" ? d.slice(0, 7) : d.slice(0, 4));
  const F = ["deaths", "culled", "eggs", "broken", "good", "feedKg", "protein", "energy", "sold", "produced", "revenue", "expense", "manLoss", "opCost", "feedCost"];
  const m = new Map();
  rows.forEach((r) => {
    let a = m.get(key(r.date));
    if (!a) { a = { k: key(r.date), birdDays: 0, layDays: 0 }; F.forEach((f) => (a[f] = 0)); m.set(a.k, a); }
    F.forEach((f) => (a[f] += r[f])); a.birdDays += r.alive; a.layDays += r.lay;
    a.alive = r.alive; a.stock = r.stock; a.cumDied = r.cumDied; a.cumBought = r.cumBought;
  });
  let out = [...m.values()]; out = p === "day" ? out.slice(-30) : p === "month" ? out.slice(-12) : out;
  return out.map((a) => ({ ...a, profit: a.revenue - a.expense - a.manLoss, gPerBird: r1(a.birdDays ? (a.feedKg * 1000) / a.birdDays : null), proteinG: r1(a.birdDays ? (a.protein * 1000) / a.birdDays : null),
    energyKcal: r1(a.birdDays ? a.energy / a.birdDays : null), hdp: r1(a.layDays && a.eggs ? (a.eggs / a.layDays) * 100 : null), fcr: r1(a.eggs ? a.feedKg / (a.eggs / 12) : null),
    producedTrays: r1(a.produced / TRAY), soldTrays: r1(a.sold / TRAY), stockTrays: Math.round(a.stock / TRAY), mortPct: r1(a.cumBought ? (a.cumDied / a.cumBought) * 100 : 0),
    costPerTray: r1(a.produced ? a.opCost / (a.produced / TRAY) : null), feedCostPerTray: r1(a.produced ? a.feedCost / (a.produced / TRAY) : null) }));
}

/* ---------- full ledger (auto + manual) ---------- */
export function ledger(D) {
  const L = [];
  D.orders.filter((o) => o.status === "Delivered").forEach((o) => L.push({ id: "o" + o.id, date: o.date, type: "revenue", category: "Egg sales", amount: +o.total, note: `Order ${o.id}, ${o.name}`, source: "Orders" }));
  D.batches.forEach((b) => L.push({ id: "b" + b.id, date: b.date, type: "expense", category: "Chicks", amount: (+b.count || 0) * (+b.chickCost || 0), note: `${b.count} chicks, ${b.name}`, source: "Flocks" }));
  D.feed.forEach((f) => L.push({ id: "f" + f.id, date: f.date, type: "expense", category: "Feed", amount: +f.cost, note: `${f.kg} kg`, source: "Feed" }));
  D.txns.forEach((t) => L.push({ ...t, source: "Manual" }));
  return L.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- demo data ---------- */
export function seedDemo(withDemoUser = true) {
  const put = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); dispatchEvent(new CustomEvent("kf-ls", { detail: k })); };
  const today = ymd(Date.now()); const ago = (n) => addDays(today, -n); const rnd = (a, b) => a + Math.random() * (b - a);
  const batches = [
    { id: "b1", name: "Batch A", breed: "White layer (day-old chicks)", date: ago(190), count: 500, chickCost: 38, ageDays: 1, supplier: "Sunrise Hatchery", status: "Active", note: "" },
    { id: "b2", name: "Batch B", breed: "White layer (day-old chicks)", date: ago(60), count: 300, chickCost: 40, ageDays: 1, supplier: "Sunrise Hatchery", status: "Active", note: "" },
  ];
  const left = { b1: 190, b2: 60 }, alive = { b1: 500, b2: 300 }, logs = [];
  for (let i = 190; i >= 0; i--) batches.forEach((b) => {
    if (i > left[b.id]) return;
    const age = left[b.id] - i + 1, n = alive[b.id];
    const rate = age < 14 ? 0.004 : age < 42 ? 0.0015 : 0.0004;
    const deaths = Math.min(n, Math.round(n * rate * rnd(0.4, 1.6)));
    const g = age < 42 ? 10 + age : age < 126 ? 52 + (age - 42) * 0.45 : rnd(110, 118);
    const wk = (age - 126) / 7, hdp = age >= 126 ? Math.min(0.92, 0.12 + Math.max(0, wk) * 0.15) * rnd(0.96, 1.02) : 0;
    const eggs = Math.round(n * hdp);
    logs.push({ id: uid(), date: ago(i), batchId: b.id, feedType: age < 42 ? "ft1" : age < 126 ? "ft2" : "ft3", feedKg: Math.round((n * g) / 100) / 10, deaths, culled: 0, eggs, broken: Math.round(eggs * rnd(0.008, 0.02)), note: "" });
    alive[b.id] = n - deaths;
  });
  const cons = { ft1: {}, ft2: {}, ft3: {} }; logs.forEach((l) => { cons[l.feedType][l.date] = (cons[l.feedType][l.date] || 0) + l.feedKg; });
  const price = { ft1: 36, ft2: 31, ft3: 29 }, feed = [];
  Object.entries(cons).forEach(([t, m]) => { let s = 0; for (let i = 190; i >= 0; i--) { const d = ago(i); if (s < (m[d] || 0)) { let need = 0; for (let j = 0; j < 14; j++) need += m[ago(i - j)] || 0; const kg = Math.max(50, Math.ceil(need / 50) * 50); feed.push({ id: uid(), date: d, feedType: t, kg, cost: Math.round(kg * price[t] * rnd(0.97, 1.03)), supplier: "Bihar Feeds" }); s += kg; } s -= m[d] || 0; } });
  const txns = []; const tx = (i, type, category, amount, note = "") => txns.push({ id: uid(), date: ago(i), type, category, amount, note });
  for (let i = 190; i >= 0; i -= 7) tx(i, "expense", "Labour", 4200);
  for (let i = 188; i >= 0; i -= 30) { tx(i, "expense", "Electricity", 3800); tx(i, "expense", "Water & maintenance", 1800); tx(i, "revenue", "Manure sale", 3000, "Droppings sold to farmers"); }
  [[190, 500], [60, 300]].forEach(([bi, n]) => [7, 14, 28, 56].forEach((d) => bi - d >= 0 && tx(bi - d, "expense", "Medicine & vaccines", n * 3, "Vaccination round")));
  tx(95, "loss", "Feed spoiled by rain", 2400); tx(40, "loss", "Damaged egg trays", 900);
  const products = [{ id: "p1", name: "Farm eggs, standard tray (30)", price: 210, tiers: "50:205,100:200,200:195", moq: 10 }, { id: "p2", name: "Large eggs, premium tray (30)", price: 235, tiers: "50:230,100:225", moq: 10 }];
  const cust = [["Sri Ram Sweets", "9810000011", "Main Bazar, Motihari"], ["Hotel Annapurna", "9810000022", "Station Road, Motihari"], ["City Bakery", "9810000033", "Bettiah Road, Kesariya"], ["Gupta General Store", "9810000044", "Chakia Chowk"], ["Maa Tara Caterers", "9810000055", "Ramgarhwa"]];
  const goodBy = by(logs, (l) => l.date, (l) => l.eggs - l.broken); let pool = -3000, k = 0; /* reserve for demo orders, adjustments and a healthy closing stock */ const orders = [];
  const mk = (id, date, c, pr, qty, status, userId) => { const price2 = tierPrice(pr, qty), subtotal = qty * price2, delivery = subtotal >= 5000 ? 0 : 150, total = subtotal + delivery + 10;
    return { id, date, userId: userId || null, name: c[0], phone: c[1], address: c[2], note: "", items: [{ id: pr.id, name: pr.name, unit: "tray", price: price2, qty, eggs: 30 }], subtotal, discount: 0, coupon: "", gst: 0, gstMode: "inclusive", delivery, charges: [{ label: "Packaging", amount: 10 }], total,
      payMethod: k % 3 ? "COD" : "UPI", payStatus: status === "Delivered" ? "Paid" : "Unpaid", payRef: "", status }; };
  for (let i = 190; i >= 0; i--) {
    pool += goodBy[ago(i)] || 0;
    if (i <= 58 && i % 2 === 0) { const c = cust[k % 5], pr = products[k % 4 === 3 ? 1 : 0]; let qty = Math.round(rnd(12, 70)); qty = Math.min(qty, Math.floor((pool * 0.8) / 30)); k++; if (qty < 10) continue; pool -= qty * 30; orders.push(mk("W" + uid().toUpperCase().slice(0, 5), ago(i), c, pr, qty, i > 3 ? "Delivered" : i > 0 ? "Confirmed" : "Pending")); }
  }
  if (withDemoUser) { const dc = ["Demo Customer", "9876500000", "12 Market Road, Muzaffarpur, Bihar"]; orders.push(mk("DEMO01", ago(5), dc, products[0], 20, "Delivered", "demo-user"), mk("DEMO02", today, dc, products[0], 15, "Confirmed", "demo-user")); }
  put("kf_batches", batches); put("kf_logs", logs); put("kf_feed", feed); put("kf_adj", [{ id: uid(), date: ago(20), eggs: -90, reason: "Breakage in transit" }, { id: uid(), date: ago(8), eggs: -60, reason: "Kept for farm use" }]);
  put("kf_txns", txns); put("kf_orders", orders.sort((a, b) => (a.date < b.date ? 1 : -1)));
}
