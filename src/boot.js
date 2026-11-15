// Runs once, before anything is drawn. Demo on: make sure sample data exists. Demo off: if sample data from an earlier demo run is
// still in this browser, remove it, so the owner starts with a clean, empty system.
import { DEMO } from "./config.js";
import { seedDemo } from "./farm.js";

const DEMO_KEYS = ["kf_farms", "kf_batches", "kf_logs", "kf_feed", "kf_adj", "kf_exp", "kf_boxes", "kf_boxadj", "kf_boxcfg", "kf_raw", "kf_rawbuy", "kf_mix", "kf_recipes", "kf_trays", "kf_trayadj",
  "kf_staff", "kf_sup", "kf_cust", "kf_cf", "kf_notif", "kf_tasks", "kf_docs", "kf_team", "kf_ftypes", "kf_products", "kf_orders", "kf_txns", "kf_coupons", "kf_charges", "kf_pricing", "kf_coupon",
  "kf_cart", "kf_wish", "kf_tickets", "kf_farm", "kf_admin", "kf_pin", "kf_session", "kf_lock", "kf_seeded", "kf_demo"];

export function boot() {
  try {
    const ls = localStorage;
    if (DEMO) {
      if (!ls.getItem("kf_seeded")) { seedDemo(true); ls.setItem("kf_seeded", "1"); ls.setItem("kf_demo", "1"); }
      return;
    }
    if (ls.getItem("kf_demo")) {
      DEMO_KEYS.forEach((k) => ls.removeItem(k));
      // keep real customer accounts; drop only the demo customer
      try { const us = JSON.parse(ls.getItem("kf_users") || "[]").filter((u) => u.id !== "demo-user"); ls.setItem("kf_users", JSON.stringify(us)); } catch { ls.removeItem("kf_users"); }
      ["kf_ok", "kf_role", "kf_who"].forEach((k) => sessionStorage.removeItem(k));
    }
  } catch { /* storage blocked: the app still opens, just empty */ }
}
boot();
