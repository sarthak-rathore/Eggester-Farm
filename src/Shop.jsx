import React, { useState, useEffect, useRef } from "react";
import { FARM } from "./config.js";
import { useLS, uid, today, inr } from "./store.js";
import { hash, salt } from "./auth.js";
import { usePricing, computeBill } from "./pricing.js";
import Bill from "./Bill.jsx";
import { useStock, makeLines, stepQty, tiers, TRAY } from "./farm.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const STEPS = ["Pending", "Confirmed", "Out for delivery", "Delivered"];
export const PAYNAME = { COD: "Cash on delivery", UPI: "UPI (pay after ordering)", Razorpay: "Card, UPI or net banking" };
const loadRzp = () => new Promise((ok, no) => { if (window.Razorpay) return ok(); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
const tilt = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; e.currentTarget.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(6px)`; };
const untilt = (e) => (e.currentTarget.style.transform = "");
const Photo = ({ src, alt, cls }) => <img className={cls} src={src} alt={alt} loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />;
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
  const [pin] = useLS("kf_pin", FARM.pin);
  const [sid, setSid] = useLS("kf_session", null);
  const user = users.find((u) => u.id === sid && !u.blocked) || null;
  const [view, setView] = useState(null);
  const [wish, setWish] = useLS("kf_wish", {});
  useEffect(() => { const v = sessionStorage.getItem("kf_open"); if (v) { setView(v); sessionStorage.removeItem("kf_open"); } }, []);
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All");
  const [f, setF] = useState({ name: "", phone: "", address: "", note: "" });
  const [pay, setPay] = useState("COD"); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("login"); const [err, setErr] = useState(""); const [af, setAf] = useState({ name: "", phone: "", email: "", password: "" });
  const seeding = useRef(false);
  useEffect(() => {
    if (!FARM.demo || seeding.current || users.some((u) => u.email === "demo@customer.com")) return;
    seeding.current = true;
    (async () => {
      const sl = salt();
      const u = { id: "demo-user", name: "Demo Customer", phone: "9876500000", email: "demo@customer.com", salt: sl, hash: await hash("Demo@123", sl), address: "12 Market Road, Muzaffarpur, Bihar", addresses: [{ id: "a1", label: "Home", name: "Demo Customer", phone: "9876500000", line: "12 Market Road, Muzaffarpur, Bihar", pin: "842001", def: true }], joined: today() };
      setUsers((us) => (us.some((x) => x.email === u.email) ? us : [...us, u]));
      const items = [{ id: "p1", name: "Farm eggs, standard tray (30)", unit: "tray", price: 210, qty: 20, eggs: 30 }];
      const base = { userId: u.id, name: u.name, phone: u.phone, address: u.address, note: "", items, subtotal: 4200, delivery: 150, total: 4360, payMethod: "COD", charges: [{ label: "Packaging", amount: 10 }], discount: 0, coupon: "", gst: 0 };
      const ago = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
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
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", (e.clientX - r.left) / r.width - 0.5); e.currentTarget.style.setProperty("--my", (e.clientY - r.top) / r.height - 0.5); };

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
      if (email === FARM.adminEmail.toLowerCase() || users.some((u) => u.email === email)) return setErr("An account with this email exists. Log in instead.");
      if (af.password.length < 6) return setErr("Use a password of at least 6 characters.");
      const s = salt(); const u = { id: uid(), name: af.name, phone: af.phone, email, salt: s, hash: await hash(af.password, s), address: "", joined: today() };
      setUsers((us) => [...us, u]); setSid(u.id);
    } else {
      if (email === FARM.adminEmail.toLowerCase() && af.password === pin) {
        sessionStorage.setItem("kf_ok", "1"); setAf({ name: "", phone: "", email: "", password: "" }); setView(null); location.hash = "#/admin"; return;
      }
      const u = users.find((x) => x.email === email);
      if (!u || u.hash !== (await hash(af.password, u.salt))) return setErr("Email or password is incorrect.");
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
      <header className="nav">
        <a href="#/" className="logo">🥚 {FARM.name}</a>
        <nav><a href="#products">Shop</a><a href="#about">Our farm</a><a href="#faq">Help</a><a href="#contact">Visit</a>
          {user ? <a className="btn sm ghost" href="#/account">{user.name.split(" ")[0]}</a> : <button className="btn sm ghost" onClick={() => setView("auth")}>Log in</button>}
          <button className="btn sm" onClick={() => setView("cart")}>Basket{count ? ` (${count})` : ""}</button></nav>
      </header>

      {FARM.announcement && <div className="banner">{FARM.announcement}</div>}
      <section className="hero" onPointerMove={move}>
        <div className="eggs" aria-hidden="true">
          {[["60%", "56%", 120, 0.4, 60, "0s"], ["72%", "10%", 170, 0.8, 120, "-2s"], ["88%", "60%", 90, 0.3, 40, "-4s"], ["54%", "76%", 70, 0.6, 90, "-1s"], ["58%", "6%", 60, 0.5, 70, "-3s"]].map(([l, t, s, z, d, dl], i) => (
            <div key={i} className="eggw" style={{ left: l, top: t, "--d": d + "px", "--z": z * 100 + "px" }}><div className="egg" style={{ "--s": s + "px", "--dl": dl }} /></div>
          ))}
        </div>
        <div className="hero-copy">
          <p className="pill">Wholesale egg supplier · East Champaran</p>
          <h1>{FARM.headline}</h1>
          <p className="lead">{FARM.tagline}. Collected by hand every morning, packed in trays of 30 and delivered in bulk.</p>
          <div className="row"><a className="btn" href="#products">Order eggs in bulk</a><a className="btn ghost light" href="#about">See the farm</a></div>
          <p className="lead small">{Math.floor(S.pool / TRAY)} trays ready now · Delivery {inr(P.pr.deliveryFee)}, free above {inr(P.pr.freeAbove)}</p>
        </div>
      </section>

      <section id="products" className="sec">
        <h2>Wholesale egg trays</h2>
        <p className="muted">Sold by the tray of {TRAY} eggs. Minimum order and bulk prices are shown on each product. Order more, pay less per tray.</p>
        <div className="grid">
          {shown.map((p) => { const st = S.stockOf(p), tr = tiers(p), n = cart[p.id] || 0; return (
            <article key={p.id} className="pcard" onPointerMove={tilt} onPointerLeave={untilt}>
              <button className="heart" aria-label={wl.includes(p.id) ? "Remove from wishlist" : "Save to wishlist"} onClick={() => toggleWish(p.id)}>{wl.includes(p.id) ? "♥" : "♡"}</button>
              <div className="emoji">{p.emoji}</div><h3>{p.name}</h3><p className="muted">{p.desc}</p>
              <div className="price"><b>{inr(p.price)}</b> {+p.mrp > +p.price && <><s className="muted">{inr(p.mrp)}</s> <span className="badge s-delivered">{Math.round(100 - (p.price / p.mrp) * 100)}% off</span> </>}<span className="muted">per {p.unit}</span></div>
              <ul className="tiers">{tr.map((t) => <li key={t.min}><span>{t.min}+ trays</span><b>{inr(t.price)} each</b></li>)}</ul>
              <p className="muted sm">Minimum order {+p.moq || 1} trays · {st > 0 ? `${st} trays available` : "out of stock"}</p>
              {st > 0 ? (
                <div className="qty"><button aria-label="Remove one" onClick={() => setQty(p, -1)}>−</button><input type="number" min="0" aria-label={`Trays of ${p.name}`} value={n} onChange={(e) => setN(p, e.target.value)} /><button aria-label="Add one" onClick={() => setQty(p, 1)}>+</button><button className="chipbtn" onClick={() => setQty(p, 10)}>+10</button></div>
              ) : <p className="out">Sold out for now</p>}
            </article>); })}
        </div>
      </section>

      <section id="about" className="sec about">
        <div className="about-txt">
          <h2>A small farm that does one thing well</h2>
          <p>{FARM.about}</p>
          <div className="stats"><div><b>{Math.floor(S.pool / TRAY)}</b><span>trays ready now</span></div><div><b>10 trays</b><span>minimum order</span></div><div><b>6 AM</b><span>daily collection</span></div></div>
        </div>
        <div className="photos"><Photo cls="ph a" src={FARM.photos.hens} alt="Hens at the farm" /><Photo cls="ph b" src={FARM.photos.eggs} alt="Fresh eggs" /><Photo cls="ph c" src={FARM.photos.hero} alt="Farm fields" /></div>
      </section>

      <section id="faq" className="sec faq">
        <h2>Questions, answered</h2>
        {[["What is the minimum order?", "Each product shows its minimum, usually 10 trays (300 eggs). Larger orders get lower prices per tray."],
          ["How fast do you deliver?", "Orders confirmed before 6 PM are delivered the next morning. Very large orders can be scheduled in advance."],
          ["What does delivery cost?", `${inr(P.pr.deliveryFee)} per order, free above ${inr(P.pr.freeAbove)}.`],
          ["How can I pay?", "Pay cash on delivery" + (FARM.upiId ? ", by UPI" : "") + (FARM.razorpayKey ? ", or by card and net banking online." : ".")],
          ["Can I get a GST invoice?", "Yes. Every order has a downloadable invoice in your account."],
          ["Can I cancel an order?", "Yes. Open your account and cancel any order that is still Pending. Otherwise call us."]].map(([a, b]) => <details key={a}><summary>{a}</summary><p>{b}</p></details>)}
      </section>

      <section id="contact" className="sec contact">
        <div>
          <h2>Visit or call us</h2>
          <p><b>{FARM.name}</b><br />{FARM.address}</p><p>{FARM.hours}</p>
          <p><a href={`tel:${FARM.phone.replace(/\s/g, "")}`}>{FARM.phone}</a><br /><a href={`mailto:${FARM.email}`}>{FARM.email}</a></p>
          <a className="btn" href={`https://wa.me/${FARM.whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
        </div>
        <iframe title="Farm location" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(FARM.address)}&output=embed`} />
      </section>
      <footer><span>© {new Date().getFullYear()} {FARM.name}</span><a href="#/admin">Owner login</a></footer>

      {view === "cart" && (
        <Modal side title="Your basket" onClose={() => setView(null)}>
          {!lines.length ? <p className="muted">Your basket is empty. Add eggs or chicken to get started.</p> : <>
            {lines.map((l) => { const p = products.find((x) => x.id === l.id); return (
              <div className="line" key={l.id}><span>{l.name}<br /><small className="muted">{inr(l.price)} per {l.unit}{l.price < l.base ? " (bulk price)" : ""} · min {l.moq}</small></span>
                <span className="qty"><button aria-label="Remove one" onClick={() => setQty(p, -1)}>−</button><span>{l.qty}</span><button aria-label="Add one" onClick={() => setQty(p, 1)}>+</button></span><b>{inr(l.price * l.qty)}</b></div>); })}
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
            <a className="btn ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${FARM.whatsapp}?text=${encodeURIComponent(waText(done))}`}>Send order on WhatsApp</a>
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
            {mode === "login" && FARM.demo && <p className="hint">Demo customer: <b>demo@customer.com</b> / <b>Demo@123</b> <button type="button" className="link" onClick={() => setAf({ ...af, email: "demo@customer.com", password: "Demo@123" })}>Fill in</button></p>}
            {mode === "login" && FARM.demo && <p className="hint">Demo owner: <b>{FARM.adminEmail}</b> / <b>{pin}</b> <button type="button" className="link" onClick={() => setAf({ ...af, email: FARM.adminEmail, password: pin })}>Fill in</button></p>}
            {mode === "login" && !FARM.demo && <p className="muted">Farm owner? Log in here with your owner email and password to open the dashboard.</p>}
            {err && <p className="out" role="alert">{err}</p>}
            <button className="btn">{mode === "login" ? "Log in" : "Create account"}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
