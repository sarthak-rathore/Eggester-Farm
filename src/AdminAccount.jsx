import React, { useState } from "react";
import { FARM } from "./config.js";
import { useLS } from "./store.js";
import { useAnalysis } from "./farm.js";

const ALL_SUB = [["overview", "Overview"], ["profile", "Owner profile"], ["farm", "Farm details"], ["security", "Password & security"], ["backup", "Backup & Restore"], ["setup", "Setup status"]];
const Msg = ({ m }) => (m ? <p className={m[0] === "e" ? "out" : "okmsg"} role="status">{m.slice(2)}</p> : null);

export default function AdminAccount({ orders, txns, setTxns, setOrders, show }) {
  const SUB = show ? ALL_SUB.filter(([k]) => show.includes(k)) : ALL_SUB;
  const A = useAnalysis(orders, txns);
  const [sub, setSub] = useState(show ? show[0] : "overview");
  const [tickets] = useLS("kf_tickets", []);
  const [pin, setPin] = useLS("kf_pin", FARM.pin);
  const [adm, setAdm] = useLS("kf_admin", { name: "Farm Owner", phone: "" });
  const [a, setA] = useState(adm);
  const [farm, setFarm] = useState({ name: FARM.name, phone: FARM.phone, whatsapp: FARM.whatsapp, email: FARM.email, address: FARM.address, hours: FARM.hours, upiId: FARM.upiId, tagline: FARM.tagline, headline: FARM.headline, announcement: FARM.announcement, about: FARM.about });
  const [pw, setPw] = useState({ cur: "", n: "", n2: "" });
  const [msg, setMsg] = useState("");
  const F = (o, set, k, l, p = {}) => <label>{l}<input value={o[k] ?? ""} onChange={(e) => set({ ...o, [k]: e.target.value })} {...p} /></label>;
  const attention = [["Orders waiting for confirmation", orders.filter((o) => o.status === "Pending").length, orders.some((o) => o.status === "Pending")], ["Open customer complaints", tickets.filter((t) => t.status === "Open").length, tickets.some((t) => t.status === "Open")], ["Egg trays in stock", A.tot.stockTrays, A.tot.stockTrays < 20], ["Days of feed left", A.tot.daysLeft === null ? "–" : Math.round(A.tot.daysLeft), A.tot.daysLeft !== null && A.tot.daysLeft < 7]];
  const exportData = () => {
    const o = {}; Object.keys(localStorage).filter((k) => k.startsWith("kf_") && !["kf_session", "kf_cart"].includes(k)).forEach((k) => (o[k] = localStorage.getItem(k)));
    const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: "application/json" })); l.download = `farm-backup-${new Date().toISOString().slice(0, 10)}.json`; l.click();
  };
  const importData = (e) => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { Object.entries(JSON.parse(r.result)).forEach(([k, v]) => k.startsWith("kf_") && localStorage.setItem(k, v)); alert("Backup restored. The page will reload."); location.reload(); } catch { alert("This file is not a valid backup."); } };
    r.readAsText(f);
  };
  const changePw = (e) => {
    e.preventDefault();
    if (pw.cur !== pin) return setMsg("e|Your current password is incorrect.");
    if (pw.n.length < 6) return setMsg("e|Use at least 6 characters for the new password.");
    if (pw.n !== pw.n2) return setMsg("e|The new passwords do not match.");
    setPin(pw.n); setPw({ cur: "", n: "", n2: "" }); setMsg("s|Password updated. Use it next time you log in.");
  };
  return (
    <>
      {!show && <div className="bar"><h2>Account</h2></div>}
      {SUB.length > 1 && <div className="chips">{SUB.map(([k, l]) => <button key={k} className={k === sub ? "on" : ""} onClick={() => { setSub(k); setMsg(""); }}>{l}</button>)}</div>}

      {sub === "overview" && <>
        <section className="card"><div className="who"><div className="avatar">{(adm.name || "O").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div><div><b>{adm.name}</b><span className="muted">{FARM.adminEmail} · Owner</span></div></div></section>
        <div className="kpis">{attention.map(([l, n, bad]) => <div className={"kpi " + (bad ? "bad" : "good")} key={l}><span>{l}</span><b>{n}</b></div>)}</div>
        <section className="card"><h3>Your shop</h3><p className="muted">{FARM.name}, {FARM.address}<br />{FARM.phone} · {FARM.email}</p><p className="muted">Customers see this on the shop. Change it under Farm details. Prices, tax, offers and charges are under the Offers tab.</p></section>
      </>}

      {sub === "profile" && <form className="card form grid2" onSubmit={(e) => { e.preventDefault(); setAdm(a); setMsg("s|Profile saved."); }}>
        {F(a, setA, "name", "Your name", { required: true })}{F(a, setA, "phone", "Your phone", { type: "tel" })}
        <label className="wide">Login email<input value={FARM.adminEmail} disabled /></label>
        <p className="muted wide">The login email is set with VITE_ADMIN_EMAIL in your Vercel environment variables.</p>
        <div className="row wide"><button className="btn sm">Save profile</button></div><div className="wide"><Msg m={msg} /></div></form>}

      {sub === "farm" && <form className="card form grid2" onSubmit={(e) => { e.preventDefault(); localStorage.setItem("kf_farm", JSON.stringify(farm)); location.reload(); }}>
        {F(farm, setFarm, "name", "Farm name", { required: true })}{F(farm, setFarm, "phone", "Phone", { required: true })}
        {F(farm, setFarm, "whatsapp", "WhatsApp number (with country code, no +)", { required: true })}{F(farm, setFarm, "email", "Email", { type: "email" })}
        {F(farm, setFarm, "hours", "Opening hours")}{F(farm, setFarm, "upiId", "UPI ID for customer payments")}
        <h3 className="wide">Shop content</h3>
        {F(farm, setFarm, "headline", "Main headline on the home page")}{F(farm, setFarm, "tagline", "Tagline")}
        <label className="wide">Announcement banner (leave empty to hide)<input value={farm.announcement} placeholder="e.g. Festival offer: 10% off with code WELCOME10" onChange={(e) => setFarm({ ...farm, announcement: e.target.value })} /></label>
        <label className="wide">About the farm<textarea rows="3" value={farm.about} onChange={(e) => setFarm({ ...farm, about: e.target.value })} /></label>
        <label className="wide">Address<textarea rows="2" value={farm.address} onChange={(e) => setFarm({ ...farm, address: e.target.value })} /></label>
        <div className="row wide"><button className="btn sm">Save and update shop</button></div></form>}

      {sub === "security" && <>
        <form className="card form" onSubmit={changePw}><h3>Change password</h3>
          <label>Current password<input type="password" required value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></label>
          <label>New password<input type="password" required value={pw.n} onChange={(e) => setPw({ ...pw, n: e.target.value })} /></label>
          <label>Confirm new password<input type="password" required value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} /></label>
          <Msg m={msg} /><div className="row"><button className="btn sm">Update password</button></div></form>
        <section className="card"><h3>Session</h3><p className="muted">Signed in on this device. Log out when you are done, especially on a shared computer.</p>
          <button className="btn sm ghost" onClick={() => { sessionStorage.removeItem("kf_ok"); location.hash = "#/"; location.reload(); }}>Log out</button></section>
      </>}

      {sub === "backup" && <>
        <section className="card"><h3>Backup your data</h3><p className="muted">All your farm records are stored in this phone or computer. Download a backup every week and keep the file safe (for example send it to yourself on WhatsApp or email).</p><button className="btn sm" onClick={exportData}>Download backup</button></section>
        <section className="card"><h3>Restore from backup</h3><p className="muted">Choose a backup file you downloaded earlier. This replaces the data in this browser.</p><input type="file" accept="application/json" onChange={importData} /></section>
        <section className="card danger"><h3>Clear all records</h3><p className="muted">Deletes all batches, daily records, purchases, stock changes, money records and orders. Download a backup first.</p>
          <button className="btn sm ghost" onClick={() => { if (confirm("Delete all money, production and order records? This cannot be undone.")) { ["kf_batches", "kf_logs", "kf_feed", "kf_adj", "kf_exp", "kf_boxes", "kf_boxadj", "kf_rawbuy", "kf_mix", "kf_trays", "kf_trayadj", "kf_tasks", "kf_docs"].forEach((k) => { localStorage.setItem(k, "[]"); dispatchEvent(new CustomEvent("kf-ls", { detail: k })); }); setTxns([]); setOrders([]); } }}>Clear all records</button></section>
      </>}

      {sub === "setup" && <section className="card"><h3>Setup status</h3>
        {[["Razorpay card payments", FARM.razorpayKey, "VITE_RAZORPAY_KEY_ID"], ["UPI payments", FARM.upiId, "VITE_UPI_ID"], ["Database (phase 3)", FARM.supabaseUrl, "VITE_SUPABASE_URL"], ["Custom owner password", FARM.pin !== "Admin@123" ? "set" : "", "VITE_ADMIN_PASSWORD"]].map(([l, v, k]) => <p key={k} className="muted">{v ? "✓" : "○"} {l}: {v ? "connected" : `not set, add ${k} in your environment variables`}</p>)}</section>}
    </>
  );
}
