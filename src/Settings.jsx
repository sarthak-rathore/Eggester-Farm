import React, { useState, lazy, Suspense } from "react";
import { FARM } from "./config.js";
import { useFarmData, upsert } from "./farm.js";
import { useLS, uid, today, inr } from "./store.js";
import { hash, salt } from "./auth.js";
import { nf } from "./charts.jsx";
import { Tile, Msg, Num } from "./ui.jsx";
import Crud from "./Crud.jsx";
const AdminAccount = lazy(() => import("./AdminAccount.jsx"));
const AdminOffers = lazy(() => import("./AdminOffers.jsx"));
const Lz = ({ children }) => <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>;
export const ROLES = ["Manager", "Worker", "Viewer"];
const ROLE_HELP = { Manager: "Can use everything except Settings", Worker: "Can only enter Today's Update and see Tasks", Viewer: "Can only look at the Overview and Reports" };
const TILES = [
  ["farms", "🏡", "Farms & Batches", "फार्म और बैच", "Add, change or remove farms and batches"], ["owner", "👤", "Owner & Address", "मालिक का पता", "Your name, phone, farm address"],
  ["staff", "👷", "Staff", "काम करने वाले", "Workers and their salary"], ["suppliers", "🚚", "Suppliers", "सप्लायर", "Where you buy from"],
  ["customers", "🛒", "Customers", "ग्राहक", "Who buys your eggs"], ["fields", "📝", "My Own Fields", "अपने खाने", "Extra things to note every day"],
  ["notify", "🔔", "Alerts", "सूचना", "When should the app warn you"], ["roles", "🔑", "Who Can Log In", "लॉगिन अधिकार", "Manager, worker and viewer logins"],
  ["backup", "💾", "Backup & Restore", "बैकअप", "Keep your records safe"], ["account", "⚙️", "Account", "खाता", "Change your password"],
  ["shop", "🏷️", "Shop Prices", "दुकान के भाव", "Egg prices, offers, delivery"], ["help", "📨", "Customer Messages", "ग्राहक संदेश", "Complaints and questions"],
];
export default function Settings({ d, sub, go }) {
  const F = useFarmData(); const fn = Object.fromEntries(F.farms.map((f) => [f.id, f.name]));
  const farmOpts = [{ v: "", l: "All farms" }, ...F.farms.map((f) => ({ v: f.id, l: f.name }))];
  const [tickets, setTickets] = useLS("kf_tickets", []);
  if (!sub) return (
    <>
      <div className="bar"><h2>Settings <small className="hi">सेटिंग</small></h2></div>
      <div className="tiles">{TILES.map(([k, i, t, hi, s]) => <Tile key={k} icon={i} title={t} hi={hi} sub={s} onClick={() => go("settings/" + k)} badge={k === "help" ? tickets.filter((x) => x.status === "Open").length : 0} />)}</div>
    </>
  );
  const T = TILES.find((x) => x[0] === sub);
  const body = {
    farms: <>
      <Crud title="Your farms" rows={F.farms} blank={{ name: "", location: "", address: "" }} {...upsert(F.setFarms)} fields={[{ k: "name", label: "Farm name" }, { k: "location", label: "Village or town", req: false }, { k: "address", label: "Full address", req: false }]} />
      <Crud title="Batches (each lot of chicks)" rows={F.batches} blank={{ farmId: F.farms[0]?.id || "", date: today(), count: "", chickCost: "", ageDays: 1, status: "Active", breed: "", supplier: "", note: "" }} {...upsert(F.setBatches)}
        fields={[{ k: "name", label: "Batch name (e.g. Batch C)" }, { k: "farmId", label: "Farm", opts: F.farms.length ? F.farms.map((f) => ({ v: f.id, l: f.name })) : [{ v: "", l: "Add a farm first" }], fmt: (v) => fn[v] || "–" }, { k: "date", label: "Date chicks came", type: "date" }, { k: "count", label: "How many chicks", type: "number", fmt: nf }, { k: "chickCost", label: "Cost per chick (₹)", type: "number", fmt: inr },
          { k: "ageDays", label: "Age of chicks in days", type: "number", req: false }, { k: "breed", label: "Breed", req: false }, { k: "supplier", label: "Bought from", req: false }, { k: "status", label: "Status", opts: [{ v: "Active", l: "Running" }, { v: "Closed", l: "Finished (hide from Today's Update)" }] }, { k: "note", label: "Note", req: false }]} /></>,
    owner: <Lz><AdminAccount {...d} show={["profile", "farm"]} /></Lz>,
    staff: <Crud title="Staff" rows={F.staff} blank={{ name: "", role: "", phone: "", salary: "", farmId: "", active: "Yes" }} {...upsert(F.setStaff)}
      fields={[{ k: "name", label: "Name" }, { k: "role", label: "Work (e.g. Supervisor, Egg collector)", req: false }, { k: "phone", label: "Phone", req: false }, { k: "salary", label: "Monthly salary (₹)", type: "number", req: false, fmt: inr }, { k: "farmId", label: "Works at", opts: farmOpts, fmt: (v) => fn[v] || "All farms" }, { k: "active", label: "Still working?", opts: ["Yes", "No"] }]} />,
    suppliers: <Crud title="Suppliers" rows={F.sup} blank={{ name: "", phone: "", address: "", supplies: "" }} {...upsert(F.setSup)} fields={[{ k: "name", label: "Name" }, { k: "phone", label: "Phone", req: false }, { k: "supplies", label: "What they supply", req: false }, { k: "address", label: "Address", req: false }]} />,
    customers: <><Crud title="Customers" rows={F.cust} blank={{ name: "", phone: "", address: "", type: "Regular" }} {...upsert(F.setCust)} fields={[{ k: "name", label: "Name (shop, hotel, person)" }, { k: "phone", label: "Phone", req: false }, { k: "address", label: "Address", req: false }, { k: "type", label: "Kind", opts: ["Regular", "Shop", "Hotel", "Bakery", "Caterer", "Other"] }]} />
      <OnlineAccounts orders={d.orders} /></>,
    fields: <><p className="muted">Add your own boxes to Today's Update. For example “Water used (litres)” or “Egg colour”. Saved with each day's record and shown in Production.</p>
      <Crud title="My own fields" rows={F.cf} blank={{ label: "", type: "number" }} {...upsert(F.setCf)} fields={[{ k: "label", label: "Name of the field" }, { k: "type", label: "Type", opts: [{ v: "number", l: "A number" }, { v: "text", l: "Words" }] }]} /></>,
    notify: <Notify F={F} />,
    roles: <Team />,
    backup: <Lz><AdminAccount {...d} show={["backup"]} /></Lz>,
    account: <Lz><AdminAccount {...d} show={["security"]} /></Lz>,
    shop: <><Crud title="Egg products and bulk prices" rows={d.products} blank={{ emoji: "🥚", unit: "tray", eggs: 30, price: "", mrp: "", moq: 10, tiers: "", gst: "", desc: "", active: "Yes" }} {...upsert(d.setProducts)}
      fields={[{ k: "emoji", label: "Icon" }, { k: "name", label: "Name" }, { k: "price", label: "Price per tray (₹)", type: "number", fmt: inr }, { k: "mrp", label: "Old price (₹)", type: "number", req: false, fmt: (v) => (v ? inr(v) : "") }, { k: "moq", label: "Smallest online order (trays)", type: "number" }, { k: "tiers", label: "Bulk prices (trays:price, e.g. 50:205,100:200)", req: false }, { k: "gst", label: "GST % (blank = shop default)", type: "number", req: false }, { k: "desc", label: "Description", req: false }, { k: "unit", label: "Unit", req: false }, { k: "eggs", label: "Eggs in one tray", type: "number" }, { k: "active", label: "Show in online shop", opts: ["Yes", "No"] }]} />
      <Lz><AdminOffers {...d} /></Lz></>,
    help: <Crud title="Customer complaints and help requests" noAdd rows={tickets} blank={{}} {...upsert(setTickets)} fields={[{ k: "date", label: "Date", noForm: true }, { k: "name", label: "Customer", noForm: true }, { k: "phone", label: "Phone", noForm: true }, { k: "type", label: "Topic", noForm: true }, { k: "orderId", label: "Order", noForm: true }, { k: "message", label: "Message", noForm: true }, { k: "status", label: "Status", opts: ["Open", "In progress", "Resolved"] }, { k: "reply", label: "Your reply", req: false }]} />,
  }[sub];
  return <><div className="bar"><h2>{T?.[1]} {T?.[2]}</h2><button className="btn sm ghost" onClick={() => go("settings")}>← All settings</button></div>{body}</>;
}

