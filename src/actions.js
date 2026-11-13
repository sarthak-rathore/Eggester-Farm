// One place that turns what the owner types into records. Every screen uses these, so numbers never need entering twice.
import { uid } from "./store.js";
import { TRAY, PER_BOX, tierPrice, rawStock, rawAvgPrice, FEED_CAT, MED_CAT, LABOR_CAT, PACK_CAT } from "./farm.js";
export const n = (v) => +v || 0;
const tag = (batch) => ({ farmId: batch?.farmId || "", batchId: batch?.id || "" });

export const addExpense = (F, batch, { date, category, amount, note = "", sub = "", staffId = "" }) =>
  F.setExp((es) => [{ id: uid(), date, ...tag(batch), category, sub, amount: n(amount), note, staffId }, ...es]);

/* buying something that goes into stock: the cost becomes an expense automatically */
export function addPurchase(F, batch, kind, p) {
  const base = { id: uid(), date: p.date, ...tag(batch), supplier: p.supplier || "" };
  if (kind === "feed") { if (n(p.kg) <= 0) return "Enter how much feed you bought."; F.setFeed((a) => [{ ...base, feedType: p.feedType, kg: n(p.kg), cost: n(p.cost) }, ...a]); }
  else if (kind === "raw") { if (n(p.qty) <= 0) return "Enter how much raw material you bought."; F.setRawBuy((a) => [{ ...base, itemId: p.itemId, qty: n(p.qty), cost: n(p.cost) }, ...a]); }
  else if (kind === "trays") { if (n(p.qty) <= 0) return "Enter how many trays you bought."; F.setTrays((a) => [{ ...base, qty: n(p.qty), cost: n(p.cost) }, ...a]); }
  else if (kind === "boxes") { if (n(p.qty) <= 0) return "Enter how many boxes you bought."; F.setBoxes((a) => [{ ...base, qty: n(p.qty), cost: n(p.cost) }, ...a]); }
  else if (kind === "medicine") { if (n(p.cost) <= 0) return "Enter the cost."; addExpense(F, batch, { date: p.date, category: MED_CAT, amount: p.cost, sub: p.sub || "Medicine", note: p.note }); if (p.due) F.setTasks((t) => [{ id: uid(), date: p.due, title: `${p.sub || "Medicine"} due: ${p.note || ""}`.trim(), batchId: batch?.id || "", status: "Open" }, ...t]); }
  return "";
}

/* make feed from raw materials: raw stock goes down, feed stock goes up, cost is worked out */
export function makeFeed(F, batch, { date, feedType, kg, lines }) {
  const used = lines.filter((l) => n(l.qty) > 0);
  if (!used.length) return "Add the raw materials you used.";
  const D = { rawBuy: F.rawBuy, mix: F.mix }, have = rawStock(D, batch.farmId), avg = rawAvgPrice(D);
  for (const l of used) { const it = F.raw.find((r) => r.id === l.itemId); if (n(l.qty) > (have[l.itemId] || 0) + 1e-9) return `Not enough ${it?.name || "raw material"}: only ${Math.round((have[l.itemId] || 0) * 10) / 10} ${it?.unit || "kg"} in stock. Buy it first.`; }
  const made = n(kg) || used.filter((l) => F.raw.find((r) => r.id === l.itemId)?.unit !== "ltr").reduce((a, l) => a + n(l.qty), 0);
  if (made <= 0) return "Enter how many kg of feed you made.";
  const cost = Math.round(used.reduce((a, l) => a + n(l.qty) * (avg[l.itemId] || 0), 0));
  F.setMix((m) => [{ id: uid(), date, ...tag(batch), feedType, kg: made, cost, lines: used.map((l) => ({ itemId: l.itemId, qty: n(l.qty) })) }, ...m]);
  return "";
}

/* price of one box, tray or egg from the tray price (bulk prices applied) */
export const SALE_UNITS = { Box: PER_BOX * TRAY, Tray: TRAY, Egg: 1 };
export const unitPrice = (p, unit, qty, perBox = PER_BOX) => {
  if (!p) return 0; const eggs = unit === "Box" ? perBox * TRAY : unit === "Tray" ? TRAY : 1, trays = (eggs * (n(qty) || 1)) / TRAY;
  return Math.round(((tierPrice(p, Math.max(1, Math.floor(trays))) * eggs) / TRAY) * 100) / 100;
};
export const saleEggs = (l, perBox = PER_BOX) => n(l.qty) * (l.unit === "Box" ? perBox * TRAY : l.unit === "Tray" ? TRAY : 1);

export function makeSaleOrder(batch, l, product, date, perBox = PER_BOX) {
  const q = n(l.qty), price = n(l.price) || unitPrice(product, l.unit, q, perBox), total = Math.round(q * price * 100) / 100;
  return { id: "S" + uid().toUpperCase().slice(0, 5), date, userId: null, ...tag(batch), name: l.cust?.name || "Walk-in sale", phone: l.cust?.phone || "", address: l.cust?.address || "Farm gate", note: "",
    items: [{ id: product.id, name: `${product.name} · sold by the ${l.unit.toLowerCase()}`, unit: l.unit.toLowerCase(), price, qty: q, eggs: saleEggs({ qty: 1, unit: l.unit }, perBox) }],
    subtotal: total, discount: 0, coupon: "", gst: 0, gstMode: "inclusive", delivery: 0, charges: [], total, payMethod: l.paid === "Pending" ? "COD" : "Cash", payStatus: l.paid === "Pending" ? "Unpaid" : "Paid", payRef: "", status: "Delivered" };
}
export { FEED_CAT, MED_CAT, LABOR_CAT, PACK_CAT };
