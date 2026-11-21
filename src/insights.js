import { FEED_CAT, PACK_CAT, CHICK_CAT, rawStock } from "./farm.js";
import { inr } from "./store.js";
import { b } from "./i18n.jsx";

/* One plain sentence that goes under a big red Loss figure, so the owner does not panic over a normal bulk purchase.
   byCat = money spent per kind of expense in the same period. Returns { en, hi } or null when there is no loss. */
export function lossReason({ revenue = 0, expense = 0, manLoss = 0, byCat = {}, feedKg = 0, rawKg = 0 }) {
  const profit = revenue - expense - manLoss;
  if (profit >= 0) return null;
  const feed = byCat[FEED_CAT] || 0, pack = byCat[PACK_CAT] || 0, chicks = byCat[CHICK_CAT] || 0, bulk = feed + pack;
  const kg = Math.round(feedKg + rawKg), run = revenue - (expense - bulk - chicks) - manLoss; // result without the one-time stock buying
  if (bulk > 0 && bulk >= expense * 0.3) {
    const what = feed >= pack ? ["feed and raw materials", "दाना और कच्चा माल"] : ["trays and boxes", "ट्रे और डिब्बे"];
    const tail = run >= 0 ? [` Without this buying you earned ${inr(run)}.`, ` इस खरीद को हटा दें तो ${inr(run)} का मुनाफा है।`] : [` Without it the running loss is only ${inr(-run)}.`, ` इसके बिना चालू घाटा सिर्फ ${inr(-run)} है।`];
    const store = feed >= pack && kg > 0 ? [` About ${kg} kg is still in your store for the coming weeks.`, ` करीब ${kg} किलो अभी गोदाम में है, जो आगे के हफ्तों में काम आएगा।`] : ["", ""];
    return b(`Mostly because ${inr(bulk)} went into buying ${what[0]} in bulk, not a real daily loss.${store[0]}${tail[0]}`, `ज़्यादातर इसलिए कि ${inr(bulk)} का ${what[1]} एक साथ ज़्यादा मात्रा में खरीदा गया, यह रोज़ का असली घाटा नहीं है।${store[1]}${tail[1]}`);
  }
  if (chicks > 0 && chicks >= expense * 0.3) return b(`Mostly because ${inr(chicks)} was spent on new chicks. They start laying in about 18 weeks, so the income comes later.`, `ज़्यादातर इसलिए कि ${inr(chicks)} नए चूज़ों पर खर्च हुए। वे करीब 18 हफ्ते बाद अंडे देना शुरू करेंगे, तब कमाई आएगी।`);
  if (manLoss > 0 && manLoss >= -profit * 0.3) return b(`Mostly because of ${inr(manLoss)} recorded as losses, such as spoiled feed or damaged trays. Check how feed and trays are stored.`, `ज़्यादातर इसलिए कि ${inr(manLoss)} नुकसान में दर्ज हुए, जैसे खराब दाना या टूटी ट्रे। दाना और ट्रे रखने का तरीका जाँचें।`);
  const top = Object.entries(byCat).sort((x, y) => y[1] - x[1])[0];
  return b(`You spent ${inr(expense)} but earned ${inr(revenue)}.${top ? ` Biggest cost: ${top[0]} (${inr(top[1])}).` : ""} Sell the eggs waiting in stock and check how much feed is used.`, `खर्च ${inr(expense)} हुआ पर कमाई ${inr(revenue)} रही।${top ? ` सबसे बड़ा खर्च: ${top[0]} (${inr(top[1])})।` : ""} स्टॉक में रखे अंडे बेचें और दाने का इस्तेमाल जाँचें।`);
}
export const byCategory = (ledgerRows) => { const m = {}; ledgerRows.filter((x) => x.type === "expense").forEach((x) => { m[x.category] = (m[x.category] || 0) + (+x.amount || 0); }); return m; };
export const rawKgOf = (F, farmId = "") => { const rs = rawStock({ rawBuy: F.rawBuy, mix: F.mix }, farmId); return F.raw.filter((r) => r.unit !== "ltr").reduce((a, r) => a + Math.max(0, rs[r.id] || 0), 0); };
