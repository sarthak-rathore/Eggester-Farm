import React, { useState, useEffect, lazy, Suspense } from "react";
import { FARM, SEED_PRODUCTS } from "./config.js";
import { useLS, uid, today, inr } from "./store.js";
import { seedDemo, upsert } from "./farm.js";
import Shop from "./Shop.jsx";
import Crud from "./Crud.jsx";
import { hash, salt } from "./auth.js";

const named = (f, n) => lazy(() => f().then((m) => ({ default: m[n] })));
const Dash = lazy(() => import("./Dash.jsx"));
const Account = lazy(() => import("./Account.jsx"));
const AdminAccount = lazy(() => import("./AdminAccount.jsx"));
const AdminOffers = lazy(() => import("./AdminOffers.jsx"));
const Flocks = named(() => import("./AdminFarm.jsx"), "Flocks");
const DailyLog = named(() => import("./AdminFarm.jsx"), "DailyLog");
const Feed = named(() => import("./AdminFarm.jsx"), "Feed");
const Eggs = named(() => import("./AdminFarm.jsx"), "Eggs");
const Money = named(() => import("./AdminFarm.jsx"), "Money");
const Lz = ({ children }) => <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>;

const useHash = () => {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => { setH(location.hash); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
};

export default function App() {
  const hash = useHash();
  const [products, setProducts] = useLS("kf_products", SEED_PRODUCTS);
  const [orders, setOrders] = useLS("kf_orders", []);
  const [txns, setTxns] = useLS("kf_txns", []);
  useEffect(() => { if (!localStorage.getItem("kf_seeded")) { seedDemo(FARM.demo); localStorage.setItem("kf_seeded", "1"); } }, []);
  const data = { products, setProducts, orders, setOrders, txns, setTxns };
  if (hash.startsWith("#/admin")) return <Admin {...data} />;
  if (hash.startsWith("#/account")) return <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Loading your account…</p>}><Account {...data} /></Suspense>;
  return <Shop {...data} />;
}

