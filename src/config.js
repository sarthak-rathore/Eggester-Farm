// Values come from environment variables (see .env.example); defaults keep the site working with no setup.
// One-time reset when upgrading to the egg-farm edition (keeps accounts and logins).
try {
  if (!localStorage.getItem("kf_v4")) {
    // upgrade to the simple-dashboard edition: farm data moves to the new batch-wise layout, so start the demo fresh (accounts and logins are kept)
    ["kf_batches", "kf_logs", "kf_feed", "kf_adj", "kf_exp", "kf_boxes", "kf_boxadj", "kf_farms", "kf_boxcfg", "kf_seeded", "kf_orders", "kf_txns", "kf_raw", "kf_rawbuy", "kf_mix", "kf_recipes", "kf_trays", "kf_trayadj", "kf_staff", "kf_sup", "kf_cust", "kf_cf", "kf_notif", "kf_tasks", "kf_docs", "kf_team"].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("kf_v4", "1");
  }
  if (!localStorage.getItem("kf_v3")) {
    ["kf_products", "kf_orders", "kf_txns", "kf_prod", "kf_coupons", "kf_charges", "kf_pricing", "kf_cart", "kf_wish", "kf_farm", "kf_seeded", "kf_coupon", "kf_batches", "kf_logs", "kf_feed", "kf_adj", "kf_exp", "kf_boxes", "kf_boxadj", "kf_farms", "kf_boxcfg"].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("kf_v3", "1");
  }
} catch {}
const e = import.meta.env;
export const FARM = {
  name: e.VITE_FARM_NAME || "Kesariya Farms",
  tagline: "Fresh farm eggs in bulk trays for shops, hotels, bakeries and caterers",
  headline: "Fresh eggs by the tray. Wholesale rates.",
  about: "We buy day-old chicks, raise them on a balanced feed programme and collect eggs by hand every morning. Eggs are graded, packed in trays of 30 and delivered in bulk to shops, hotels, bakeries and caterers.",
  announcement: "",
  phone: e.VITE_FARM_PHONE || "+91 98765 43210",
  whatsapp: e.VITE_FARM_WHATSAPP || "919876543210",
  email: e.VITE_FARM_EMAIL || "hello@kesariyafarms.in",
  address: e.VITE_FARM_ADDRESS || "Kesariya Road, East Champaran, Bihar 845438",
  hours: "Open daily, 6 AM to 8 PM",
  adminEmail: e.VITE_ADMIN_EMAIL || "admin@kesariyafarms.in",
  pin: e.VITE_ADMIN_PASSWORD || "Admin@123",
  demo: e.VITE_SHOW_DEMO_LOGINS !== "false", // set to "false" before going live
  deliveryFee: +(e.VITE_DELIVERY_FEE || 150),
  freeAbove: +(e.VITE_FREE_DELIVERY_ABOVE || 5000),
  upiId: e.VITE_UPI_ID || "",
  razorpayKey: e.VITE_RAZORPAY_KEY_ID || "",
  supabaseUrl: e.VITE_SUPABASE_URL || "",
  photos: {
    hero: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70",
    hens: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=900&q=70",
    eggs: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=900&q=70",
  },
};
export const SEED_PRODUCTS = [
  // eggs = eggs per unit sold; moq = minimum trays per order; tiers = "trays:price per tray" bulk prices
  { id: "p1", name: "Farm eggs, standard tray (30)", unit: "tray", eggs: 30, price: 210, mrp: 230, moq: 10, tiers: "50:205,100:200,200:195", emoji: "🥚", desc: "Everyday white eggs, graded and packed in trays of 30." },
  { id: "p2", name: "Large eggs, premium tray (30)", unit: "tray", eggs: 30, price: 235, mrp: 255, moq: 10, tiers: "50:230,100:225", emoji: "🥚", desc: "Larger, heavier eggs for hotels and bakeries." },
];

// Owner-edited farm details (Admin > Account > Farm details) override the defaults above.
try {
  const o = JSON.parse(localStorage.getItem("kf_farm") || "{}");
  ["name", "phone", "whatsapp", "email", "address", "hours", "upiId", "tagline", "headline", "about", "announcement"].forEach((k) => o[k] && (FARM[k] = o[k]));
  ["deliveryFee", "freeAbove"].forEach((k) => o[k] !== undefined && o[k] !== "" && (FARM[k] = +o[k]));
} catch {}
