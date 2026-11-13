// Quantities are stored in base units: kg (or litres for liquids). 1 quintal = 100 kg, 1 ton = 1000 kg.
export const UNIT_MULT = { Kg: 1, Quintal: 100, Ton: 1000, Litre: 1 };
export const WUNITS = ["Kg", "Quintal", "Ton"];
export const toBase = (q, u) => (+q || 0) * (UNIT_MULT[u] || 1);
const fmt = (v, d = 0) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });
export const kgText = (n) => `${fmt(n, 1)} kg` + (n >= 100 ? ` (${fmt(n / 100, 1)} quintal)` : "");
export const qtyText = (n, base = "kg") => (base === "ltr" ? `${fmt(n, 1)} litre` : kgText(n));
