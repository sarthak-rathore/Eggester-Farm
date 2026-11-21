import React, { useEffect } from "react";
import { useLS, peek } from "./store.js";
import { DICT, PATTERNS } from "./hi.js";

/* Hindi + English for the owner dashboard.
   "both"  = हिंदी + English: every technical English term gets its everyday Hindi next to it, e.g. "Mortality (मृत्यु दर)".
   "hi"    = सिर्फ हिंदी: Hindi only.
   Fixed words and sentences are looked up in hi.js (DICT and PATTERNS) and swapped on screen by a small translator that watches the page.
   Anything it does not know stays in English, so a missing word never breaks a screen. Text built from numbers (alerts, advice,
   packing summaries) carries its own Hindi and is shown with <Bi> or pick(). */
export const LANG_KEY = "kf_lang";
export const b = (en, hi) => ({ en, hi });
export const getLang = () => (peek(LANG_KEY, "both") === "hi" ? "hi" : "both");
const wrap = (en, hi, lang) => (lang === "hi" ? hi : `${en} (${hi})`);
export function pick(en, hi) {
  if (en && typeof en === "object") ({ en, hi } = en);
  return hi ? wrap(en, hi, getLang()) : en;
}
export function useLang() { const [l, set] = useLS(LANG_KEY, "both"); return [l === "hi" ? "hi" : "both", set]; }
export function Bi({ en, hi }) { useLang(); return <>{pick(en, hi)}</>; }
/* a title that shows Hindi only, or English with the Hindi underneath (used for the menu tiles) */
export function Title({ en, hi }) { const [l] = useLang(); return l === "hi" ? <b>{hi}</b> : <><b>{en}</b><em>{hi}</em></>; }

export function LangToggle({ className = "" }) {
  const [l, set] = useLang();
  return (
    <div className={"langtoggle " + className} role="group" aria-label="Language / भाषा" data-no-i18n="">
      <button type="button" className={l === "both" ? "on" : ""} aria-pressed={l === "both"} onClick={() => set("both")}>हिंदी + English</button>
      <button type="button" className={l === "hi" ? "on" : ""} aria-pressed={l === "hi"} onClick={() => set("hi")}>सिर्फ हिंदी</button>
    </div>
  );
}

/* ---------- lookup ---------- */
const norm = (t) => t.replace(/\s+/g, " ").trim();
const DEV = /[\u0900-\u097F]/;
export function hiOf(text) {
  const k = norm(String(text));
  if (!k || DEV.test(k)) return null;
  if (DICT[k]) return DICT[k];
  const m = k.match(/^(.*?)([:.!?]+)$/); // "Eggs:" and "Eggs." find the word "Eggs"
  if (m && DICT[m[1]]) return DICT[m[1]] + m[2];
  for (const [re, fn] of PATTERNS) { const r = k.match(re); if (r) return fn(...r.slice(1)); }
  return null;
}
export function tr(text) { const h = hiOf(text); return h ? wrap(text, h, getLang()) : text; }

/* ---------- the translator: walks the page and swaps text nodes and a few attributes, remembering the English original ---------- */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const ATTRS = ["placeholder", "aria-label", "title"];
const seen = new WeakMap(); // text node or element -> { en, out } (for elements: { attr: { en, out } })
const skipped = (el) => !el || SKIP.has(el.tagName) || !!el.closest?.("[data-no-i18n]");
function doText(n, lang) {
  if (skipped(n.parentElement)) return;
  const cur = n.nodeValue, rec = seen.get(n), en = rec && cur === rec.out ? rec.en : cur; // changed by React since our last edit = a new original
  let out = en;
  const hi = en.trim() ? hiOf(en) : null;
  if (hi) { const lead = en.match(/^\s*/)[0], trail = en.match(/\s*$/)[0]; out = lead + wrap(norm(en), hi, lang) + trail; }
  if (out !== cur) n.nodeValue = out;
  seen.set(n, { en, out });
}
function doAttrs(el, lang) {
  if (skipped(el)) return;
  const rec = seen.get(el) || {};
  ATTRS.forEach((a) => {
    const cur = el.getAttribute?.(a); if (cur == null) return;
    const r = rec[a], en = r && cur === r.out ? r.en : cur, hi = hiOf(en), out = hi ? wrap(norm(en), hi, lang) : en;
    if (out !== cur) el.setAttribute(a, out);
    rec[a] = { en, out };
  });
  seen.set(el, rec);
}
function walk(root, lang) {
  if (root.nodeType === 3) return doText(root, lang);
  if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
  doAttrs(root, lang);
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c, lang);
  root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach((e) => doAttrs(e, lang));
}
export function translatePage(root = document.body) { walk(root, getLang()); }
export function startTranslator() {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {};
  const mo = new MutationObserver((list) => {
    const lang = getLang();
    for (const m of list) {
      if (m.type === "characterData") doText(m.target, lang);
      else if (m.type === "attributes") doAttrs(m.target, lang);
      else m.addedNodes.forEach((n) => walk(n, lang));
    }
  });
  translatePage();
  mo.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  return () => mo.disconnect();
}
/* call once in the owner dashboard: starts the translator and re-translates when the toggle is pressed */
export function useBilingual() {
  const [lang] = useLang();
  useEffect(() => startTranslator(), []);
  useEffect(() => { translatePage(); }, [lang]);
}
