import React, { useState, useEffect, useRef, useCallback } from "react";
import { FARM } from "./config.js";
import { inr } from "./store.js";

const reduce = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const goTo = (id) => (e) => { e?.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" }); };

/* small line icons */
const I = { // each is drawn on a 24x24 grid
  egg: <path d="M12 2.5c3.6 0 6.5 5.6 6.5 10a6.5 6.5 0 0 1-13 0c0-4.4 2.9-10 6.5-10Z" />,
  truck: <><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" /><circle cx="7" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-5 6-8 10-10" /></>,
  tag: <><path d="M3.5 12.5V4.5h8l9 9-8 8z" /><circle cx="8" cy="9" r="1.2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  hand: <path d="M8 12V6a1.5 1.5 0 0 1 3 0v4m0-1V4.5a1.5 1.5 0 0 1 3 0V10m0-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 14.5a1.5 1.5 0 0 1 2.4-1.8L8 14.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />, close: <path d="M5 5l14 14M19 5 5 19" />,
  left: <path d="M15 5 8 12l7 7" />, right: <path d="m9 5 7 7-7 7" />,
};
export const Icon = ({ n, s = 24 }) => <svg className="ico" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

/* number that counts up once when it scrolls into view */
export function CountUp({ to, suffix = "", prefix = "" }) {
  const ref = useRef(null); const [v, setV] = useState(reduce() ? to : 0);
  useEffect(() => {
    if (reduce() || !("IntersectionObserver" in window)) return setV(to);
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); const t0 = performance.now(); const tick = (t) => { const k = Math.min(1, (t - t0) / 1100); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, { threshold: 0.4 });
    ref.current && io.observe(ref.current); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{v.toLocaleString("en-IN")}{suffix}</span>;
}

const SECTIONS = [["products", "Shop"], ["why", "Why us"], ["how", "How it works"], ["about", "Our farm"], ["gallery", "Photos"], ["faq", "Help"], ["contact", "Visit"]];

/* header: clear over the photo, solid after scrolling; progress bar; highlights the section you are reading; phone menu */
export function SiteHeader({ user, count, onLogin, onCart }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(""), [bump, setBump] = useState(false), bar = useRef(null), hdr = useRef(null), top = useRef(null), first = useRef(true);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`; hdr.current?.classList.toggle("solid", y > 30); top.current?.classList.toggle("show", y > 700);
      document.documentElement.style.setProperty("--sy", Math.min(y, 900)); }); };
    addEventListener("scroll", on, { passive: true }); on(); return () => { removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); el && io.observe(el); }); return () => io.disconnect();
  }, []);
  useEffect(() => { if (first.current) { first.current = false; return; } setBump(true); const t = setTimeout(() => setBump(false), 450); return () => clearTimeout(t); }, [count]);
  useEffect(() => { document.body.classList.toggle("noscroll", open); return () => document.body.classList.remove("noscroll"); }, [open]);
  const nav = (id) => (e) => { setOpen(false); goTo(id)(e); };
  return (
    <>
      <div className="site-progress" ref={bar} aria-hidden="true" />
      <header className="site-head" ref={hdr}>
        <a href="#/" className="site-logo" onClick={(e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" }); }}><span className="egg-mark"><Icon n="egg" s={20} /></span>{FARM.name}</a>
        <nav className="site-nav" aria-label="Sections">{SECTIONS.map(([id, l]) => <a key={id} href={"#" + id} className={active === id ? "on" : ""} onClick={goTo(id)}>{l}</a>)}</nav>
        <div className="site-actions">
          {user ? <a className="btn sm ghost light" href="#/account">{user.name.split(" ")[0]}</a> : <button className="btn sm ghost light" onClick={onLogin}>Log in</button>}
          <button className={"btn sm basket" + (bump ? " bump" : "")} onClick={onCart}>Basket{count ? <i>{count}</i> : null}</button>
          <button className="menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}><Icon n={open ? "close" : "menu"} /></button>
        </div>
      </header>
      <div className={"drawer" + (open ? " open" : "")} aria-hidden={!open}>{SECTIONS.map(([id, l], i) => <a key={id} href={"#" + id} style={{ "--i": i }} onClick={nav(id)}>{l}</a>)}
        {user ? <a href="#/account" style={{ "--i": 8 }}>My account</a> : <a href="#/" style={{ "--i": 8 }} onClick={(e) => { e.preventDefault(); setOpen(false); onLogin(); }}>Log in</a>}</div>
      <button ref={top} className="to-top" aria-label="Back to top" onClick={() => scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" })}><Icon n="up" /></button>
      {FARM.whatsapp && <a className="wa-float" href={`https://wa.me/${FARM.whatsapp}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><Icon n="chat" s={26} /></a>}
    </>
  );
}

/* top of the page: photos fade into each other slowly, text rises in, live count of trays ready */
export function Hero({ ready, delivery, freeAbove }) {
  const slides = FARM.photos.slides, [i, setI] = useState(0);
  useEffect(() => { if (reduce() || slides.length < 2) return; const t = setInterval(() => !document.hidden && setI((x) => (x + 1) % slides.length), 6500); return () => clearInterval(t); }, [slides.length]);
  return (
    <section className="site-hero" id="top">
      <div className="slides" aria-hidden="true">{slides.map((s, k) => <div key={s} className={"slide" + (k === i ? " on" : "")}><img src={s} alt="" {...(k === 0 ? { fetchpriority: "high" } : { loading: "lazy" })} decoding="async" /></div>)}</div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-in">
        <p className="eyebrow rise" style={{ "--d": "0s" }}><span className="live" />{ready > 0 ? `${ready} trays ready today` : "Fresh eggs, collected daily"}</p>
        <h1 className="rise" style={{ "--d": ".08s" }}>{FARM.headline}</h1>
        <p className="lead rise" style={{ "--d": ".18s" }}>{FARM.tagline}. Collected by hand every morning, packed in trays of 30 and delivered in bulk.</p>
        <div className="row rise" style={{ "--d": ".28s" }}><a className="btn big" href="#products" onClick={goTo("products")}>Order eggs in bulk <Icon n="arrow" s={20} /></a><a className="btn ghost light big" href="#about" onClick={goTo("about")}>See the farm</a></div>
        <ul className="hero-facts rise" style={{ "--d": ".4s" }}><li><Icon n="sun" /> Fresh every morning</li><li><Icon n="box" /> Trays of 30, boxes of 9 trays</li><li><Icon n="truck" /> Delivery {inr(delivery)}, free above {inr(freeAbove)}</li></ul>
      </div>
      <a className="scroll-cue" href="#products" onClick={goTo("products")} aria-label="Scroll to the shop"><span /></a>
      <div className="dots" aria-hidden="true">{slides.map((s, k) => <i key={s} className={k === i ? "on" : ""} />)}</div>
    </section>
  );
}

export const Marquee = () => {
  const t = ["Farm fresh", "Hand collected", "Packed in trays of 30", "Bulk prices", "Delivered to your door", "GST invoice on every order"];
  return <div className="marquee" aria-hidden="true"><div className="track">{[...t, ...t, ...t, ...t].map((x, k) => <span key={k}><Icon n="egg" s={16} />{x}</span>)}</div></div>;
};

export const Heading = ({ eyebrow, title, text }) => <div className="sec-head rv"><p className="eyebrow dark">{eyebrow}</p><h2>{title}</h2>{text && <p className="muted">{text}</p>}</div>;

export function Why({ moq, tray }) {
  const f = [["leaf", "Fresh from the shed", "Eggs are collected by hand every morning, so what reaches you is only days old, never weeks."], ["tag", "Pay less as you buy more", "Every product shows its bulk prices. The more trays you order, the lower the price per tray."],
    ["box", "Packed with care", `Trays of ${tray} eggs, boxes of 9 trays. Clean, counted and ready for your shop, hotel or bakery.`], ["truck", "Reliable delivery", "Confirm your order and we deliver. Large orders can be scheduled ahead for your busy days."]];
  return (
    <section id="why" className="band alt"><Heading eyebrow="Why choose us" title="Simple, honest, fresh" text={moq ? `Orders start from just ${moq} trays.` : ""} />
      <div className="feat">{f.map(([ic, t, d], k) => <article key={t} className="rv" style={{ "--i": k }}><span className="feat-ico"><Icon n={ic} s={28} /></span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
  );
}

export function How() {
  const s = [["egg", "Hens lay", "Healthy hens, fed well and looked after every day."], ["hand", "Collected by hand", "Every morning, gently and carefully."], ["box", "Packed in trays", "30 eggs a tray, 9 trays a box."], ["truck", "At your door", "Delivered fresh to your shop or kitchen."]];
  return (
    <section id="how" className="band"><Heading eyebrow="From our shed to your shop" title="How your eggs reach you" />
      <ol className="steps">{s.map(([ic, t, d], k) => <li key={t} className="rv" style={{ "--i": k }}><span className="step-ico"><Icon n={ic} s={26} /><b>{k + 1}</b></span><h3>{t}</h3><p>{d}</p></li>)}</ol></section>
  );
}

export function Story({ ready, moq, delivery }) {
  const p = FARM.photos;
  return (
    <section id="about" className="band story">
      <div className="story-photos rv"><img className="a" src={p.gallery[0].src} alt="Our laying shed" loading="lazy" decoding="async" /><img className="b" src={p.eggs} alt="A tray of 30 fresh eggs" loading="lazy" decoding="async" /><img className="c" src={p.hens} alt="Hens at feeding time" loading="lazy" decoding="async" /></div>
      <div className="story-txt rv"><p className="eyebrow dark">Our farm</p><h2>A farm that does one thing well</h2><p>{FARM.about}</p>
        <div className="stats">
          <div><b><CountUp to={ready} /></b><span>trays ready now</span></div>
          {moq > 0 && <div><b><CountUp to={moq} /></b><span>trays minimum order</span></div>}
          <div><b><CountUp to={30} /></b><span>eggs in every tray</span></div>
          <div><b><CountUp to={delivery} prefix="₹" /></b><span>delivery charge</span></div>
        </div></div>
    </section>
  );
}

/* masonry gallery with a full-screen viewer: arrows, swipe, Esc */
export function Gallery() {
  const g = FARM.photos.gallery, [k, setK] = useState(-1), x0 = useRef(0);
  const step = useCallback((d) => setK((v) => (v < 0 ? v : (v + d + g.length) % g.length)), [g.length]);
  useEffect(() => { if (k < 0) return; const on = (e) => { if (e.key === "Escape") setK(-1); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }; addEventListener("keydown", on); document.body.classList.add("noscroll"); return () => { removeEventListener("keydown", on); document.body.classList.remove("noscroll"); }; }, [k < 0, step]);
  return (
    <section id="gallery" className="band alt"><Heading eyebrow="Photo gallery" title="From our farm" text={`Real photos from the ${FARM.name} shed and packing area. Tap a photo to see it bigger.`} />
      <div className="mason">{g.map((p, i) => <button key={p.src} type="button" className={"mp " + p.shape + " rv"} style={{ "--i": i % 4 }} onClick={() => setK(i)} aria-label={"Open photo: " + p.title}><img src={p.src} alt={p.title} loading="lazy" decoding="async" /><span>{p.title}</span></button>)}</div>
      {k >= 0 && <div className="lb" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setK(-1)} onTouchStart={(e) => (x0.current = e.touches[0].clientX)} onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - x0.current; if (Math.abs(d) > 50) step(d < 0 ? 1 : -1); }}>
        <button className="lb-x" aria-label="Close" onClick={() => setK(-1)}><Icon n="close" /></button>
        <button className="lb-n l" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1); }}><Icon n="left" /></button>
        <figure onClick={(e) => e.stopPropagation()}><img key={g[k].src} src={g[k].src} alt={g[k].title} /><figcaption>{g[k].title} <small>{k + 1} / {g.length}</small></figcaption></figure>
        <button className="lb-n r" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1); }}><Icon n="right" /></button></div>}
    </section>
  );
}
