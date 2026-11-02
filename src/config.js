// Values come from environment variables (see .env.example); defaults keep the site working with no setup.
const e = import.meta.env;
export const FARM = {
  name: e.VITE_FARM_NAME || "Kesariya Farms",
  tagline: "Free-range eggs and chicken, from our coop to your door",
  headline: "Eggs laid today. At your door tomorrow.",
  about: "We keep our flock in open, airy sheds with daylight, clean water and balanced grain feed. Eggs are collected by hand each morning, checked, graded and packed within hours.",
  announcement: "",
  phone: e.VITE_FARM_PHONE || "+91 98765 43210",
  whatsapp: e.VITE_FARM_WHATSAPP || "919876543210",
  email: e.VITE_FARM_EMAIL || "hello@kesariyafarms.in",
  address: e.VITE_FARM_ADDRESS || "Kesariya Road, East Champaran, Bihar 845438",
  hours: "Open daily, 6 AM to 8 PM",
  adminEmail: e.VITE_ADMIN_EMAIL || "admin@kesariyafarms.in",
  pin: e.VITE_ADMIN_PASSWORD || "Admin@123",
  demo: e.VITE_SHOW_DEMO_LOGINS !== "false", // set to "false" before going live
  deliveryFee: +(e.VITE_DELIVERY_FEE || 40),
  freeAbove: +(e.VITE_FREE_DELIVERY_ABOVE || 500),
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
  { id: "p1", cat: "Eggs", name: "Farm eggs, tray of 30", unit: "tray", price: 210, mrp: 230, stock: 120, emoji: "🥚", desc: "Collected every morning, graded and packed the same day." },
  { id: "p2", cat: "Eggs", name: "Farm eggs, dozen", unit: "dozen", price: 90, stock: 200, emoji: "🥚", desc: "Our everyday eggs in a handy pack of 12." },
  { id: "p3", cat: "Eggs", name: "Desi eggs, dozen", unit: "dozen", price: 150, stock: 60, emoji: "🪺", desc: "Country-breed hens, richer yolks." },
  { id: "p4", cat: "Chicken", name: "Live chicken", unit: "kg", price: 190, stock: 80, emoji: "🐓", desc: "Healthy, grain-fed birds, weighed in front of you." },
  { id: "p5", cat: "Chicken", name: "Dressed chicken", unit: "kg", price: 260, mrp: 280, stock: 50, emoji: "🍗", desc: "Cleaned and cut, ready for the pan." },
  { id: "p6", cat: "Farm", name: "Poultry manure, 50 kg bag", unit: "bag", price: 120, gst: 5, stock: 40, emoji: "🌱", desc: "Rich compost for kitchen gardens and fields." },
];

// Owner-edited farm details (Admin > Account > Farm details) override the defaults above.
try {
  const o = JSON.parse(localStorage.getItem("kf_farm") || "{}");
  ["name", "phone", "whatsapp", "email", "address", "hours", "upiId", "tagline", "headline", "about", "announcement"].forEach((k) => o[k] && (FARM[k] = o[k]));
  ["deliveryFee", "freeAbove"].forEach((k) => o[k] !== undefined && o[k] !== "" && (FARM[k] = +o[k]));
} catch {}
