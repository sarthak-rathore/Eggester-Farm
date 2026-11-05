import { useLS, inr } from "./store.js";
import { FARM } from "./config.js";

export const SEED_COUPONS = [
  { id: "c1", code: "WELCOME5", label: "5% off your first bulk order (up to ₹500)", type: "percent", value: 5, minOrder: 2000, maxDiscount: 500, auto: "No", visible: "Yes", firstOrderOnly: "Yes", limit: 0, expires: "", active: "Yes" },
  { id: "c2", code: "FREEDEL", label: "Free delivery on orders above ₹3000", type: "freeship", value: 0, minOrder: 3000, maxDiscount: 0, auto: "No", visible: "Yes", firstOrderOnly: "No", limit: 0, expires: "", active: "Yes" },
  { id: "c3", code: "BULK100", label: "₹100 off orders above ₹5000", type: "flat", value: 100, minOrder: 5000, maxDiscount: 0, auto: "Yes", visible: "No", firstOrderOnly: "No", limit: 0, expires: "", active: "Yes" },
];
export const SEED_CHARGES = [{ id: "x1", label: "Packaging", type: "flat", value: 10, active: "Yes" }];
export const defaultPricing = () => ({ gst: 0, gstMode: "inclusive", gstin: "", minOrder: 0, deliveryFee: FARM.deliveryFee, freeAbove: FARM.freeAbove, cod: true, upi: true, card: true });

export function usePricing() {
  const [stored] = useLS("kf_pricing", {});
  const [coupons] = useLS("kf_coupons", SEED_COUPONS);
  const [charges] = useLS("kf_charges", SEED_CHARGES);
  const [code, setCode] = useLS("kf_coupon", "");
  return { pr: { ...defaultPricing(), ...stored }, coupons, charges, code, setCode };
}

const r2 = (n) => Math.round(n * 100) / 100;
export function computeBill({ lines, products, pr, coupons, charges, code, user, orders }) {
  const sub = r2(lines.reduce((a, l) => a + l.price * l.qty, 0));
  const day = new Date().toISOString().slice(0, 10);
  const prior = user ? orders.filter((o) => o.userId === user.id && o.status !== "Cancelled").length : 0;
  const uses = (c) => orders.filter((o) => o.coupon === c.code && o.status !== "Cancelled").length;
  const valid = (c) => c.active !== "No" && (!c.expires || c.expires >= day) && sub >= (+c.minOrder || 0) && (!(+c.limit > 0) || uses(c) < +c.limit) && (c.firstOrderOnly !== "Yes" || (user && prior === 0));
  const amt = (c) => (c.type === "freeship" ? 0 : r2(c.type === "percent" ? Math.min((sub * +c.value) / 100, +c.maxDiscount > 0 ? +c.maxDiscount : Infinity) : Math.min(+c.value || 0, sub)));
  let offer = null, note = "";
  const entered = (code || "").trim().toUpperCase();
  if (entered) {
    const c = coupons.find((x) => (x.code || "").toUpperCase() === entered && x.auto !== "Yes");
    if (!c || c.active === "No") note = "This coupon code is not valid.";
    else if (c.expires && c.expires < day) note = "This coupon has expired.";
    else if (sub < (+c.minOrder || 0)) note = `Add ${inr(+c.minOrder - sub)} more to use ${c.code}.`;
    else if (c.firstOrderOnly === "Yes" && !(user && prior === 0)) note = user ? "This coupon is only for a first order." : "Log in to use this first-order coupon.";
    else if (!valid(c)) note = "This coupon is no longer available.";
    else offer = c;
  }
  if (!offer) offer = coupons.filter((c) => c.auto === "Yes" && valid(c)).sort((a, b) => amt(b) - amt(a))[0] || null;
  const moqIssue = lines.find((l) => l.moq && l.qty < l.moq) || null;
  const discount = offer ? amt(offer) : 0;
  const freeShip = offer?.type === "freeship";
  const after = r2(sub - discount);
  let gst = 0;
  lines.forEach((l) => {
    const p = products.find((x) => x.id === l.id) || {};
    const rate = p.gst !== undefined && p.gst !== "" ? +p.gst : +pr.gst || 0;
    const net = sub ? l.price * l.qty * (after / sub) : 0;
    gst += pr.gstMode === "exclusive" ? (net * rate) / 100 : (net * rate) / (100 + rate);
  });
  gst = r2(gst);
  const freeAbove = +pr.freeAbove || 0, fee = +pr.deliveryFee || 0;
  const delivery = !sub || freeShip || after >= freeAbove ? 0 : fee;
  const extras = sub ? charges.filter((c) => c.active !== "No").map((c) => ({ label: c.label, amount: r2(c.type === "percent" ? (after * +c.value) / 100 : +c.value || 0) })).filter((x) => x.amount > 0) : [];
  const total = r2(after + (pr.gstMode === "exclusive" ? gst : 0) + delivery + extras.reduce((a, x) => a + x.amount, 0));
  return { sub, discount, offer, note, moqIssue, gst, gstMode: pr.gstMode, delivery, extras, total, freeShip,
    toFree: sub && !freeShip && after < freeAbove ? r2(freeAbove - after) : 0,
    belowMin: sub > 0 && sub < (+pr.minOrder || 0), minOrder: +pr.minOrder || 0,
    saved: r2(discount + (freeShip && after < freeAbove ? fee : 0)) };
}
