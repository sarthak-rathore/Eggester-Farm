import React from "react";
import { WUNITS } from "./units.js";

export const Msg = ({ m }) => (m ? <p className={m[0] === "e" ? "out" : "okmsg"} role="status">{m.slice(2)}</p> : null);

/* number box with a big label */
export const Num = ({ label, v, set, hint, ...p }) => (
  <label>{label}<input type="number" inputMode="decimal" min="0" step="any" value={v} onChange={(e) => set(e.target.value)} {...p} />{hint && <small className="muted">{hint}</small>}</label>
);

/* quantity + unit (Kg / Quintal / Ton) */
export const Qty = ({ label, v, set, units = WUNITS, hint }) => (
  <label>{label}
    <span className="qtyrow">
      <input type="number" inputMode="decimal" min="0" step="any" value={v.q} onChange={(e) => set({ ...v, q: e.target.value })} />
      <select aria-label="Unit" value={v.u} onChange={(e) => set({ ...v, u: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select>
    </span>{hint && <small className="muted">{hint}</small>}
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
    <b>{title}</b>{hi && <em>{hi}</em>}{sub && <small>{sub}</small>}{badge ? <i>{badge}</i> : null}
  </button>
);

export const Empty = ({ text }) => <p className="empty-note">{text}</p>;
