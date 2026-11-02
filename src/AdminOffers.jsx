import React, { useState } from "react";
import { FARM } from "./config.js";
import { useLS, inr } from "./store.js";
import { SEED_COUPONS, SEED_CHARGES, defaultPricing } from "./pricing.js";
import Crud from "./Crud.jsx";

const SUB = [["pricing", "Tax & delivery"], ["coupons", "Coupons & offers"], ["charges", "Extra charges"], ["payments", "Payment options"]];
const crud = (set) => ({ onSave: (r) => set((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [r, ...rs])), onDelete: (id) => set((rs) => rs.filter((x) => x.id !== id)) });

export default function AdminOffers({ orders }) {
  const [sub, setSub] = useState("pricing");
  const [stored, setStored] = useLS("kf_pricing", {});
  const [coupons, setCoupons] = useLS("kf_coupons", SEED_COUPONS);
  const [charges, setCharges] = useLS("kf_charges", SEED_CHARGES);
  const [f, setF] = useState({ ...defaultPricing(), ...stored });
  const [saved, setSaved] = useState("");
  const live = orders.filter((o) => o.status !== "Cancelled");
  const K = [["Discounts given", inr(live.reduce((a, o) => a + (+o.discount || 0), 0))], ["GST on orders", inr(live.reduce((a, o) => a + (+o.gst || 0), 0))], ["Orders using a coupon", live.filter((o) => o.coupon).length]];
  const save = (e) => { e.preventDefault(); setStored({ ...f, gst: +f.gst || 0, minOrder: +f.minOrder || 0, deliveryFee: +f.deliveryFee || 0, freeAbove: +f.freeAbove || 0 }); setSaved("Saved. The shop uses these values straight away."); };
  const N = (k, l, h) => <label>{l}<input type="number" min="0" step="any" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{h && <small className="muted">{h}</small>}</label>;
  const C = (k, l, h) => <label className="radio wide"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}{h && <small className="muted"> {h}</small>}</label>;
  return (
    <>
      <div className="bar"><h2>Offers & pricing</h2></div>
      <div className="kpis">{K.map(([a, b]) => <div className="kpi" key={a}><span>{a}</span><b>{b}</b></div>)}</div>
      <div className="chips">{SUB.map(([k, l]) => <button key={k} className={k === sub ? "on" : ""} onClick={() => { setSub(k); setSaved(""); }}>{l}</button>)}</div>

      {sub === "pricing" && <form className="card form grid2" onSubmit={save}>
        {N("gst", "Default GST rate (%)", "Products can override this. Check the correct rates for eggs, chicken and manure with your accountant.")}
        <label>How GST is charged<select value={f.gstMode} onChange={(e) => setF({ ...f, gstMode: e.target.value })}><option value="inclusive">Already included in product prices</option><option value="exclusive">Added on top of prices</option></select></label>
        <label className="wide">GSTIN (printed on invoices)<input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></label>
        {N("deliveryFee", "Delivery fee (₹)")}{N("freeAbove", "Free delivery above (₹)", "0 means delivery is always free.")}{N("minOrder", "Minimum order value (₹)", "0 means no minimum.")}
        <div className="row wide"><button className="btn sm">Save</button></div><p className="okmsg wide">{saved}</p></form>}

      {sub === "coupons" && <Crud title="Coupons and offers" blank={{ type: "percent", value: "", minOrder: 0, maxDiscount: 0, auto: "No", visible: "Yes", firstOrderOnly: "No", limit: 0, expires: "", active: "Yes" }}
        onSave={(r) => crud(setCoupons).onSave({ ...r, code: String(r.code || "").trim().toUpperCase() })} onDelete={crud(setCoupons).onDelete} rows={coupons}
        fields={[{ k: "code", label: "Code" }, { k: "label", label: "Description shown to customers" }, { k: "type", label: "Type", opts: ["percent", "flat", "freeship"] }, { k: "value", label: "Value (% or ₹)", type: "number", req: false },
          { k: "minOrder", label: "Minimum order (₹)", type: "number", req: false }, { k: "maxDiscount", label: "Maximum discount (₹, 0 = none)", type: "number", req: false }, { k: "auto", label: "Apply automatically", opts: ["No", "Yes"] },
          { k: "visible", label: "Show code to customers", opts: ["Yes", "No"] }, { k: "firstOrderOnly", label: "First order only", opts: ["No", "Yes"] }, { k: "limit", label: "Total uses allowed (0 = unlimited)", type: "number", req: false },
          { k: "expires", label: "Expires on", type: "date", req: false }, { k: "active", label: "Active", opts: ["Yes", "No"] },
          { k: "used", label: "Used", noForm: true, fmt: (_, r) => orders.filter((o) => o.coupon === r.code && o.status !== "Cancelled").length }]} />}

      {sub === "charges" && <Crud title="Extra charges (packaging, handling, service)" blank={{ type: "flat", value: "", active: "Yes" }} {...crud(setCharges)} rows={charges}
        fields={[{ k: "label", label: "Name shown on the bill" }, { k: "type", label: "Charged as", opts: ["flat", "percent"] }, { k: "value", label: "Amount (₹ or % of order)", type: "number" }, { k: "active", label: "Active", opts: ["Yes", "No"] }]} />}

      {sub === "payments" && <form className="card form grid2" onSubmit={save}>
        <h3 className="wide">Payment options customers can choose</h3>
        {C("cod", "Cash on delivery")}
        {C("upi", "UPI", FARM.upiId ? "" : "(also needs a UPI ID under Account > Farm details)")}
        {C("card", "Card, UPI and net banking through Razorpay", FARM.razorpayKey ? "" : "(also needs VITE_RAZORPAY_KEY_ID in your Vercel settings)")}
        <div className="row wide"><button className="btn sm">Save</button></div><p className="okmsg wide">{saved}</p></form>}
    </>
  );
}