function Notify({ F }) {
  const [v, setV] = useState({ feedDays: 7, trayLow: 20, boxLow: 20, emptyTrayLow: 100, mortality: true, remind: true, ...F.notif }); const [m, setM] = useState("");
  return (
    <form className="card form grid2" onSubmit={(e) => { e.preventDefault(); F.setNotif({ ...v, feedDays: +v.feedDays || 7, trayLow: +v.trayLow || 0, boxLow: +v.boxLow || 0, emptyTrayLow: +v.emptyTrayLow || 0 }); setM("s|Saved."); }}>
      <h3 className="wide">Warn me on the home screen when…</h3>
      <Num label="Feed will last fewer than (days)" v={v.feedDays} set={(x) => setV({ ...v, feedDays: x })} /><Num label="Eggs in stock fewer than (trays)" v={v.trayLow} set={(x) => setV({ ...v, trayLow: x })} />
      <Num label="Empty boxes fewer than" v={v.boxLow} set={(x) => setV({ ...v, boxLow: x })} /><Num label="Empty trays fewer than" v={v.emptyTrayLow} set={(x) => setV({ ...v, emptyTrayLow: x })} />
      <label className="radio wide"><input type="checkbox" checked={v.mortality} onChange={(e) => setV({ ...v, mortality: e.target.checked })} />Warn me when more birds die than usual</label>
      <label className="radio wide"><input type="checkbox" checked={v.remind} onChange={(e) => setV({ ...v, remind: e.target.checked })} />Show my reminders (tasks) in Today's Update</label>
      <div className="row wide"><button className="btn sm">Save</button></div><div className="wide"><Msg m={m} /></div></form>
  );
}

