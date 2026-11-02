import React, { useState } from "react";
import { FARM } from "./config.js";
import { useLS, uid, today, inr, useUser } from "./store.js";
import { hash, salt } from "./auth.js";
import { STEPS, PAYNAME, invoice } from "./Shop.jsx";
import { usePricing, computeBill } from "./pricing.js";
import Bill from "./Bill.jsx";

const TABS = [["overview", "Overview"], ["orders", "My orders"], ["track", "Track order"], ["wishlist", "Wishlist"], ["basket", "Basket"], ["addresses", "Addresses"], ["payments", "Payments"], ["profile", "Profile"], ["security", "Password & security"], ["support", "Help & complaints"]];
const go = (t) => (location.hash = "#/account/" + t);
const openShop = (view) => { if (view) sessionStorage.setItem("kf_open", view); location.hash = "#/"; };
const done = (o) => ["Delivered", "Cancelled"].includes(o.status);
const Badge = ({ s }) => <span className={"badge s-" + String(s).toLowerCase().replace(/\s/g, "-")}>{s}</span>;
const Stepper = ({ status }) => status === "Cancelled" ? <p className="out">This order was cancelled.</p> : <div className="steps">{STEPS.map((s, i) => <span key={s} className={i <= STEPS.indexOf(status) ? "on" : ""}>{s}</span>)}</div>;
const Empty = ({ text, cta, onCta }) => <div className="empty"><p>{text}</p>{cta && <button className="btn sm" onClick={onCta}>{cta}</button>}</div>;
const Msg = ({ m }) => (m ? <p className={m[0] === "e" ? "out" : "okmsg"} role="status">{m.slice(2)}</p> : null);

export default function Account({ products, orders, setOrders, setProducts }) {
  const U = useUser();
  const { user } = U;
  const [cart, setCart] = useLS("kf_cart", {});
  const [wish, setWish] = useLS("kf_wish", {});
  const [tickets, setTickets] = useLS("kf_tickets", []);
  const [sel, setSel] = useState("");
  const tab = location.hash.split("/")[2] || "overview";
  const Top = <header className="nav"><a href="#/" className="logo">🥚 {FARM.name}</a><nav><a className="btn sm ghost" href="#/">Back to shop</a></nav></header>;
  if (!user) return <>{Top}<div className="login"><div className="card form"><h2>Log in to see your account</h2><p className="muted">Your orders, addresses and wishlist live here.</p><button className="btn" onClick={() => openShop("auth")}>Log in or create account</button></div></div></>;

  const mine = orders.filter((o) => o.userId === user.id);
  const wl = wish[user.id] || [];
  const addrs = user.addresses || (user.address ? [{ id: "home", label: "Home", name: user.name, phone: user.phone, line: user.address, pin: "", def: true }] : []);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const act = mine.filter((o) => !done(o)).length;
  const restock = (o) => setProducts((ps) => ps.map((p) => { const i = (o.items || []).find((i) => i.id === p.id); return i ? { ...p, stock: +p.stock + i.qty } : p; }));
  const c = { ...U, mine, wl, addrs, products, cart, setCart, setWish, tickets, setTickets, sel, setSel, orders,
    reorder: (o) => { setCart(Object.fromEntries(o.items.map((i) => [i.id, i.qty]))); openShop("cart"); },
    cancel: (o) => { if (confirm("Cancel this order?")) { setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: "Cancelled" } : x))); restock(o); } } };
  const View = { overview: Overview, orders: Orders, track: Track, wishlist: Wishlist, basket: Basket, addresses: Addresses, payments: Payments, profile: Profile, security: Security, support: Support }[tab] || Overview;
  return (
    <>
      {Top}
      <div className="acct">
        <aside className="acct-side">
          <div className="who"><div className="avatar">{user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div><div><b>{user.name}</b><span className="muted">{user.email}</span></div></div>
          <nav>{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}>{l}{k === "orders" && act ? <i>{act}</i> : null}{k === "basket" && count ? <i>{count}</i> : null}</button>)}</nav>
          <button className="btn sm ghost" onClick={() => { U.setSid(null); location.hash = "#/"; }}>Log out</button>
        </aside>
        <main className="acct-main"><View c={c} /></main>
      </div>
    </>
  );
}

