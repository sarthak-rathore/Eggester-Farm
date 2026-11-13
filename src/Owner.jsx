import React, { useState, useEffect, lazy, Suspense } from "react";
import { FARM } from "./config.js";
import { useLS, today, inr } from "./store.js";
import { useFarmData, useAnalysis } from "./farm.js";
import { hash } from "./auth.js";
import { Alerts, nf } from "./charts.jsx";
import { Tile } from "./ui.jsx";

const named = (n) => lazy(() => import("./FarmSections.jsx").then((m) => ({ default: m[n] })));
const S = { overview: named("FarmOverview"), production: named("Production"), sales: named("Sales"), expenses: named("Expenses"), stock: named("Stock"), feed: named("FeedMgmt"), mortality: named("Mortality"), health: named("Health"), purchases: named("Purchases"), staff: named("StaffLabor"), tasks: named("Tasks"), documents: named("Documents") };
const Today = lazy(() => import("./TodayUpdate.jsx")), Overall = lazy(() => import("./Overview.jsx")), Reports = lazy(() => import("./Reports.jsx")), Settings = lazy(() => import("./Settings.jsx"));
const Lz = ({ children }) => <Suspense fallback={<p className="muted" style={{ padding: 20 }}>Loading…</p>}>{children}</Suspense>;

const PRIMARY = [["farms", "🏡", "My Farms", "मेरे फार्म"], ["overview", "📊", "Overall Farm Overview", "पूरे फार्म का हाल"], ["reports", "📈", "Reports & Analytics", "रिपोर्ट"], ["settings", "⚙️", "Settings", "सेटिंग"]];
const SECONDARY = [["overview", "🏠", "Overview"], ["today", "✏️", "Today's Update"], ["production", "🥚", "Production"], ["sales", "💰", "Sales"], ["expenses", "🧾", "Expenses"], ["stock", "📦", "Stock Management"], ["feed", "🌾", "Feed Management"], ["mortality", "🐔", "Mortality"], ["health", "💉", "Health & Medicine"], ["purchases", "🛍️", "Purchases"], ["staff", "👷", "Staff & Labor"], ["tasks", "⏰", "Tasks & Reminders"], ["documents", "🗂️", "Documents & Records"], ["reports", "📈", "Reports & Analytics"]];
const ALLOW = { Owner: { p: ["farms", "overview", "reports", "settings"], s: SECONDARY.map((x) => x[0]) }, Manager: { p: ["farms", "overview", "reports"], s: SECONDARY.map((x) => x[0]) }, Worker: { p: ["farms"], s: ["today", "tasks"] }, Viewer: { p: ["overview", "reports"], s: [] } };