function Admin(d) {
  const [pin] = useLS("kf_pin", FARM.pin);
  const [ok, setOk] = useState(sessionStorage.getItem("kf_ok") === "1");
  const [tab, setTab] = useState("Dashboard");
  const [try_, setTry] = useState("");
  const [un, setUn] = useState("");
  const [tickets, setTickets] = useLS("kf_tickets", []);
  if (!ok)
    return (
      <div className="login"><form className="card form" onSubmit={(e) => { e.preventDefault(); if (un.trim().toLowerCase() === FARM.adminEmail.toLowerCase() && try_ === pin) { sessionStorage.setItem("kf_ok", "1"); setOk(true); } else alert("Email or password is incorrect."); }}>
        <h2>Owner login</h2>
        <label>Email<input type="email" autoFocus autoComplete="email" value={un} onChange={(e) => setUn(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" value={try_} onChange={(e) => setTry(e.target.value)} /></label>
        {FARM.demo && <p className="hint">Demo owner: <b>{FARM.adminEmail}</b> / <b>{pin}</b> <button type="button" className="link" onClick={() => { setUn(FARM.adminEmail); setTry(pin); }}>Fill in</button></p>}
        <button className="btn">Log in</button><a href="#/">Back to the shop</a></form></div>
    );
  const pending = d.orders.filter((o) => o.status === "Pending").length;
  const openT = tickets.filter((t) => t.status === "Open").length;
  const tabs = ["Dashboard", "Flocks", "Daily log", "Feed", "Egg stock", "Orders", "Customers", "Money", "Products", "Offers", "Support", "Account"];
  return (
    <div className="admin">
      <header className="nav dark"><span className="logo">🥚 {FARM.name} · Admin</span><div className="row"><a href="#/" className="btn sm ghost light">View shop</a>
        <button className="btn sm ghost light" aria-label="Log out" onClick={() => { sessionStorage.removeItem("kf_ok"); setOk(false); setTry(""); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>Log out</button></div></header>
      <div className="tabs">{tabs.map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{t}{t === "Orders" && pending ? <i>{pending}</i> : null}{t === "Support" && openT ? <i>{openT}</i> : null}</button>)}</div>
      <main className="wrap">
        {tab === "Dashboard" && <Lz><Dash {...d} /></Lz>}
        {tab === "Flocks" && <Lz><Flocks {...d} /></Lz>}
        {tab === "Daily log" && <Lz><DailyLog {...d} /></Lz>}
        {tab === "Feed" && <Lz><Feed {...d} /></Lz>}
        {tab === "Egg stock" && <Lz><Eggs {...d} /></Lz>}
        {tab === "Orders" && <Crud title="Wholesale orders" rows={d.orders} blank={{ date: today(), status: "Pending", items: [], total: 0, payMethod: "COD", payStatus: "Unpaid" }} {...upsert(d.setOrders)}
          fields={[{ k: "date", label: "Date", type: "date" }, { k: "name", label: "Customer" }, { k: "phone", label: "Phone" }, { k: "address", label: "Address" }, { k: "items", label: "Items", noForm: true, fmt: (v) => (v || []).map((i) => `${i.name} × ${i.qty}`).join(", ") },
            { k: "total", label: "Total", type: "number", fmt: inr }, { k: "discount", label: "Discount", type: "number", req: false, fmt: (v) => (+v ? "−" + inr(v) : "") }, { k: "payMethod", label: "Payment", opts: ["COD", "UPI", "Razorpay"] }, { k: "payStatus", label: "Paid?", opts: ["Unpaid", "Paid", "Refunded"] },
            { k: "status", label: "Status", opts: ["Pending", "Confirmed", "Out for delivery", "Delivered", "Cancelled"] }]} />}
        {tab === "Customers" && <Customers orders={d.orders} />}
        {tab === "Money" && <Lz><Money {...d} /></Lz>}
        {tab === "Products" && <Crud title="Egg products and bulk prices" rows={d.products} blank={{ emoji: "🥚", unit: "tray", eggs: 30, price: "", mrp: "", moq: 10, tiers: "", gst: "", desc: "", active: "Yes" }} {...upsert(d.setProducts)}
          fields={[{ k: "emoji", label: "Icon" }, { k: "name", label: "Name" }, { k: "unit", label: "Unit (tray)" }, { k: "eggs", label: "Eggs per unit", type: "number" }, { k: "price", label: "Price per tray (₹)", type: "number", fmt: inr }, { k: "mrp", label: "MRP / old price (₹)", type: "number", req: false, fmt: (v) => (v ? inr(v) : "") },
            { k: "moq", label: "Minimum trays per order", type: "number" }, { k: "tiers", label: "Bulk prices (trays:price, e.g. 50:205,100:200)", req: false }, { k: "gst", label: "GST % (blank = shop default)", type: "number", req: false }, { k: "desc", label: "Description", req: false }, { k: "active", label: "Show in shop", opts: ["Yes", "No"] }]} />}
        {tab === "Offers" && <Lz><AdminOffers {...d} /></Lz>}
        {tab === "Support" && <Crud title="Customer complaints and help requests" noAdd rows={tickets} blank={{}} {...upsert(setTickets)}
          fields={[{ k: "date", label: "Date", noForm: true }, { k: "name", label: "Customer", noForm: true }, { k: "phone", label: "Phone", noForm: true }, { k: "type", label: "Topic", noForm: true }, { k: "orderId", label: "Order", noForm: true }, { k: "message", label: "Message", noForm: true }, { k: "status", label: "Status", opts: ["Open", "In progress", "Resolved"] }, { k: "reply", label: "Your reply to the customer", req: false }]} />}
        {tab === "Account" && <Lz><AdminAccount {...d} /></Lz>}
      </main>
    </div>
  );
}

function Customers({ orders }) {
  const [users, setUsers] = useLS("kf_users", []);
  const patch = (id, p) => setUsers((us) => us.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const reset = async (u) => {
    const pw = prompt(`Set a new temporary password for ${u.name} (at least 6 characters):`);
    if (!pw) return; if (pw.length < 6) return alert("Use at least 6 characters.");
    const sl = salt(); patch(u.id, { salt: sl, hash: await hash(pw, sl) }); alert("Password updated. Tell the customer their new password.");
  };
  return (
    <section className="card"><div className="bar"><h3>Customers with accounts</h3></div>
      <div className="scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Status</th><th /></tr></thead>
        <tbody>{users.map((u) => { const m = orders.filter((o) => o.userId === u.id && o.status !== "Cancelled"); return (
          <tr key={u.id}><td>{u.name}</td><td>{u.phone}</td><td>{u.email}</td><td>{u.joined}</td><td>{m.length}</td><td>{inr(m.reduce((a, o) => a + +o.total, 0))}</td>
            <td className={"tag " + (u.blocked ? "cancelled" : "delivered")}>{u.blocked ? "Blocked" : "Active"}</td>
            <td className="act"><button onClick={() => patch(u.id, { blocked: !u.blocked })}>{u.blocked ? "Unblock" : "Block"}</button><button onClick={() => reset(u)}>Reset password</button><button onClick={() => confirm(`Delete ${u.name}'s account? Their past orders are kept.`) && setUsers((us) => us.filter((x) => x.id !== u.id))}>Delete</button></td></tr>); })}</tbody></table>
        {!users.length && <p className="muted">No customer accounts yet. They appear here after someone signs up on the shop.</p>}</div>
    </section>
  );
}
