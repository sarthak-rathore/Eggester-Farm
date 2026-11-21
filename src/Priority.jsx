import React from "react";
import { useFarmData } from "./farm.js";
import { today, inr } from "./store.js";
import { Bi } from "./i18n.jsx";
import { Ia } from "./adminIcons.jsx";

/* "Today's Priority Actions": the 1 to 3 things the owner should do first, instead of starting with raw numbers.
   Built from what is really pending: today's update, online orders to approve, tasks that are due, low feed, sick birds, low laying, missing packing material, money to collect. */
const role = () => { try { return sessionStorage.getItem("kf_role") || "Owner"; } catch { return "Owner"; } };
const canOpen = (sec) => { const r = role(); return r === "Viewer" ? false : r === "Worker" ? ["today", "tasks"].includes(sec) : true; };
const B = (en, hi) => ({ en, hi });
const num = (v) => Math.round(v * 10) / 10;

export function priorityList({ F, A, orders, batchId = "", t = today() }) {
  const active = F.batches.filter((b) => b.status !== "Closed" && (!batchId || b.id === batchId));
  const first = batchId || active[0]?.id || "";
  const to = (sec, sub = "") => (first ? `#/admin/farm/${first}/${sec}${sub ? "/" + sub : ""}` : "#/admin/farms");
  const out = [];
  const add = (score, sec, level, text, btn, sub) => { if (canOpen(sec)) out.push({ score, level, text, btn, to: to(sec, sub), sec }); };
  // 1. today's update not done
  const open = active.filter((b) => !F.logs.some((l) => l.batchId === b.id && l.date === t));
  if (open.length === 1) add(100, "today", "bad", B(`Enter today's update for ${open[0].name} (eggs, birds, feed).`, `${open[0].name} का आज का हिसाब भरें (अंडे, मुर्गियाँ, दाना)।`), B("Enter now", "अभी भरें"));
  else if (open.length > 1) { if (canOpen("today")) out.push({ score: 100, level: "bad", text: B(`Today's update is still pending for ${open.length} batches: ${open.map((b) => b.name).slice(0, 3).join(", ")}${open.length > 3 ? "…" : ""}.`, `${open.length} बैच का आज का हिसाब बाकी है: ${open.map((b) => b.name).slice(0, 3).join(", ")}${open.length > 3 ? "…" : ""}।`), btn: B("Open My Farms", "मेरे फार्म खोलें"), to: `#/admin/farms`, sec: "today" }); }
  // 2. online orders waiting for approval
  const pend = orders.filter((o) => o.status === "Pending").length;
  if (pend) add(95, "sales", "warn", B(`Approve ${pend} online ${pend === 1 ? "order" : "orders"} waiting for your OK.`, `${pend} ऑनलाइन ऑर्डर आपकी मंज़ूरी का इंतज़ार कर रहे हैं, उन्हें मंज़ूर करें।`), B("Review orders", "ऑर्डर देखें"), "online");
  // 3. things the farm itself is shouting about
  const has = (re) => A.alerts.find((a) => re.test(a.text));
  if (has(/Feed is running low/)) add(92, "feed", "bad", B(`Buy or mix feed today: only about ${num(A.tot.daysLeft)} days of feed left.`, `आज ही दाना खरीदें या बनाएँ: सिर्फ करीब ${num(A.tot.daysLeft)} दिन का दाना बचा है।`), B("Feed stock", "दाना स्टॉक"));
  const lastDeaths = (A.rows[A.rows.length - 1] || {}).deaths || 0;
  if (has(/More birds died/)) add(98, "mortality", "bad", B(`Check the birds now: ${lastDeaths} died today, more than usual.`, `अभी मुर्गियों को देखें: आज ${lastDeaths} मरीं, रोज़ से ज़्यादा।`), B("See deaths", "मौतें देखें"));
  if (has(/Egg laying is low/)) add(70, "production", "warn", B("Egg laying is low: check feed, clean water and light in the shed.", "अंडे कम आ रहे हैं: दाना, साफ पानी और शेड की रोशनी जाँचें।"), B("See advice", "सलाह देखें"));
  if (has(/Packing material is short|empty (boxes|trays)/)) add(60, "purchases", "warn", B("Buy empty trays and boxes: the packing stock is low.", "खाली ट्रे और डिब्बे खरीदें: पैकिंग का सामान कम है।"), B("Buy now", "खरीदें"));
  // 4. tasks that are due (for example cleaning the water tanks, a vaccination)
  F.tasks.filter((x) => x.status === "Open" && x.date <= t && (!batchId || !x.batchId || x.batchId === batchId)).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 2)
    .forEach((x) => add(x.date < t ? 90 : 85, "tasks", x.date < t ? "bad" : "warn", B(`${x.title}${x.date < t ? ` (was due on ${x.date})` : " (due today)"}`, `${x.title}${x.date < t ? ` (${x.date} को करना था)` : " (आज करना है)"}`), B("Open tasks", "काम देखें")));
  // 5. money to collect
  if (A.tot.owed > 0) add(50, "sales", "info", B(`Collect ${inr(A.tot.owed)} that customers have not paid yet.`, `ग्राहकों से ${inr(A.tot.owed)} की बकाया रकम वसूल करें।`), B("Who owes me", "किसका बाकी है"), "owed");
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

export default function PriorityActions({ A, orders, batchId = "" }) {
  const F = useFarmData();
  const list = priorityList({ F, A, orders, batchId });
  if (role() === "Viewer") return null;
  return (
    <section className={"card prio " + (list.length ? "" : "clear")} aria-label="Today's Priority Actions">
      <h3 className="ih"><Ia n={list.length ? "alert" : "ok"} s={20} /> <Bi en="Today's Priority Actions" hi="आज के सबसे ज़रूरी काम" /></h3>
      {list.length ? <ol>{list.map((x, i) => (
        <li key={x.text.en} className={x.level}>
          <span className="pnum">{i + 1}</span>
          <span className="ptext"><b><Bi en={x.text.en} hi={x.text.hi} /></b>{i === 0 && <em><Bi en="Do this first" hi="सबसे पहले यह करें" /></em>}</span>
          <button type="button" className="btn sm" onClick={() => { location.hash = x.to; }}><Bi en={x.btn.en} hi={x.btn.hi} /></button>
        </li>))}</ol>
        : <p className="muted"><Bi en="Nothing urgent. Today's work is done. You can add sales or expenses anytime." hi="कोई ज़रूरी काम बाकी नहीं है। आज का काम पूरा है। बिक्री या खर्च कभी भी जोड़ सकते हैं।" /></p>}
    </section>
  );
}
