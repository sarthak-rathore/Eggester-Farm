// Quantities are stored in base units: kg for weights, litres for liquids, pieces for trays/boxes.
// Every unit below knows how many base units it holds, so "2 Bag (50 kg)" is saved as 100 kg.
export const UNIT_DEFS = {
  // weight (base: kg)
  Gram: { m: 0.001, kind: "w", en: "Gram", hi: "ग्राम" },
  Kg: { m: 1, kind: "w", en: "Kg", hi: "किलो" },
  Quintal: { m: 100, kind: "w", en: "Quintal (100 kg)", hi: "क्विंटल" },
  Ton: { m: 1000, kind: "w", en: "Ton (1000 kg)", hi: "टन" },
  Maund: { m: 40, kind: "w", en: "Maund / Mann (40 kg)", hi: "मन" },
  Bag25: { m: 25, kind: "w", en: "Bag (25 kg)", hi: "बोरी 25 किलो" },
  Bag30: { m: 30, kind: "w", en: "Bag (30 kg)", hi: "बोरी 30 किलो" },
  Bag40: { m: 40, kind: "w", en: "Bag (40 kg)", hi: "बोरी 40 किलो" },
  Bag50: { m: 50, kind: "w", en: "Bag / Bori (50 kg)", hi: "बोरी 50 किलो" },
  // liquid (base: litre)
  ml: { m: 0.001, kind: "l", en: "Millilitre (ml)", hi: "मिलीलीटर" },
  Litre: { m: 1, kind: "l", en: "Litre", hi: "लीटर" },
  Can5: { m: 5, kind: "l", en: "Can (5 litre)", hi: "डिब्बा 5 लीटर" },
  Can15: { m: 15, kind: "l", en: "Tin (15 litre)", hi: "टिन 15 लीटर" },
  Drum: { m: 200, kind: "l", en: "Drum (200 litre)", hi: "ड्रम 200 लीटर" },
  // counted things: empty trays, boxes, packing material
  Piece: { m: 1, kind: "p", en: "Piece", hi: "नग" },
  Dozen: { m: 12, kind: "p", en: "Dozen (12)", hi: "दर्जन" },
  Bundle10: { m: 10, kind: "p", en: "Bundle (10)", hi: "बंडल 10" },
  Bundle50: { m: 50, kind: "p", en: "Bundle (50)", hi: "बंडल 50" },
  Bundle100: { m: 100, kind: "p", en: "Bundle (100)", hi: "बंडल 100" },
};
export const UNIT_MULT = Object.fromEntries(Object.entries(UNIT_DEFS).map(([k, v]) => [k, v.m]));
const keys = (kind) => Object.keys(UNIT_DEFS).filter((k) => UNIT_DEFS[k].kind === kind);
export const WUNITS = ["Kg", "Quintal", "Ton", "Gram", "Maund", "Bag25", "Bag30", "Bag40", "Bag50"]; // weights: common ones first
export const LUNITS = ["Litre", "ml", "Can5", "Can15", "Drum"];
export const PUNITS = ["Piece", "Dozen", "Bundle10", "Bundle50", "Bundle100"];
export const unitsFor = (kind) => ({ w: WUNITS, l: LUNITS, p: PUNITS }[kind] || WUNITS);
export const unitKind = (u) => UNIT_DEFS[u]?.kind || "w";
export const unitLabel = (u) => UNIT_DEFS[u]?.en || u;
export const toBase = (q, u) => (+q || 0) * (UNIT_MULT[u] || 1);
const fmt = (v, d = 0) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });
export const kgText = (n) => `${fmt(n, 1)} kg` + (n >= 100 ? ` (${fmt(n / 100, 1)} quintal)` : "");
export const qtyText = (n, base = "kg") => (base === "ltr" ? `${fmt(n, 1)} litre` : kgText(n));
/* "= 100 kg" shown under the box whenever the unit is not already the base unit */
export const unitHint = (q, u) => {
  const d = UNIT_DEFS[u]; if (!d || !(+q > 0) || d.m === 1) return "";
  const base = d.kind === "w" ? "kg" : d.kind === "l" ? "litre" : "pieces";
  return `= ${fmt(toBase(q, u), 3)} ${base}`;
};