export const go = (p) => (location.hash = "#/admin" + (p ? "/" + p : ""));
const useHash = () => { const [h, setH] = useState(location.hash); useEffect(() => { const f = () => { setH(location.hash); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); return h; };

export default function Owner(d) {
  const h = useHash(); const [pin] = useLS("kf_pin", FARM.pin); const [team] = useLS("kf_team", []);
  const [role, setRole] = useState(sessionStorage.getItem("kf_ok") === "1" ? sessionStorage.getItem("kf_role") || "Owner" : "");
  const [who, setWho] = useState(sessionStorage.getItem("kf_who") || "");
  const [mode, setMode] = useState("owner"); const [f, setF] = useState({ id: "", pw: "" }); const [err, setErr] = useState("");
  const login = async (e) => {
    e.preventDefault(); setErr("");
    const done = (r, w) => { sessionStorage.setItem("kf_ok", "1"); sessionStorage.setItem("kf_role", r); sessionStorage.setItem("kf_who", w); setRole(r); setWho(w); setF({ id: "", pw: "" }); };
    if (mode === "owner") { if (f.id.trim().toLowerCase() === FARM.adminEmail.toLowerCase() && f.pw === pin) return done("Owner", "Owner"); return setErr("Email or password is not correct. Please try again."); }
    const u = team.find((x) => x.phone === f.id.replace(/\s/g, "") && x.active !== "No");
    if (!u || u.hash !== (await hash(f.pw, u.salt))) return setErr("Phone number or PIN is not correct. Please try again.");
    done(u.role, u.name);
  };
  const logout = () => { ["kf_ok", "kf_role", "kf_who"].forEach((k) => sessionStorage.removeItem(k)); setRole(""); };
  if (!role) return (
    <div className="login"><form className="card form" onSubmit={login}>
      <div className="lg-ico">🥚</div><h2>{FARM.name}</h2><p className="muted">Please log in to open your farm.</p>
      <div className="seg"><button type="button" className={mode === "owner" ? "on" : ""} onClick={() => { setMode("owner"); setErr(""); }}>Owner</button><button type="button" className={mode === "staff" ? "on" : ""} onClick={() => { setMode("staff"); setErr(""); }}>Manager or worker</button></div>
      {mode === "owner" ? <label>Email<input type="email" autoFocus autoComplete="email" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>
        : <label>Phone number<input type="tel" inputMode="numeric" autoFocus value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>}
      <label>{mode === "owner" ? "Password" : "PIN"}<input type="password" autoComplete="current-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></label>
      {err && <p className="out" role="alert">{err}</p>}
      {FARM.demo && mode === "owner" && <p className="hint">Demo owner: <b>{FARM.adminEmail}</b> / <b>{pin}</b> <button type="button" className="link" onClick={() => setF({ id: FARM.adminEmail, pw: pin })}>Fill in</button></p>}
      <button className="btn big">Log in</button><a href="#/">Back to the shop</a></form></div>
  );
  const A = ALLOW[role] || ALLOW.Viewer;
  const parts = h.replace(/^#\/admin\/?/, "").split("/").filter(Boolean);
  let page = parts[0] || "home"; if (page === "home" && A.p[0] !== "farms" && !A.p.includes("farms")) page = A.p[0];
  const batchId = page === "farm" ? parts[1] : "", sec = page === "farm" ? parts[2] || (A.s.includes("overview") ? "overview" : A.s[0]) : "";
  const prim = page === "farm" ? "farms" : page === "home" ? "" : page;
  const allowedPage = page === "home" || page === "farm" ? A.p.includes("farms") : A.p.includes(page);
  const pending = d.orders.filter((o) => o.status === "Pending").length;
  return (
    <div className="admin shell">
      <aside className="side" aria-label="Main menu"><a className="logo" href="#/admin">🥚 {FARM.name}</a>
        {PRIMARY.filter(([k]) => A.p.includes(k)).map(([k, i, l, hi]) => <button key={k} className={"pn " + (prim === k ? "on" : "")} onClick={() => go(k)}><span aria-hidden="true">{i}</span><b><span className="ic" aria-hidden="true">{i}</span>{l}</b><em>{hi}</em>{k === "farms" && pending ? <i>{pending}</i> : null}</button>)}
        <div className="sfoot"><small>{who}</small><a href="#/" className="btn sm ghost light">View shop</a><button className="btn sm ghost light" onClick={logout}>Log out</button></div></aside>
      <div className="main">
        <header className="mtop"><a className="logo" href="#/admin">🥚 {FARM.name}</a><button className="btn sm ghost light" onClick={logout}>Log out</button></header>
        {page === "farm" && allowedPage && <FarmBar batchId={batchId} sec={sec} allowed={A.s} />}
        <main className="wrap">
          {!allowedPage ? <p className="muted">You do not have permission to open this page.</p>
            : page === "home" ? <Home d={d} who={who} role={role} A={A} />
            : page === "farms" ? <FarmList d={d} />
            : page === "farm" ? <FarmPage d={d} batchId={batchId} sec={sec} allowed={A.s} />
            : page === "overview" ? <Lz><Overall d={d} /></Lz>
            : page === "reports" ? <><div className="bar"><h2>Reports & Analytics <small className="hi">रिपोर्ट</small></h2></div><Lz><Reports d={d} /></Lz></>
            : page === "settings" ? <Lz><Settings d={d} sub={parts[1]} go={go} /></Lz> : <Home d={d} who={who} role={role} A={A} />}
        </main>
      </div>
    </div>
  );
}

function BatchCard({ b, A, F, onOpen }) {
  const st = A.perBatch.find((x) => x.b.id === b.id) || {}, farm = F.farms.find((f) => f.id === b.farmId);
  const done = F.logs.some((l) => l.batchId === b.id && l.date === today()), eggs = F.logs.filter((l) => l.batchId === b.id && l.date === today()).reduce((a, l) => a + (+l.eggs || 0), 0);
  return (
    <button type="button" className={"farmcard " + (b.status === "Closed" ? "closed" : "")} onClick={onOpen}>
      <span className="fc-top"><b>🐔 {b.name}</b><span className={"badge " + (done ? "s-confirmed" : "s-pending")}>{done ? "✓ Today done" : "Today pending"}</span></span>
      <small className="muted">{farm?.name || "Farm"}{b.status === "Closed" ? " · Finished" : ""}</small>
      <span className="fc-nums"><span><b>{nf(st.alive)}</b> birds</span><span><b>{nf(eggs)}</b> eggs today</span><span><b>{st.weeks ?? 0}</b> weeks old</span></span>
    </button>
  );
}

function Home({ d, who, role, A: perm }) {
  const F = useFarmData(); const A = useAnalysis(d.orders, d.txns);
  const hr = new Date().getHours(), hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const active = F.batches.filter((b) => b.status !== "Closed");
  return (
    <>
      <div className="bar"><h2>{hello}, {who === "Owner" ? FARM.name : who} 🙏</h2></div>
      <Alerts list={A.alerts} />
      {perm.p.includes("farms") && <><h3 className="sh">My Farms <small className="hi">मेरे फार्म</small></h3>
        <div className="farmgrid">{active.map((b) => <BatchCard key={b.id} b={b} A={A} F={F} onOpen={() => go(`farm/${b.id}/${perm.s.includes("overview") ? "overview" : perm.s[0]}`)} />)}</div>
        {!active.length && <p className="muted">No batch yet. {role === "Owner" ? <button className="link" onClick={() => go("settings/farms")}>Add your first farm and batch</button> : "Ask the owner to add one."}</p>}</>}
      <div className="tiles">
        {perm.p.includes("overview") && <Tile icon="📊" title="Overall Farm Overview" hi="पूरे फार्म का हाल" sub="All farms together: eggs, sales, expenses, profit" onClick={() => go("overview")} />}
        {perm.p.includes("reports") && <Tile icon="📈" title="Reports & Analytics" hi="रिपोर्ट" sub="Day by day, month by month, print or download" onClick={() => go("reports")} />}
        {perm.p.includes("settings") && <Tile icon="⚙️" title="Settings" hi="सेटिंग" sub="Farms, staff, customers, backup and more" onClick={() => go("settings")} />}
      </div>
      {perm.s.includes("today") && <section className="card guide"><h3>How to use every day</h3><ol><li>Tap your <b>farm / batch</b> above.</li><li>Tap <b>Today's Update</b> and fill in what happened today.</li><li>Press <b>Save</b>. That's all. Stock, money and reports update by themselves.</li></ol></section>}
    </>
  );
}

function FarmList({ d }) {
  const F = useFarmData(); const A = useAnalysis(d.orders, d.txns); const [all, setAll] = useState(false);
  const list = F.batches.filter((b) => all || b.status !== "Closed");
  return (
    <>
      <div className="bar"><h2>My Farms <small className="hi">मेरे फार्म</small></h2><label className="radio"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Show finished batches too</label></div>
      <p className="muted">Tap a batch to open it.</p>
      <div className="farmgrid">{list.map((b) => <BatchCard key={b.id} b={b} A={A} F={F} onOpen={() => go(`farm/${b.id}/overview`)} />)}</div>
      {!list.length && <p className="muted">No batch yet. Add one in Settings → Farms & Batches.</p>}
    </>
  );
}

function FarmBar({ batchId, sec, allowed }) {
  const F = useFarmData(); const b = F.batches.find((x) => x.id === batchId); const farm = F.farms.find((f) => f.id === b?.farmId);
  if (!b) return null;
  return (
    <div className="snav">
      <div className="crumb"><button className="link" onClick={() => go("farms")}>← My Farms</button><b>{b.name}</b><span className="muted">{farm?.name}</span>
        <select aria-label="Change batch" value={batchId} onChange={(e) => go(`farm/${e.target.value}/${sec}`)}>{F.batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="tabs">{SECONDARY.filter(([k]) => allowed.includes(k)).map(([k, i, l]) => <button key={k} className={k === sec ? "on" : ""} onClick={() => go(`farm/${batchId}/${k}`)}><span aria-hidden="true">{i}</span> {l}</button>)}</div>
    </div>
  );
}

function FarmPage({ d, batchId, sec, allowed }) {
  const F = useFarmData();
  if (!F.batches.some((b) => b.id === batchId)) return <p className="muted">This batch was not found. <button className="link" onClick={() => go("farms")}>Back to My Farms</button></p>;
  if (!allowed.includes(sec)) return <p className="muted">You do not have permission to open this page.</p>;
  const title = SECONDARY.find((x) => x[0] === sec)?.[2];
  if (sec === "today") return <Lz><Today batchId={batchId} {...d} /></Lz>;
  if (sec === "reports") return <><div className="bar"><h2>Reports & Analytics</h2></div><Lz><Reports batchId={batchId} d={d} /></Lz></>;
  const C = S[sec];
  return <>{sec !== "overview" && <div className="bar"><h2>{title}</h2></div>}<Lz><C batchId={batchId} d={d} /></Lz></>;
}
