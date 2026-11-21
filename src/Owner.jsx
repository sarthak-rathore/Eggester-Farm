import React, { useState, useEffect, lazy, Suspense } from "react";
import { FARM, DEMO, DEMO_OWNER } from "./config.js";
import { useLS, today, inr } from "./store.js";
import { useFarmData, useAnalysis } from "./farm.js";
import { check, lockedFor, failLogin, clearFails } from "./auth.js";
import { sendOtp, verifyOtp, checkSession, otpMessage, sessionExp } from "./otp.js";
import { Alerts, nf } from "./kit.jsx";
import { Tile, Loading } from "./ui.jsx";
import { Ia } from "./adminIcons.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { useBilingual, LangToggle, Title } from "./i18n.jsx";
import PriorityActions from "./Priority.jsx";

const named = (n) => lazy(() => import("./FarmSections.jsx").then((m) => ({ default: m[n] })));
const S = { overview: named("FarmOverview"), production: named("Production"), sales: named("Sales"), expenses: named("Expenses"), stock: named("Stock"), feed: named("FeedMgmt"), mortality: named("Mortality"), health: named("Health"), purchases: named("Purchases"), staff: named("StaffLabor"), tasks: named("Tasks"), documents: named("Documents") };
const Today = lazy(() => import("./TodayUpdate.jsx")), Overall = lazy(() => import("./Overview.jsx")), Reports = lazy(() => import("./Reports.jsx")), Settings = lazy(() => import("./Settings.jsx"));
const Lz = ({ children }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

const PRIMARY = [["farms", "farm", "My Farms", "मेरे फार्म"], ["overview", "overview", "Overall Farm Overview", "पूरे फार्म का हाल"], ["reports", "chart", "Reports & Analytics", "रिपोर्ट"], ["settings", "settings", "Settings", "सेटिंग"]];
const SECONDARY = [["overview", "home", "Overview"], ["today", "today", "Today's Update"], ["production", "egg", "Production"], ["sales", "money", "Sales"], ["expenses", "receipt", "Expenses"], ["stock", "stock", "Stock Management"], ["feed", "feed", "Feed Management"], ["mortality", "hen", "Mortality"], ["health", "health", "Health & Medicine"], ["purchases", "cart", "Purchases"], ["staff", "staff", "Staff & Labor"], ["tasks", "tasks", "Tasks & Reminders"], ["documents", "docs", "Documents & Records"], ["reports", "chart", "Reports & Analytics"]];
const ALLOW = { Owner: { p: ["farms", "overview", "reports", "settings"], s: SECONDARY.map((x) => x[0]) }, Manager: { p: ["farms", "overview", "reports"], s: SECONDARY.map((x) => x[0]) }, Worker: { p: ["farms"], s: ["today", "tasks"] }, Viewer: { p: ["overview", "reports"], s: [] } };

export const go = (p) => (location.hash = "#/admin" + (p ? "/" + p : ""));
const useHash = () => { const [h, setH] = useState(location.hash); useEffect(() => { const f = () => { setH(location.hash); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); return h; };

const CHANNEL = String(import.meta.env.VITE_OTP_CHANNEL || "email").toLowerCase() === "sms" ? "sms" : "email";
const SS = sessionStorage;
const startRole = () => { // an owner login only counts if it carries a valid, unexpired server session (demo mode needs none)
  if (SS.getItem("kf_ok") !== "1") return "";
  const r = SS.getItem("kf_role") || "Owner";
  if (r === "Owner" && !DEMO && sessionExp(SS.getItem("kf_tok")) < Date.now()) return "";
  return r;
};

export default function Owner(d) {
  useBilingual(); // Hindi + English / सिर्फ हिंदी for the whole dashboard
  const h = useHash(); const [pin] = useLS("kf_pin", DEMO_OWNER.password); const [team] = useLS("kf_team", []);
  const [role, setRole] = useState(startRole); const [who, setWho] = useState(SS.getItem("kf_who") || "");
  const [mode, setMode] = useState("owner"); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [f, setF] = useState(DEMO ? { id: DEMO_OWNER.email, pw: pin } : { id: "", pw: "" }); // demo mode: owner login is filled in for you
  const [otp, setOtp] = useState({ step: "id", token: "", code: "", to: "", wait: 0 });
  const done = (r, w, tok) => { SS.setItem("kf_ok", "1"); SS.setItem("kf_role", r); SS.setItem("kf_who", w); tok ? SS.setItem("kf_tok", tok) : SS.removeItem("kf_tok"); setRole(r); setWho(w); setF({ id: "", pw: "" }); setErr(""); setOtp({ step: "id", token: "", code: "", to: "", wait: 0 }); };
  const logout = () => { ["kf_ok", "kf_role", "kf_who", "kf_tok"].forEach((k) => SS.removeItem(k)); setRole(""); setF(DEMO ? { id: DEMO_OWNER.email, pw: pin } : { id: "", pw: "" }); };
  useEffect(() => { // re-check a saved owner login with the server now and then, and sign out when it has expired
    if (DEMO || role !== "Owner") return;
    let dead = false; const tok = SS.getItem("kf_tok");
    const run = async () => { if (sessionExp(tok) < Date.now()) return logout(); const r = await checkSession(tok); if (!dead && r.ok === false && r.error !== "network" && r.status !== 500) logout(); else if (!dead && r.ok && r.ok === false) logout(); };
    run(); const t = setInterval(run, 10 * 60e3); return () => { dead = true; clearInterval(t); };
  }, [role]);
  useEffect(() => { if (otp.wait <= 0) return; const t = setTimeout(() => setOtp((o) => ({ ...o, wait: o.wait - 1 })), 1000); return () => clearTimeout(t); }, [otp.wait]);

  const login = async (e) => { // demo owner, or manager / worker with phone + PIN
    e.preventDefault(); setErr("");
    const key = mode === "owner" ? "o:demo" : "s:" + f.id.replace(/\s/g, ""), wait = lockedFor(key);
    if (wait) return setErr(`Too many wrong tries. Please wait ${Math.ceil(wait / 60)} minute(s).`);
    if (mode === "owner") { if (f.id.trim().toLowerCase() === DEMO_OWNER.email && f.pw === pin) { clearFails(key); return done("Owner", "Owner"); } failLogin(key); return setErr("Email or password is not correct. Please try again."); }
    setBusy(true); const u = team.find((x) => x.phone === f.id.replace(/\s/g, "") && x.active !== "No"); const ok = u && (await check(f.pw, u.salt, u.hash)); setBusy(false);
    if (!ok) { failLogin(key); return setErr("Phone number or PIN is not correct. Please try again."); }
    clearFails(key); done(u.role, u.name);
  };
  const ask = async (e) => { e?.preventDefault(); setErr(""); if (!f.id.trim()) return; setBusy(true); const r = await sendOtp(f.id.trim()); setBusy(false); if (!r.ok) return setErr(otpMessage(r)); setOtp({ step: "code", token: r.token, code: "", to: r.to, wait: 30 }); };
  const confirm = async (e) => { e.preventDefault(); setErr(""); setBusy(true); const r = await verifyOtp(otp.token, otp.code.trim()); setBusy(false); if (!r.ok) { if (["expired", "used", "locked"].includes(r.error)) setOtp((o) => ({ ...o, step: "id", code: "" })); return setErr(otpMessage(r)); } done("Owner", "Owner", r.session); };

  if (!role) return (
    <div className="login">{DEMO || mode === "staff" ? (
      <form className="card form" onSubmit={login}>
        <img className="lg-logo" src={FARM.logo} alt="" width="120" height="100" /><h2>{FARM.name}</h2><LangToggle /><p className="muted">Please log in to open your farm.</p>
        <div className="seg"><button type="button" className={mode === "owner" ? "on" : ""} onClick={() => { setMode("owner"); setErr(""); }}>Owner</button><button type="button" className={mode === "staff" ? "on" : ""} onClick={() => { setMode("staff"); setErr(""); setF({ id: "", pw: "" }); }}>Manager or worker</button></div>
        {mode === "owner" ? <label>Email<input type="email" autoComplete="email" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>
          : <label>Phone number<input type="tel" inputMode="numeric" autoFocus value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>}
        <label>{mode === "owner" ? "Password" : "PIN"}<input type="password" autoComplete="current-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></label>
        {err && <p className="out" role="alert">{err}</p>}
        {DEMO && mode === "owner" && <p className="hint">Demo mode: your login is filled in. Just press Log in. (Turn demo mode off to use OTP login.)</p>}
        <button className="btn big" disabled={busy}>{busy ? "Please wait…" : "Log in"}</button><a href="#/">Back to the shop</a></form>
    ) : (
      <form className="card form" onSubmit={otp.step === "id" ? ask : confirm}>
        <img className="lg-logo" src={FARM.logo} alt="" width="120" height="100" /><h2>{FARM.name}</h2><LangToggle /><p className="muted">Owner login</p>
        <div className="seg"><button type="button" className="on">Owner</button><button type="button" onClick={() => { setMode("staff"); setErr(""); setF({ id: "", pw: "" }); }}>Manager or worker</button></div>
        {otp.step === "id" ? <label>{CHANNEL === "sms" ? "Your mobile number" : "Your email"}<input required autoFocus type={CHANNEL === "sms" ? "tel" : "email"} inputMode={CHANNEL === "sms" ? "numeric" : "email"} autoComplete={CHANNEL === "sms" ? "tel" : "email"} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>
          : <><p>We sent a 6-digit code to <b>{otp.to}</b>.</p><label>Enter the code<input required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" className="otpbox" value={otp.code} onChange={(e) => setOtp({ ...otp, code: e.target.value.replace(/\D/g, "") })} /></label></>}
        {err && <p className="out" role="alert">{err}</p>}
        <button className="btn big" disabled={busy || (otp.step === "code" && otp.code.length !== 6)}>{busy ? "Please wait…" : otp.step === "id" ? "Send me a code" : "Log in"}</button>
        {otp.step === "code" && <p className="muted">{otp.wait > 0 ? `You can ask for a new code in ${otp.wait} seconds.` : <button type="button" className="link" onClick={ask}>Send a new code</button>} · <button type="button" className="link" onClick={() => setOtp({ ...otp, step: "id", code: "" })}>Change {CHANNEL === "sms" ? "number" : "email"}</button></p>}
        <a href="#/">Back to the shop</a></form>
    )}</div>
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
      <aside className="side" aria-label="Main menu"><a className="logo" href="#/admin"><img className="brand-mark" src={FARM.logo} alt="" width="44" height="36" /> {FARM.name}</a>
        {PRIMARY.filter(([k]) => A.p.includes(k)).map(([k, i, l, hi]) => <button key={k} className={"pn " + (prim === k ? "on" : "")} onClick={() => go(k)}><span className="pi"><Ia n={i} s={22} /></span><span className="pt" data-no-i18n=""><Title en={l} hi={hi} /></span>{k === "farms" && pending ? <i>{pending}</i> : null}</button>)}
        <div className="sfoot"><small>{who}</small><LangToggle className="light" /><a href="#/" className="btn sm ghost light">View shop</a><button className="btn sm ghost light" onClick={logout}>Log out</button></div></aside>
      <div className="main">
        <header className="mtop"><a className="logo" href="#/admin"><img className="brand-mark" src={FARM.logo} alt="" width="44" height="36" /> {FARM.name}</a><LangToggle className="light" /><button className="btn sm ghost light" onClick={logout}>Log out</button></header>
        {page === "farm" && allowedPage && <FarmBar batchId={batchId} sec={sec} allowed={A.s} />}
        <main className="wrap"><ErrorBoundary resetKey={h}><div key={h} className="page">
          {!allowedPage ? <p className="muted">You do not have permission to open this page.</p>
            : page === "home" ? <Home d={d} who={who} role={role} A={A} />
            : page === "farms" ? <FarmList d={d} />
            : page === "farm" ? <FarmPage d={d} batchId={batchId} sec={sec} allowed={A.s} />
            : page === "overview" ? <Lz><Overall d={d} /></Lz>
            : page === "reports" ? <><div className="bar"><h2>Reports & Analytics</h2></div><Lz><Reports d={d} /></Lz></>
            : page === "settings" ? <Lz><Settings d={d} sub={parts[1]} go={go} /></Lz> : <Home d={d} who={who} role={role} A={A} />}
        </div></ErrorBoundary></main>
      </div>
    </div>
  );
}

function BatchCard({ b, A, F, onOpen }) {
  const st = A.perBatch.find((x) => x.b.id === b.id) || {}, farm = F.farms.find((f) => f.id === b.farmId);
  const done = F.logs.some((l) => l.batchId === b.id && l.date === today()), eggs = F.logs.filter((l) => l.batchId === b.id && l.date === today()).reduce((a, l) => a + (+l.eggs || 0), 0);
  return (
    <button type="button" className={"farmcard " + (b.status === "Closed" ? "closed" : "")} onClick={onOpen}>
      <span className="fc-img"><img src={FARM.photos.gallery[[4, 9, 11, 5, 6, 0][[...String(b.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6]].src} alt="" loading="lazy" decoding="async" /></span>
      <span className="fc-top"><b>{b.name}</b><span className={"badge " + (done ? "s-confirmed" : "s-pending")}>{done ? <><Ia n="check" s={13} /> Today done</> : "Today pending"}</span></span>
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
      <div className="bar"><h2>{hello}, {who === "Owner" ? FARM.name : who}</h2></div>
      <PriorityActions A={A} orders={d.orders} />
      <Alerts list={A.alerts} />
      {role === "Owner" && (!F.farms.length || !F.batches.length || !d.products.length) && <section className="card setup"><h3>Let's set up your farm</h3>
        <p className="muted">Three small steps, then you can start entering your day.</p>
        <ol>
          <li className={F.farms.length ? "done" : ""}><span>Add your farm (name and place)</span><button className="btn sm" onClick={() => go("settings/farms")}>{F.farms.length ? <><Ia n="check" s={16} /> Done</> : "Add farm"}</button></li>
          <li className={F.batches.length ? "done" : ""}><span>Add your first batch of birds</span><button className="btn sm" onClick={() => go("settings/farms")} disabled={!F.farms.length}>{F.batches.length ? <><Ia n="check" s={16} /> Done</> : "Add batch"}</button></li>
          <li className={d.products.length ? "done" : ""}><span>Set your egg price (for sales)</span><button className="btn sm" onClick={() => go("settings/shop")}>{d.products.length ? <><Ia n="check" s={16} /> Done</> : "Add price"}</button></li>
        </ol></section>}
      {perm.p.includes("farms") && <><h3 className="sh">My Farms</h3>
        <div className="farmgrid">{active.map((b) => <BatchCard key={b.id} b={b} A={A} F={F} onOpen={() => go(`farm/${b.id}/${perm.s.includes("overview") ? "overview" : perm.s[0]}`)} />)}</div>
        {!active.length && role !== "Owner" && <p className="muted">No batch yet. Ask the owner to add one.</p>}</>}
      <div className="tiles">
        {perm.p.includes("overview") && <Tile icon={<Ia n="overview" s={28} />} title="Overall Farm Overview" hi="पूरे फार्म का हाल" sub="All farms together: eggs, sales, expenses, profit" onClick={() => go("overview")} />}
        {perm.p.includes("reports") && <Tile icon={<Ia n="chart" s={28} />} title="Reports & Analytics" hi="रिपोर्ट" sub="Day by day, month by month, print or download" onClick={() => go("reports")} />}
        {perm.p.includes("settings") && <Tile icon={<Ia n="settings" s={28} />} title="Settings" hi="सेटिंग" sub="Farms, staff, customers, backup and more" onClick={() => go("settings")} />}
      </div>
      {perm.s.includes("today") && <section className="card guide"><h3>How to use every day</h3><ol><li>Tap your farm / batch above.</li><li>Tap Today's Update and fill in what happened today.</li><li>Press Save. That's all. Stock, money and reports update by themselves.</li></ol></section>}
    </>
  );
}

function FarmList({ d }) {
  const F = useFarmData(); const A = useAnalysis(d.orders, d.txns); const [all, setAll] = useState(false);
  const list = F.batches.filter((b) => all || b.status !== "Closed");
  return (
    <>
      <div className="bar"><h2>My Farms</h2><label className="radio"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Show finished batches too</label></div>
      <p className="muted">Tap a batch to open it.</p>
      <div className="farmgrid">{list.map((b) => <BatchCard key={b.id} b={b} A={A} F={F} onOpen={() => go(`farm/${b.id}/overview`)} />)}</div>
      {!list.length && <p className="muted">No batch yet. Add one in Settings > Farms & Batches.</p>}
    </>
  );
}

function FarmBar({ batchId, sec, allowed }) {
  const F = useFarmData(); const b = F.batches.find((x) => x.id === batchId); const farm = F.farms.find((f) => f.id === b?.farmId);
  if (!b) return null;
  return (
    <div className="snav">
      <div className="crumb"><button className="link back" onClick={() => go("farms")}><Ia n="back" s={16} /> My Farms</button><b>{b.name}</b><span className="muted">{farm?.name}</span>
        <select aria-label="Change batch" value={batchId} onChange={(e) => go(`farm/${e.target.value}/${sec}`)}>{F.batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="tabs">{SECONDARY.filter(([k]) => allowed.includes(k)).map(([k, i, l]) => <button key={k} className={k === sec ? "on" : ""} onClick={() => go(`farm/${batchId}/${k}`)}><Ia n={i} s={16} /> {l}</button>)}</div>
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
