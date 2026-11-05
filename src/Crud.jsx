import React, { useState } from "react";
import { uid } from "./store.js";

const ov = (o) => (typeof o === "object" ? o.v : o), ol = (o) => (typeof o === "object" ? o.l : o);
export default function Crud({ rows, fields, onSave, onDelete, title, blank, noAdd, csvName, readOnly }) {
  const [ed, setEd] = useState(null);
  const set = (k, v) => setEd({ ...ed, [k]: v });
  const csv = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cell = (r, f) => (f.fmt ? f.fmt(r[f.k], r) : r[f.k]);
    const text = [fields.map((f) => q(f.label)).join(","), ...rows.map((r) => fields.map((f) => q(cell(r, f))).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `${csvName || title.toLowerCase().replace(/\W+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
  return (
    <section className="card">
      <div className="bar"><h3>{title}</h3><div className="row"><button className="btn sm ghost" onClick={csv}>Download CSV</button>{!noAdd && !readOnly && <button className="btn sm" onClick={() => setEd({ ...blank })}>Add new</button>}</div></div>
      {ed && (
        <form className="form grid2" onSubmit={(e) => { e.preventDefault(); const full = { ...ed }; fields.forEach((f) => { if (f.opts && full[f.k] === undefined) full[f.k] = f.opts.length ? ov(f.opts[0]) : ""; }); onSave({ ...full, id: full.id || uid() }); setEd(null); }}>
          {fields.filter((f) => !f.noForm).map((f) => (
            <label key={f.k}>{f.label}
              {f.opts ? <select value={ed[f.k] ?? (f.opts.length ? ov(f.opts[0]) : "")} onChange={(e) => set(f.k, e.target.value)}>{f.opts.map((o) => <option key={ov(o)} value={ov(o)}>{ol(o)}</option>)}</select>
                : <input required={f.req !== false} type={f.type || "text"} step={f.type === "number" ? "any" : undefined} value={ed[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} />}
            </label>
          ))}
          <div className="row"><button className="btn sm">Save</button><button type="button" className="btn sm ghost" onClick={() => setEd(null)}>Cancel</button></div>
        </form>
      )}
      <div className="scroll"><table><thead><tr>{fields.map((f) => <th key={f.k}>{f.label}</th>)}{!readOnly && <th />}</tr></thead>
        <tbody>{rows.slice(0, 300).map((r) => (
          <tr key={r.id}>{fields.map((f) => <td key={f.k} className={f.k === "status" || f.k === "type" ? "tag " + String(r[f.k]).toLowerCase() : ""}>{f.fmt ? f.fmt(r[f.k], r) : r[f.k]}</td>)}
            {!readOnly && <td className="act"><button onClick={() => setEd(r)}>Edit</button><button onClick={() => confirm("Delete this entry?") && onDelete(r.id)}>Delete</button></td>}</tr>
        ))}</tbody></table>
        {!rows.length && <p className="muted">Nothing here yet. {noAdd ? "" : "Use “Add new” to create the first entry."}</p>}
      </div>
    </section>
  );
}