function Team() {
  const [team, setTeam] = useLS("kf_team", []); const [p, setP] = useState({ name: "", phone: "", role: "Worker", pin: "" }); const [m, setM] = useState("");
  const add = async (e) => { e.preventDefault(); if (!/^\d{10}$/.test(p.phone.replace(/\s/g, ""))) return setM("e|Enter a 10 digit phone number."); if (p.pin.length < 4) return setM("e|The PIN must have at least 4 numbers or letters."); if (team.some((x) => x.phone === p.phone.replace(/\s/g, ""))) return setM("e|This phone number already has a login.");
    const s = salt(), hs = await hash(p.pin, s); setTeam((t) => [...t, { id: uid(), name: p.name, phone: p.phone.replace(/\s/g, ""), role: p.role, salt: s, hash: hs, active: "Yes" }]); setP({ name: "", phone: "", role: "Worker", pin: "" }); setM("s|Login created. Tell them to choose “Staff login” and use their phone number and PIN."); };
  const reset = async (u) => { const pin = prompt(`New PIN for ${u.name} (at least 4 characters):`); if (!pin || pin.length < 4) return; const s = salt(); const h = await hash(pin, s); setTeam((t) => t.map((x) => (x.id === u.id ? { ...x, salt: s, hash: h } : x))); alert("PIN changed."); };
  return (
    <>
      <p className="muted">Give your manager or workers their own login so they only see what they need. {Object.entries(ROLE_HELP).map(([k, v]) => `${k}: ${v}.`).join(" ")}</p>
      <form className="card form grid2" onSubmit={add}><h3 className="wide">Add a login</h3>
        <label>Name<input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label><label>Phone number<input required type="tel" inputMode="numeric" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
        <label>What can they do<select value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}: {ROLE_HELP[r]}</option>)}</select></label><label>PIN (4 or more numbers)<input required type="text" value={p.pin} onChange={(e) => setP({ ...p, pin: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Create login</button></div><div className="wide"><Msg m={m} /></div></form>
      <section className="card"><h3>People who can log in</h3>
        {!team.length && <p className="muted">Only you (the owner) can log in right now.</p>}
        {team.map((u) => <div className="line" key={u.id}><span><b>{u.name}</b> · {u.phone}<br /><small className="muted">{u.role}{u.active === "No" ? " · switched off" : ""}</small></span>
          <span className="act"><button onClick={() => setTeam((t) => t.map((x) => (x.id === u.id ? { ...x, active: x.active === "No" ? "Yes" : "No" } : x)))}>{u.active === "No" ? "Switch on" : "Switch off"}</button><button onClick={() => reset(u)}>New PIN</button><button onClick={() => confirm(`Delete ${u.name}'s login?`) && setTeam((t) => t.filter((x) => x.id !== u.id))}>Delete</button></span></div>)}
        <p className="muted">These logins work on this device's saved data. Real separate accounts on every phone come with the online database (phase 3).</p></section>
    </>
  );
}

function OnlineAccounts({ orders }) {
  const [users, setUsers] = useLS("kf_users", []);
  const patch = (id, p) => setUsers((us) => us.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const reset = async (u) => { const pw = prompt(`Set a new temporary password for ${u.name} (at least 6 characters):`); if (!pw) return; if (pw.length < 6) return alert("Use at least 6 characters."); const sl = salt(); patch(u.id, { salt: sl, hash: await hash(pw, sl) }); alert("Password updated. Tell the customer their new password."); };
  return (
    <section className="card"><div className="bar"><h3>Customers who signed up on the online shop</h3></div>
      <div className="scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Status</th><th /></tr></thead>
        <tbody>{users.map((u) => { const m = orders.filter((o) => o.userId === u.id && o.status !== "Cancelled"); return (
          <tr key={u.id}><td>{u.name}<br /><small className="muted">{u.email}</small></td><td>{u.phone}</td><td>{m.length}</td><td>{inr(m.reduce((a, o) => a + +o.total, 0))}</td><td className={"tag " + (u.blocked ? "cancelled" : "delivered")}>{u.blocked ? "Blocked" : "Active"}</td>
            <td className="act"><button onClick={() => patch(u.id, { blocked: !u.blocked })}>{u.blocked ? "Unblock" : "Block"}</button><button onClick={() => reset(u)}>New password</button><button onClick={() => confirm(`Delete ${u.name}'s account? Their past orders are kept.`) && setUsers((us) => us.filter((x) => x.id !== u.id))}>Delete</button></td></tr>); })}</tbody></table>
        {!users.length && <p className="muted">Nobody has signed up on the online shop yet.</p>}</div></section>
  );
}