function Overview({ c }) {
  const act = c.mine.filter((o) => !done(o));
  const spent = c.mine.filter((o) => o.status !== "Cancelled").reduce((a, o) => a + +o.total, 0);
  return (
    <>
      <h2>Hello, {c.user.name.split(" ")[0]}</h2><p className="muted">Here is what is happening with your orders.</p>
      <div className="kpis">{[["Orders placed", c.mine.length], ["Total spent", inr(spent)], ["Active orders", act.length], ["Wishlist items", c.wl.length]].map(([a, b]) => <div className="kpi" key={a}><span>{a}</span><b>{b}</b></div>)}</div>
      <section className="card"><h3>Active orders</h3>
        {!act.length ? <Empty text="No orders on the way right now." cta="Shop eggs and chicken" onCta={() => openShop()} /> : act.map((o) => (
          <div className="order-row" key={o.id}><div className="bar"><b>#{o.id}</b><Badge s={o.status} /></div><Stepper status={o.status} /><button className="btn sm ghost" onClick={() => { c.setSel(o.id); go("track"); }}>Track order</button></div>))}
      </section>
      <section className="card"><h3>Quick actions</h3><div className="row">
        <button className="btn sm" onClick={() => openShop()}>Shop now</button>
        {c.mine[0] && <button className="btn sm ghost" onClick={() => c.reorder(c.mine[0])}>Order again</button>}
        <button className="btn sm ghost" onClick={() => go("addresses")}>Manage addresses</button>
        <button className="btn sm ghost" onClick={() => go("support")}>Get help</button></div></section>
      <section className="card"><h3>Recent orders</h3>{!c.mine.length && <p className="muted">Your orders will appear here after your first purchase.</p>}
        {c.mine.slice(0, 3).map((o) => <div className="line" key={o.id}><span>#{o.id} · {o.date}</span><span><Badge s={o.status} /> <b>{inr(o.total)}</b></span></div>)}
        {c.mine.length > 3 && <button className="link" onClick={() => go("orders")}>View all orders</button>}</section>
    </>
  );
}

function Orders({ c }) {
  const [flt, setFlt] = useState("All"); const [q, setQ] = useState("");
  const t = q.toLowerCase();
  const list = c.mine.filter((o) => (flt === "All" || (flt === "Active" ? !done(o) : o.status === flt)) && (o.id.toLowerCase().includes(t) || o.items.some((i) => i.name.toLowerCase().includes(t))));
  return (
    <>
      <div className="bar"><h2>My orders</h2><input className="search" type="search" placeholder="Search by order or item" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips">{["All", "Active", "Delivered", "Cancelled"].map((f) => <button key={f} className={f === flt ? "on" : ""} onClick={() => setFlt(f)}>{f}</button>)}</div>
      {!list.length && <Empty text={c.mine.length ? "No orders match this filter." : "You have not placed any orders yet."} cta="Start shopping" onCta={() => openShop()} />}
      {list.map((o) => (
        <article className="card ocard" key={o.id}>
          <div className="bar"><div><b>Order #{o.id}</b><div className="muted">{o.date}</div></div><div className="right"><Badge s={o.status} /><b>{inr(o.total)}</b></div></div>
          <ul className="items">{o.items.map((i) => <li key={i.id}><span>{i.name} × {i.qty}</span><span>{inr(i.price * i.qty)}</span></li>)}<li className="muted"><span>Delivery</span><span>{o.delivery ? inr(o.delivery) : "Free"}</span></li></ul>
          <Stepper status={o.status} />
          <p className="muted">Deliver to: {o.address}<br />Payment: {PAYNAME[o.payMethod]} · <Badge s={o.payStatus} /></p>
          <div className="row">
            {o.status !== "Cancelled" && <button className="btn sm" onClick={() => { c.setSel(o.id); go("track"); }}>Track</button>}
            <button className="btn sm ghost" onClick={() => c.reorder(o)}>Order again</button>
            <button className="btn sm ghost" onClick={() => invoice(o)}>Invoice</button>
            {o.status === "Pending" && <button className="btn sm ghost" onClick={() => c.cancel(o)}>Cancel order</button>}
            <button className="btn sm ghost" onClick={() => { sessionStorage.setItem("kf_ticket_order", o.id); go("support"); }}>Report a problem</button>
          </div>
        </article>
      ))}
    </>
  );
}

function Track({ c }) {
  const o = c.mine.find((x) => x.id === c.sel) || c.mine.find((x) => !done(x)) || c.mine[0];
  if (!o) return <><h2>Track order</h2><Empty text="You have no orders to track yet." cta="Shop now" onCta={() => openShop()} /></>;
  const idx = STEPS.indexOf(o.status);
  const info = ["We have received your order.", "Your order is confirmed and being packed fresh.", "Your order is on its way to you.", "Delivered. Enjoy your fresh produce."];
  return (
    <>
      <h2>Track order</h2>
      <div className="chips">{c.mine.map((x) => <button key={x.id} className={x.id === o.id ? "on" : ""} onClick={() => c.setSel(x.id)}>#{x.id}</button>)}</div>
      <section className="card">
        <div className="bar"><h3>Order #{o.id}</h3><Badge s={o.status} /></div>
        {o.status === "Cancelled" ? <p className="out">This order was cancelled. Call us if this is a mistake.</p> :
          <ol className="timeline">{STEPS.map((s, i) => <li key={s} className={i < idx || o.status === "Delivered" ? "done" : i === idx ? "now" : ""}><b>{s}</b><span>{info[i]}</span></li>)}</ol>}
        <p className="muted">Delivering to: {o.address}<br />Total: {inr(o.total)} · {PAYNAME[o.payMethod]}</p>
        <div className="row"><a className="btn sm" href={`tel:${FARM.phone.replace(/\s/g, "")}`}>Call the farm</a><a className="btn sm ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${FARM.whatsapp}?text=${encodeURIComponent("Hello, about my order " + o.id)}`}>WhatsApp us</a></div>
      </section>
    </>
  );
}

function Wishlist({ c }) {
  const items = c.products.filter((p) => c.wl.includes(p.id));
  return (
    <>
      <h2>Wishlist</h2>
      {!items.length && <Empty text="Tap the heart on any product in the shop to save it here." cta="Browse products" onCta={() => openShop()} />}
      <div className="wgrid">{items.map((p) => (
        <article className="card" key={p.id}><div className="emoji">{p.emoji}</div><h3>{p.name}</h3><p><b>{inr(p.price)}</b> <span className="muted">per {p.unit}</span></p>
          <div className="row">{p.stock > 0 ? <button className="btn sm" onClick={() => c.setCart((x) => ({ ...x, [p.id]: Math.min(p.stock, (x[p.id] || 0) + 1) }))}>Add to basket</button> : <span className="out">Sold out</span>}
            <button className="btn sm ghost" onClick={() => c.setWish((w) => ({ ...w, [c.user.id]: c.wl.filter((i) => i !== p.id) }))}>Remove</button></div></article>))}</div>
    </>
  );
}

function Basket({ c }) {
  const P = usePricing();
  const lines = c.products.filter((p) => c.cart[p.id] > 0 && p.active !== "No").map((p) => ({ id: p.id, name: p.name, unit: p.unit, price: +p.price, qty: Math.min(c.cart[p.id], p.stock), p })).filter((l) => l.qty > 0);
  const bill = computeBill({ lines, products: c.products, ...P, user: c.user, orders: c.orders });
  const set = (p, d) => c.setCart((x) => ({ ...x, [p.id]: Math.max(0, Math.min(p.stock, (x[p.id] || 0) + d)) }));
  return (
    <>
      <h2>Basket</h2>
      {!lines.length ? <Empty text="Your basket is empty." cta="Shop now" onCta={() => openShop()} /> : (
        <section className="card">
          {lines.map(({ p, qty, name }) => <div className="line" key={p.id}><span>{name}<br /><small className="muted">{inr(p.price)} per {p.unit}</small></span>
            <span className="qty"><button aria-label="Remove one" onClick={() => set(p, -1)}>−</button><span>{qty}</span><button aria-label="Add one" onClick={() => set(p, 1)}>+</button></span><b>{inr(p.price * qty)}</b></div>)}
          <Bill bill={bill} coupons={P.coupons} code={P.code} setCode={P.setCode} onCheckout={() => openShop("checkout")} cta="Go to checkout" />
        </section>
      )}
    </>
  );
}

function Addresses({ c }) {
  const [ed, setEd] = useState(null); const list = c.addrs;
  const commit = (n) => c.update({ addresses: n, address: (n.find((x) => x.def) || {}).line || "" });
  const save = (a) => { let n = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]; n = n.map((x) => ({ ...x, def: a.def ? x.id === a.id : x.def })); if (!n.some((x) => x.def)) n[0] = { ...n[0], def: true }; commit(n); setEd(null); };
  const del = (id) => { let n = list.filter((x) => x.id !== id); if (n.length && !n.some((x) => x.def)) n[0] = { ...n[0], def: true }; commit(n); };
  const F = (k, l, p = {}) => <label>{l}<input value={ed[k] || ""} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} {...p} /></label>;
  return (
    <>
      <div className="bar"><h2>Saved addresses</h2><button className="btn sm" onClick={() => setEd({ id: uid(), label: "Home", name: c.user.name, phone: c.user.phone, line: "", pin: "", def: !list.length })}>Add address</button></div>
      {ed && <form className="card form grid2" onSubmit={(e) => { e.preventDefault(); save(ed); }}>
        {F("label", "Label (Home, Farm, Office)", { required: true })}{F("name", "Contact name", { required: true })}{F("phone", "Phone", { required: true, type: "tel" })}{F("pin", "PIN code", { inputMode: "numeric", pattern: "[0-9]{6}", title: "6-digit PIN code", required: true })}
        <label className="wide">Full address<textarea required rows="2" value={ed.line} onChange={(e) => setEd({ ...ed, line: e.target.value })} /></label>
        <label className="radio wide"><input type="checkbox" checked={!!ed.def} onChange={(e) => setEd({ ...ed, def: e.target.checked })} />Make this my default address</label>
        <div className="row"><button className="btn sm">Save address</button><button type="button" className="btn sm ghost" onClick={() => setEd(null)}>Cancel</button></div></form>}
      {!list.length && !ed && <Empty text="You have no saved addresses. Add one to check out faster." />}
      <div className="wgrid">{list.map((a) => (
        <article className="card" key={a.id}><div className="bar"><h3>{a.label}</h3>{a.def && <span className="badge s-confirmed">Default</span>}</div>
          <p>{a.name}, {a.phone}<br />{a.line}{a.pin ? ` - ${a.pin}` : ""}</p>
          <div className="row"><button className="btn sm ghost" onClick={() => setEd(a)}>Edit</button>{!a.def && <button className="btn sm ghost" onClick={() => save({ ...a, def: true })}>Set as default</button>}<button className="btn sm ghost" onClick={() => confirm("Delete this address?") && del(a.id)}>Delete</button></div></article>))}</div>
    </>
  );
}

function Payments({ c }) {
  const paid = c.mine.filter((o) => o.payStatus === "Paid").reduce((a, o) => a + +o.total, 0);
  const due = c.mine.filter((o) => o.payStatus === "Unpaid" && o.status !== "Cancelled").reduce((a, o) => a + +o.total, 0);
  const accepted = ["COD", FARM.upiId && "UPI", FARM.razorpayKey && "Razorpay"].filter(Boolean);
  return (
    <>
      <h2>Payment history</h2>
      <div className="kpis"><div className="kpi"><span>Paid so far</span><b>{inr(paid)}</b></div><div className="kpi"><span>To pay on delivery or by UPI</span><b>{inr(due)}</b></div></div>
      <section className="card"><h3>Payments</h3>
        {!c.mine.length ? <p className="muted">Payments for your orders will be listed here.</p> :
          <div className="scroll"><table><thead><tr><th>Date</th><th>Order</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody>{c.mine.map((o) => <tr key={o.id}><td>{o.date}</td><td>#{o.id}</td><td>{PAYNAME[o.payMethod]}</td><td><Badge s={o.payStatus} /></td><td>{inr(o.total)}</td></tr>)}</tbody></table></div>}</section>
      <section className="card"><h3>Ways to pay</h3><p className="muted">{accepted.map((m) => PAYNAME[m]).join(", ")}. Card and bank details are handled by the payment provider and are never saved on this site.</p></section>
    </>
  );
}

function Profile({ c }) {
  const u = c.user;
  const [p, setP] = useState({ name: u.name, phone: u.phone, email: u.email, wa: u.wa !== false, offers: !!u.offers, upi: u.upi || "" });
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  const save = async (e) => {
    e.preventDefault(); setMsg("");
    const email = p.email.trim().toLowerCase();
    if (email !== u.email) {
      if (c.users.some((x) => x.email === email && x.id !== u.id)) return setMsg("e|That email is already used by another account.");
      if ((await hash(pw, u.salt)) !== u.hash) return setMsg("e|Enter your current password to change your email.");
    }
    c.update({ name: p.name, phone: p.phone, email, wa: p.wa, offers: p.offers, upi: p.upi }); setPw(""); setMsg("s|Profile saved.");
  };
  return (
    <>
      <h2>Profile</h2>
      <form className="card form grid2" onSubmit={save}>
        <label>Full name<input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label>Phone<input required type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
        <label>Email<input required type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></label>
        <label>Preferred UPI ID (optional)<input value={p.upi} placeholder="name@bank" onChange={(e) => setP({ ...p, upi: e.target.value })} /></label>
        {p.email.trim().toLowerCase() !== u.email && <label className="wide">Current password (needed to change email)<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>}
        <label className="radio wide"><input type="checkbox" checked={p.wa} onChange={(e) => setP({ ...p, wa: e.target.checked })} />Send me order updates on WhatsApp and phone</label>
        <label className="radio wide"><input type="checkbox" checked={p.offers} onChange={(e) => setP({ ...p, offers: e.target.checked })} />Tell me about offers and seasonal produce</label>
        <div className="row wide"><button className="btn sm">Save profile</button></div><div className="wide"><Msg m={msg} /></div>
        <p className="muted wide">Member since {u.joined || "today"}</p>
      </form>
    </>
  );
}

function Security({ c }) {
  const u = c.user;
  const [f, setF] = useState({ cur: "", n: "", n2: "" }); const [msg, setMsg] = useState(""); const [del, setDel] = useState("");
  const change = async (e) => {
    e.preventDefault();
    if ((await hash(f.cur, u.salt)) !== u.hash) return setMsg("e|Your current password is incorrect.");
    if (f.n.length < 6) return setMsg("e|Use at least 6 characters for the new password.");
    if (f.n !== f.n2) return setMsg("e|The new passwords do not match.");
    const s = salt(); c.update({ salt: s, hash: await hash(f.n, s) }); setF({ cur: "", n: "", n2: "" }); setMsg("s|Password updated.");
  };
  const remove = async (e) => {
    e.preventDefault();
    if ((await hash(del, u.salt)) !== u.hash) return setMsg("e|Password is incorrect. Your account was not deleted.");
    if (!confirm("Delete your account permanently? Past orders stay with the farm for its records.")) return;
    c.setUsers((us) => us.filter((x) => x.id !== u.id)); c.setSid(null); location.hash = "#/";
  };
  return (
    <>
      <h2>Password & security</h2>
      <form className="card form" onSubmit={change}><h3>Change password</h3>
        <label>Current password<input type="password" autoComplete="current-password" required value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} /></label>
        <label>New password<input type="password" autoComplete="new-password" required value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required value={f.n2} onChange={(e) => setF({ ...f, n2: e.target.value })} /></label>
        <Msg m={msg} /><div className="row"><button className="btn sm">Update password</button></div></form>
      <section className="card"><h3>Where you are signed in</h3><p className="muted">This device (current session). Log out from the menu when using a shared phone or computer.</p></section>
      <form className="card form danger" onSubmit={remove}><h3>Delete account</h3><p className="muted">This removes your profile, addresses and wishlist. It cannot be undone.</p>
        <label>Enter your password to confirm<input type="password" required value={del} onChange={(e) => setDel(e.target.value)} /></label><div className="row"><button className="btn sm ghost">Delete my account</button></div></form>
    </>
  );
}

function Support({ c }) {
  const pre = sessionStorage.getItem("kf_ticket_order") || "";
  const [f, setF] = useState({ type: "Order issue", orderId: pre, message: "" }); const [ok, setOk] = useState("");
  const mineT = c.tickets.filter((t) => t.userId === c.user.id);
  const submit = (e) => {
    e.preventDefault(); sessionStorage.removeItem("kf_ticket_order");
    const t = { id: "T" + uid().toUpperCase().slice(0, 5), userId: c.user.id, name: c.user.name, phone: c.user.phone, email: c.user.email, ...f, date: today(), status: "Open", reply: "" };
    c.setTickets((ts) => [t, ...ts]); setF({ type: "Order issue", orderId: "", message: "" }); setOk(`s|Request ${t.id} sent. We usually reply within one working day.`);
  };
  return (
    <>
      <h2>Help & complaints</h2>
      <form className="card form grid2" onSubmit={submit}><h3 className="wide">Tell us what went wrong</h3>
        <label>Topic<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Order issue", "Product quality", "Delivery", "Payment or refund", "Account", "Other"].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Related order (optional)<select value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })}><option value="">Not about an order</option>{c.mine.map((o) => <option key={o.id} value={o.id}>#{o.id} · {o.date}</option>)}</select></label>
        <label className="wide">Message<textarea required rows="4" minLength="10" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Send request</button></div><div className="wide"><Msg m={ok} /></div></form>
      <section className="card"><h3>Your requests</h3>{!mineT.length && <p className="muted">Requests you send will appear here with our replies.</p>}
        {mineT.map((t) => <div className="order-row" key={t.id}><div className="bar"><b>{t.type} · {t.id}</b><Badge s={t.status} /></div><p className="muted">{t.date}{t.orderId ? ` · Order #${t.orderId}` : ""}</p><p>{t.message}</p>{t.reply && <p className="reply"><b>Reply from {FARM.name}:</b> {t.reply}</p>}</div>)}</section>
      <section className="card"><h3>Contact us directly</h3><p className="muted">{FARM.hours}</p><div className="row"><a className="btn sm" href={`tel:${FARM.phone.replace(/\s/g, "")}`}>{FARM.phone}</a><a className="btn sm ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${FARM.whatsapp}`}>WhatsApp</a><a className="btn sm ghost" href={`mailto:${FARM.email}`}>Email</a></div></section>
    </>
  );
}
