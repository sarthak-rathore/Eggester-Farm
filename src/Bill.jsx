import React, { useState } from "react";
import { inr } from "./store.js";

export default function Bill({ bill, coupons, code, setCode, onCheckout, cta = "Checkout" }) {
  const [v, setV] = useState("");
  const day = new Date().toISOString().slice(0, 10);
  const apply = (c) => { const x = c.trim().toUpperCase(); if (x) { setCode(x); setV(""); } };
  const chips = coupons.filter((c) => c.visible === "Yes" && c.auto !== "Yes" && c.active !== "No" && (!c.expires || c.expires >= day));
  const manual = bill.offer && bill.offer.auto !== "Yes" && (code || "").trim().toUpperCase() === (bill.offer.code || "").toUpperCase();
  return (
    <div className="bill">
      <div className="line"><span>Subtotal</span><b>{inr(bill.sub)}</b></div>
      {bill.discount > 0 && <div className="line save"><span>Discount ({bill.offer.code})</span><b>−{inr(bill.discount)}</b></div>}
      <div className="line"><span>Delivery{bill.freeShip ? " (offer applied)" : ""}</span><b>{bill.delivery ? inr(bill.delivery) : "Free"}</b></div>
      {bill.extras.map((x) => <div className="line" key={x.label}><span>{x.label}</span><b>{inr(x.amount)}</b></div>)}
      {bill.gst > 0 && <div className={"line" + (bill.gstMode === "inclusive" ? " muted" : "")}><span>{bill.gstMode === "inclusive" ? "GST (already in the prices)" : "GST"}</span><b>{inr(bill.gst)}</b></div>}
      <div className="line tot"><span>Total</span><b>{inr(bill.total)}</b></div>
      {bill.saved > 0 && <p className="savebadge">You are saving {inr(bill.saved)} on this order{bill.offer?.auto === "Yes" ? ` (${bill.offer.label})` : ""}.</p>}
      {bill.toFree > 0 && <p className="muted">Add {inr(bill.toFree)} more for free delivery.</p>}
      {bill.moqIssue && <p className="out" role="alert">{bill.moqIssue.name}: the minimum order is {bill.moqIssue.moq} trays. Add {bill.moqIssue.moq - bill.moqIssue.qty} more.</p>}
      {bill.belowMin && <p className="out" role="alert">The minimum order is {inr(bill.minOrder)}. Add {inr(bill.minOrder - bill.sub)} more to continue.</p>}
      {!!bill.sub && (
        <div className="coupon">
          {manual ? <div className="applied"><span>✓ <b>{bill.offer.code}</b> applied</span><button type="button" className="link" onClick={() => setCode("")}>Remove</button></div> : (
            <div className="row"><input aria-label="Coupon code" placeholder="Coupon code" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(v); } }} /><button type="button" className="btn sm ghost" onClick={() => apply(v)}>Apply</button></div>)}
          {bill.note && <p className="out" role="alert">{bill.note}</p>}
          {!manual && !!chips.length && <div className="chips">{chips.map((c) => <button type="button" key={c.id} title={c.label} onClick={() => apply(c.code)}>{c.code}</button>)}</div>}
        </div>
      )}
      {onCheckout && <button type="button" className="btn" disabled={!bill.sub || bill.belowMin || !!bill.moqIssue} onClick={onCheckout}>{cta}</button>}
    </div>
  );
}
