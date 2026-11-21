import React from "react";
import { WUNITS, unitLabel, unitHint } from "./units.js";
import { Ia } from "./adminIcons.jsx";
import { Title } from "./i18n.jsx";

export const Msg = ({ m }) => (m ? <p className={m[0] === "e" ? "out" : "okmsg"} role="status">{m.slice(2)}</p> : null);

/* number box with a big label */
export const Num = ({ label, v, set, hint, ...p }) => (
  <label>{label}<input type="number" inputMode="decimal" min="0" step="any" value={v} onChange={(e) => set(e.target.value)} {...p} />{hint && <small className="muted">{hint}</small>}</label>
);

/* quantity + unit (Kg, Quintal, Ton, Gram, Maund, Bags... pick the unit you bought in; the box underneath shows the converted amount) */
export const Qty = ({ label, v, set, units = WUNITS, hint }) => (
  <label>{label}
    <span className="qtyrow">
      <input type="number" inputMode="decimal" min="0" step="any" value={v.q} onChange={(e) => set({ ...v, q: e.target.value })} />
      <select aria-label="Unit" value={v.u} onChange={(e) => set({ ...v, u: e.target.value })}>{units.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}</select>
    </span>{(hint || unitHint(v.q, v.u)) && <small className="muted">{hint || unitHint(v.q, v.u)}</small>}
  </label>
);

/* a collapsible step on a form */
export const Sect = ({ n, title, hint, open, children }) => (
  <details className="card sect" open={open}>
    <summary><span className="num">{n}</span><span><b>{title}</b>{hint && <small className="muted">{hint}</small>}</span></summary>
    <div className="form grid2">{children}</div>
  </details>
);

export const Tile = ({ icon, title, hi, sub, onClick, badge, tone }) => (
  <button type="button" className={"tile " + (tone || "")} onClick={onClick}>
    <span className="ico" aria-hidden="true">{icon}</span>
    {hi ? <span data-no-i18n="" className="ttl"><Title en={title} hi={hi} /></span> : <b>{title}</b>}{sub && <small>{sub}</small>}{badge ? <i>{badge}</i> : null}
  </button>
);

export const Empty = ({ text, icon }) => <p className="empty-note">{icon && <Ia n={icon} s={28} />}<span>{text}</span></p>;

/* shown while a screen is loading: soft pulsing blocks instead of a blank page */
export const Loading = () => <div className="skel" aria-busy="true" aria-label="Loading"><i /><i /><i /><i /></div>;
