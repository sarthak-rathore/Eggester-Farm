import React, { useState, useEffect, useRef } from "react";
import { FARM, DEMO, DEMO_OWNER, CUSTOMERS } from "./config.js";
import { Ic } from "./icons.jsx";
import { useLS, uid, today, inr, localYmd } from "./store.js";
import { hash, salt, check, lockedFor, failLogin, clearFails } from "./auth.js";
import { usePricing, computeBill } from "./pricing.js";
import Bill from "./Bill.jsx";
import { SiteHeader, Hero, Marquee, Heading, Why, How, Story, Gallery, goTo, Icon } from "./Landing.jsx";
import { useStock, makeLines, stepQty, tiers, TRAY } from "./farm.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const STEPS = ["Pending", "Confirmed", "Out for delivery", "Delivered"];
export const PAYNAME = { COD: "Cash on delivery", UPI: "UPI (pay after ordering)", Razorpay: "Card, UPI or net banking" };
const loadRzp = () => new Promise((ok, no) => { if (window.Razorpay) return ok(); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
const tilt = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; e.currentTarget.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(6px)`; };
const untilt = (e) => (e.currentTarget.style.transform = "");
const Modal = ({ title, onClose, side, children }) => (
  <div className="modal" onClick={onClose}><div className={"sheet" + (side ? " side" : "")} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
    <div className="bar"><h3>{title}</h3><button className="x" aria-label="Close" onClick={onClose}>×</button></div>{children}</div></div>
);
export function invoice(o) {
  const w = window.open("", "_blank"); if (!w) return alert("Allow pop-ups to open the invoice.");
  let gstin = ""; try { gstin = JSON.parse(localStorage.getItem("kf_pricing") || "{}").gstin || ""; } catch {}
  const row = (l, v) => `<tr><td colspan="2">${esc(l)}</td><td align="right">${v}</td></tr>`;
  const extra = (o.subtotal !== undefined ? row("Subtotal", inr(o.subtotal)) : "") + (+o.discount > 0 ? row("Discount" + (o.coupon ? ` (${o.coupon})` : ""), "-" + inr(o.discount)) : "") + (o.charges || []).map((x) => row(x.label, inr(x.amount))).join("") + row("Delivery", o.delivery ? inr(o.delivery) : "Free") + (+o.gst > 0 ? row(o.gstMode === "exclusive" ? "GST" : "GST (included in prices)", inr(o.gst)) : "");
  w.document.write(`<title>Invoice ${esc(o.id)}</title><body style="font-family:sans-serif;max-width:640px;margin:30px auto"><h2>${esc(FARM.name)}</h2><p>${esc(FARM.address)}<br>${esc(FARM.phone)}${gstin ? "<br>GSTIN: " + esc(gstin) : ""}</p><h3>Invoice ${esc(o.id)} · ${esc(o.date)}</h3><p>${esc(o.name)}, ${esc(o.phone)}<br>${esc(o.address)}</p><table width="100%" border="1" cellspacing="0" cellpadding="6"><tr><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr>${(o.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td align="center">${i.qty}</td><td align="right">${inr(i.price * i.qty)}</td></tr>`).join("")}${extra}<tr><td colspan="2"><b>Total</b></td><td align="right"><b>${inr(o.total)}</b></td></tr></table><p>Payment: ${esc(PAYNAME[o.payMethod] || o.payMethod)} (${esc(o.payStatus)})</p><p>Thank you for choosing ${esc(FARM.name)}.</p></body>`);
  w.document.close(); w.print();
}

export default function Shop({ products, orders, setOrders, setProducts }) {
  const [cart, setCart] = useLS("kf_cart", {});
  const [users, setUsers] = useLS("kf_users", []);
  const [pin] = useLS("kf_pin", DEMO_OWNER.password);
  const [sid, setSid] = useLS("kf_session", null);
  const user = users.find((u) => u.id === sid && !u.blocked) || null;
  const [view, setView] = useState(null);
  const [wish, setWish] = useLS("kf_wish", {});
  useEffect(() => { // soft fade-in of each section as it scrolls into view
    const els = [...document.querySelectorAll(".sec, .grid > *, .rv, .faq details, .contact > *")]; if (!("IntersectionObserver" in window)) return els.forEach((x) => x.classList.add("in"));
    els.forEach((x) => x.classList.add("reveal")); const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((x) => io.observe(x)); return () => io.disconnect();
  }, [products.length]);
  useEffect(() => { const v = sessionStorage.getItem("kf_open"); if (v && CUSTOMERS) setView(v); if (v) sessionStorage.removeItem("kf_open"); }, []);
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All");
  const [f, setF] = useState({ name: "", phone: "", address: "", note: "" });
  const [pay, setPay] = useState("COD"); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("login"); const [err, setErr] = useState(""); const [af, setAf] = useState({ name: "", phone: "", email: "", password: "" });
  const seeding = useRef(false);
  useEffect(() => {
    if (!DEMO || seeding.current || users.some((u) => u.email === "demo@customer.com")) return;
    seeding.current = true;
    (async () => {
      const sl = salt();
      const u = { id: "demo-user", name: "Demo Customer", phone: "9876500000", email: "demo@customer.com", salt: sl, hash: await hash("Demo@123", sl), address: "12 Market Road, Muzaffarpur, Bihar", addresses: [{ id: "a1", label: "Home", name: "Demo Customer", phone: "9876500000", line: "12 Market Road, Muzaffarpur, Bihar", pin: "842001", def: true }], joined: today() };
      setUsers((us) => (us.some((x) => x.email === u.email) ? us : [...us, u]));
      const items = [{ id: "p1", name: "Farm eggs, standard tray (30)", unit: "tray", price: 210, qty: 20, eggs: 30 }];
      const base = { userId: u.id, name: u.name, phone: u.phone, address: u.address, note: "", items, subtotal: 4200, delivery: 150, total: 4360, payMethod: "COD", charges: [{ label: "Packaging", amount: 10 }], discount: 0, coupon: "", gst: 0 };
      const ago = localYmd(Date.now() - 5 * 864e5);
      setOrders((os) => (os.some((o) => o.id === "DEMO01") ? os : [{ ...base, id: "DEMO02", date: today(), payStatus: "Unpaid", payRef: "", status: "Confirmed" }, { ...base, id: "DEMO01", date: ago, payStatus: "Paid", payRef: "", status: "Delivered" }, ...os]));
    })().catch(() => {}).finally(() => { seeding.current = false; });
  }, [users]);
  useEffect(() => { if (user) setF((x) => ({ ...x, name: user.name, phone: user.phone, address: (user.addresses?.find((a) => a.def) || user.addresses?.[0])?.line || user.address || x.address })); }, [sid]);

  const wl = (user && wish[user.id]) || [];
  const toggleWish = (id) => { if (!user) return setView("auth"); setWish((w) => ({ ...w, [user.id]: wl.includes(id) ? wl.filter((i) => i !== id) : [...wl, id] })); };
  const S = useStock(orders);
  const lines = makeLines(products, cart, S.stockOf);
  const P = usePricing();
  const bill = computeBill({ lines, products, ...P, user, orders });
  const total = bill.total, count = lines.reduce((x, l) => x + l.qty, 0);
  const methods = [P.pr.cod && "COD", FARM.upiId && P.pr.upi && "UPI", FARM.razorpayKey && P.pr.card && "Razorpay"].filter(Boolean);
  useEffect(() => { if (methods.length && !methods.includes(pay)) setPay(methods[0]); }, [methods.join()]);
  const shown = products.filter((p) => p.active !== "No");
  const setQty = (p, d) => setCart((c) => ({ ...c, [p.id]: stepQty(p, c[p.id] || 0, d, S.stockOf(p)) }));
  const setN = (p, n) => setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min(S.stockOf(p), Math.round(+n) || 0)) }));
  
  const finalize = (o) => {
    setOrders((os) => [o, ...os]);
    setCart({}); setDone(o); setView("done"); setBusy(false);
  };
  const place = async (e) => {
    e.preventDefault(); if (!lines.length || busy) return;
    if (lines.reduce((a, l) => a + l.qty * l.eggs, 0) > S.pool) return alert(`Only ${Math.floor(S.pool / TRAY)} trays are available right now. Please reduce your quantity.`);
    const o = { id: uid().toUpperCase(), date: today(), userId: user?.id || null, name: f.name, phone: f.phone, address: f.address, note: f.note, items: lines, subtotal: bill.sub, discount: bill.discount, coupon: bill.offer?.code || "", gst: bill.gst, gstMode: P.pr.gstMode, delivery: bill.delivery, charges: bill.extras, total, payMethod: pay, payStatus: "Unpaid", payRef: "", status: "Pending" };
    if (pay === "Razorpay") {
      setBusy(true);
      try {
        await loadRzp();
        new window.Razorpay({ key: FARM.razorpayKey, amount: Math.round(total * 100), currency: "INR", name: FARM.name, description: "Order " + o.id, prefill: { name: f.name, contact: f.phone },
          handler: (r) => finalize({ ...o, payStatus: "Paid", payRef: r.razorpay_payment_id }), modal: { ondismiss: () => setBusy(false) } }).open();
      } catch { setBusy(false); alert("The payment window could not open. Check your connection or choose another payment method."); }
      return;
    }
    finalize(o);
  };
  const submitAuth = async (e) => {
    e.preventDefault(); setErr("");
    const email = af.email.trim().toLowerCase();
    if (mode === "signup") {
      if ((DEMO && email === DEMO_OWNER.email) || users.some((u) => u.email === email)) return setErr("An account with this email exists. Log in instead.");
      if (af.password.length < 6) return setErr("Use a password of at least 6 characters.");
      const s = salt(); const u = { id: uid(), name: af.name, phone: af.phone, email, salt: s, hash: await hash(af.password, s), address: "", joined: today() };
      setUsers((us) => [...us, u]); setSid(u.id);
    } else {
      const wait = lockedFor("c:" + email); if (wait) return setErr(`Too many wrong tries. Please wait ${Math.ceil(wait / 60)} minute(s) and try again.`);
      if (DEMO && email === DEMO_OWNER.email && af.password === pin) {
        sessionStorage.setItem("kf_ok", "1"); setAf({ name: "", phone: "", email: "", password: "" }); setView(null); location.hash = "#/admin"; return;
      }
      const u = users.find((x) => x.email === email);
      if (!u || !(await check(af.password, u.salt, u.hash))) { failLogin("c:" + email); return setErr("Email or password is incorrect."); }
      clearFails("c:" + email);
      if (u.blocked) return setErr("This account has been blocked. Please contact the farm.");
      setSid(u.id);
    }
    setAf({ name: "", phone: "", email: "", password: "" }); setView(null);
  };
  const mine = user ? orders.filter((o) => o.userId === user.id) : [];
  const upiLink = (o) => `upi://pay?pa=${encodeURIComponent(FARM.upiId)}&pn=${encodeURIComponent(FARM.name)}&am=${o.total}&cu=INR&tn=${encodeURIComponent("Order " + o.id)}`;
  const waText = (o) => `New order ${o.id}\nName: ${o.name}\nPhone: ${o.phone}\nAddress: ${o.address}\n` + o.items.map((l) => `- ${l.name} x ${l.qty} = ${inr(l.price * l.qty)}`).join("\n") + `\nDelivery: ${inr(o.delivery)}\nTotal: ${inr(o.total)}\nPayment: ${PAYNAME[o.payMethod]}`;

  return (
    <>
      <SiteHeader user={user} count={count} onLogin={() => setView("auth")} onCart={() => setView("cart")} />

      <Hero ready={Math.floor(S.pool / TRAY)} delivery={P.pr.deliveryFee} freeAbove={P.pr.freeAbove} />
      <Marquee />
      {FARM.announcement && <div className="banner">{FARM.announcement}</div>}

      <section id="products" className="band">
        <Heading eyebrow="Our eggs" title="Wholesale egg trays" text={CUSTOMERS ? `Sold by the tray of ${TRAY} eggs. Minimum order and bulk prices are shown on each product. Order more, pay less per tray.` : `Sold by the tray of ${TRAY} eggs. Minimum order and bulk prices are shown on each product. Call, WhatsApp or email us to place your order.`} />
        {!shown.length && <p className="empty-note">Our egg prices are being set up. Please call us or check back soon.</p>}
        <div className="grid">
          {shown.map((p) => { const st = S.stockOf(p), tr = tiers(p), n = cart[p.id] || 0; return (
            <article key={p.id} className="pcard" onPointerMove={tilt} onPointerLeave={untilt}>
              {CUSTOMERS && <button className="heart" aria-label={wl.includes(p.id) ? "Remove from wishlist" : "Save to wishlist"} onClick={() => toggleWish(p.id)}><Ic n="heart" s={18} fill={wl.includes(p.id) ? "currentColor" : "none"} /></button>}
              <div className="pimg"><img src={p.photo || FARM.photos.eggs} alt={p.name} loading="lazy" decoding="async" /></div><h3>{p.name}</h3><p className="muted">{p.desc}</p>
              <div className="price"><b>{inr(p.price)}</b> {+p.mrp > +p.price && <><s className="muted">{inr(p.mrp)}</s> <span className="badge s-delivered">{Math.round(100 - (p.price / p.mrp) * 100)}% off</span> </>}<span className="muted">per {p.unit}</span></div>
              <ul className="tiers">{tr.map((t) => <li key={t.min}><span>{t.min}+ trays</span><b>{inr(t.price)} each</b></li>)}</ul>
              <p className="muted sm">Minimum order {+p.moq || 1} trays{CUSTOMERS ? ` · ${st > 0 ? `${st} trays available` : "out of stock"}` : ""}</p>
              {!CUSTOMERS ? <div className="howto"><b>To order, contact us</b><div className="row">{FARM.phone && <a className="btn sm" href={`tel:${FARM.phone.replace(/\s/g, "")}`}><Ic n="phone" s={16} /> Call</a>}{FARM.whatsapp && <a className="btn sm ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${FARM.whatsapp}?text=${encodeURIComponent("Hello, I would like to order: " + p.name)}`}><Ic n="chat" s={16} /> WhatsApp</a>}{FARM.email && <a className="btn sm ghost" href={`mailto:${FARM.email}?subject=${encodeURIComponent("Order enquiry: " + p.name)}`}><Ic n="mail" s={16} /> Email</a>}</div></div>
              : st > 0 ? (
                <div className="qty"><button aria-label="Remove one" onClick={() => setQty(p, -1)}><Ic n="minus" s={16} /></button><input type="number" min="0" aria-label={`Trays of ${p.name}`} value={n} onChange={(e) => setN(p, e.target.value)} /><button aria-label="Add one" onClick={() => setQty(p, 1)}><Ic n="plus" s={16} /></button><button className="chipbtn" onClick={() => setQty(p, 10)}>+10</button></div>
              ) : <p className="out">Sold out for now</p>}
            </article>); })}
        </div>
      </section>

      <Why moq={shown.length ? Math.min(...shown.map((p) => +p.moq || 1)) : 0} tray={TRAY} />
      <How />
      <Story ready={Math.floor(S.pool / TRAY)} moq={shown.length ? Math.min(...shown.map((p) => +p.moq || 1)) : 0} delivery={P.pr.deliveryFee} />
      <Gallery />

      <section id="faq" className="band faq">
        <Heading eyebrow="Help" title="Questions, answered" />
        {[["What is the minimum order?", "Each product shows its minimum number of trays. Larger orders get lower prices per tray."],
          ["How fast do you deliver?", "Orders confirmed before 6 PM are delivered the next morning. Very large orders can be scheduled in advance."],
          ["What does delivery cost?", `${inr(P.pr.deliveryFee)} per order, free above ${inr(P.pr.freeAbove)}.`],
          ["How can I pay?", "Pay cash on delivery" + (FARM.upiId ? ", by UPI" : "") + (FARM.razorpayKey ? ", or by card and net banking online." : ".")],
          ["Can I get a GST invoice?", "Yes. Every order has a downloadable invoice in your account."],
          ["Can I cancel an order?", "Yes. Open your account and cancel any order that is still Pending. Otherwise call us."]].filter(([a]) => CUSTOMERS || !/account|cancel|pay|GST|invoice/i.test(a)).map(([a, b]) => <details key={a}><summary>{a}</summary><p>{b}</p></details>)}
      </section>

      <section id="contact" className="band alt contact">
        <div>
          <h2>Visit or call us</h2>
          <p><b>{FARM.name}</b>{FARM.address && <><br />{FARM.address}</>}</p>{FARM.hours && <p>{FARM.hours}</p>}
          <p>{FARM.phone && <a href={`tel:${FARM.phone.replace(/\s/g, "")}`}>{FARM.phone}</a>}{FARM.phone && FARM.email && <br />}{FARM.email && <a href={`mailto:${FARM.email}`}>{FARM.email}</a>}</p>
          <div className="row">{FARM.whatsapp && <a className="btn" href={`https://wa.me/${FARM.whatsapp}`} target="_blank" rel="noreferrer"><Ic n="chat" s={18} /> Chat on WhatsApp</a>}{FARM.mapUrl && <a className="btn ghost" href={FARM.mapUrl} target="_blank" rel="noreferrer"><Ic n="pin" s={18} /> Open in Google Maps</a>}</div>
        </div>
        {FARM.address ? <iframe title="Farm location" loading="lazy" referrerPolicy="no-referrer" src={`https://www.google.com/maps?q=${encodeURIComponent(FARM.address)}&output=embed`} />
          : FARM.mapUrl && <a className="mapcard" href={FARM.mapUrl} target="_blank" rel="noreferrer"><img src={FARM.photos.gallery[0].src} alt="" loading="lazy" decoding="async" /><span><Ic n="pin" s={22} /> Find us on Google Maps<small>Tap to open directions</small></span></a>}
      </section>
      <footer className="site-foot"><div><img className="foot-logo" src={FARM.logoFull} alt={FARM.name} width="150" height="150" loading="lazy" /><p>{FARM.tagline}</p></div>
        <div className="foot-links"><a href="#products" onClick={goTo("products")}>Shop</a><a href="#about" onClick={goTo("about")}>Our farm</a><a href="#gallery" onClick={goTo("gallery")}>Photos</a><a href="#contact" onClick={goTo("contact")}>Visit us</a></div>
        <small>© {new Date().getFullYear()} {FARM.name}. All rights reserved. · <a href="#/admin">Owner login</a></small></footer>

      {view === "cart" && (
        <Modal side title="Your basket" onClose={() => setView(null)}>
          {!lines.length ? <p className="muted">Your basket is empty. Add eggs or chicken to get started.</p> : <>
            {lines.map((l) => { const p = products.find((x) => x.id === l.id); return (
              <div className="line" key={l.id}><span>{l.name}<br /><small className="muted">{inr(l.price)} per {l.unit}{l.price < l.base ? " (bulk price)" : ""} · min {l.moq}</small></span>
                <span className="qty"><button aria-label="Remove one" onClick={() => setQty(p, -1)}><Ic n="minus" s={16} /></button><span>{l.qty}</span><button aria-label="Add one" onClick={() => setQty(p, 1)}><Ic n="plus" s={16} /></button></span><b>{inr(l.price * l.qty)}</b></div>); })}
            <Bill bill={bill} coupons={P.coupons} code={P.code} setCode={P.setCode} onCheckout={() => setView("checkout")} /></>}
        </Modal>
      )}
      {view === "checkout" && (
        <Modal title="Checkout" onClose={() => setView(null)}>
          {!user && <p className="muted">Have an account? <a href="#/" onClick={(e) => { e.preventDefault(); setView("auth"); }}>Log in</a> to fill in your details and track this order.</p>}
          <form className="form" onSubmit={place}>
            {(user?.addresses || []).length > 0 && <label>Deliver to<select defaultValue="" onChange={(e) => { const a = user.addresses.find((x) => x.id === e.target.value); if (a) setF({ ...f, name: a.name || f.name, phone: a.phone || f.phone, address: a.line }); }}><option value="">Choose a saved address</option>{user.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}: {a.line}</option>)}</select></label>}
            <label>Your name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Phone number<input required type="tel" pattern="[0-9+ ]{10,15}" title="Enter a valid phone number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label>Delivery address<textarea required rows="2" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
            <label>Note (optional)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <fieldset className="pay"><legend>Payment</legend>{methods.map((m) => <label key={m} className="radio"><input type="radio" name="pay" checked={pay === m} onChange={() => setPay(m)} />{PAYNAME[m]}</label>)}</fieldset>
            <Bill bill={bill} coupons={P.coupons} code={P.code} setCode={P.setCode} />
            <button className="btn" disabled={busy || !lines.length || bill.belowMin || !!bill.moqIssue || !methods.length}>{busy ? "Opening payment…" : pay === "Razorpay" ? "Pay and place order" : "Place order"}</button>
          </form>
        </Modal>
      )}
      {view === "done" && done && (
        <Modal title={`Order ${done.id} placed`} onClose={() => setView(null)}>
          <p>Thank you, {done.name}. Total {inr(done.total)}. Payment: {PAYNAME[done.payMethod]}{done.payStatus === "Paid" ? " (paid)" : ""}.</p>
          <div className="row">
            {done.payMethod === "UPI" && <a className="btn" href={upiLink(done)}>Pay {inr(done.total)} with UPI</a>}
            {FARM.whatsapp && <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${FARM.whatsapp}?text=${encodeURIComponent(waText(done))}`}>Send order on WhatsApp</a>}
            <button className="btn ghost" onClick={() => invoice(done)}>Invoice</button>
          </div>
          <p className="muted">We will call you to confirm delivery. {user ? "Track this order in your account." : "Create an account next time to track orders."}</p>
        </Modal>
      )}
      {view === "auth" && (
        <Modal title={mode === "login" ? "Log in" : "Create account"} onClose={() => setView(null)}>
          <form className="form" onSubmit={submitAuth}>
            {mode === "signup" && <><label>Full name<input required value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} /></label>
              <label>Phone number<input required type="tel" value={af.phone} onChange={(e) => setAf({ ...af, phone: e.target.value })} /></label></>}
            <label>Email<input required type="email" value={af.email} onChange={(e) => setAf({ ...af, email: e.target.value })} /></label>
            <label>Password<input required type="password" value={af.password} onChange={(e) => setAf({ ...af, password: e.target.value })} /></label>
            {mode === "login" && DEMO && <p className="hint">Demo customer: <b>demo@customer.com</b> / <b>Demo@123</b> <button type="button" className="link" onClick={() => setAf({ ...af, email: "demo@customer.com", password: "Demo@123" })}>Fill in</button></p>}
            {mode === "login" && DEMO && <p className="hint">Demo owner: <b>{DEMO_OWNER.email}</b> / <b>{pin}</b> <button type="button" className="link" onClick={() => setAf({ ...af, email: DEMO_OWNER.email, password: pin })}>Fill in</button></p>}
            {mode === "login" && !DEMO && <p className="muted">Farm owner? Use <a href="#/admin">Owner login</a>.</p>}
            {err && <p className="out" role="alert">{err}</p>}
            <button className="btn">{mode === "login" ? "Log in" : "Create account"}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
