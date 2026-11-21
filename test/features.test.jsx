import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
const goto = async (h) => { location.hash = h; await act(async () => { window.dispatchEvent(new HashChangeEvent("hashchange")); await new Promise((r) => setTimeout(r, 60)); }); };

describe("packing rule: 1 tray = 30 eggs, 1 box = 7 filled trays + 2 empty trays", () => {
  it("212 eggs = 7 trays = 1 box, 2 eggs left", async () => {
    const { packEggs, packText, orderPack, EGGS_PER_BOX, TRAYS_PER_BOX } = await import("../src/farm.js");
    expect(EGGS_PER_BOX).toBe(210); expect(TRAYS_PER_BOX).toBe(9);
    expect(packEggs(212)).toMatchObject({ trays: 7, boxes: 1, looseTrays: 0, looseEggs: 2, emptyInBoxes: 2 });
    expect(packText(packEggs(212)).en).toBe("1 box (7 filled + 2 empty trays each) + 2 eggs left");
    expect(packEggs(29)).toMatchObject({ trays: 0, boxes: 0, looseEggs: 29 });
    expect(packEggs(0).trays).toBe(0);
  });
  it("leftover eggs add up over days and form a new tray and box by themselves", async () => {
    const { packEggs } = await import("../src/farm.js");
    let pool = 0; const seen = [];
    [212, 29, 1, 208].forEach((day) => { pool += day; seen.push(packEggs(pool)); });
    expect(seen[0]).toMatchObject({ boxes: 1, looseEggs: 2 });
    expect(seen[1]).toMatchObject({ trays: 8, boxes: 1, looseTrays: 1, looseEggs: 1 }); // 241 eggs
    expect(seen[2]).toMatchObject({ trays: 8, looseEggs: 2 }); // 242
    expect(seen[3]).toMatchObject({ trays: 15, boxes: 2, looseTrays: 1, looseEggs: 0 }); // 450 eggs = 15 trays = 2 boxes + 1 tray
  });
  it("an order uses its trays plus 2 empty protection trays per box", async () => {
    const { orderPack } = await import("../src/farm.js");
    expect(orderPack(210)).toMatchObject({ trays: 7, boxes: 1, protect: 2, traysUsed: 9 });
    expect(orderPack(211)).toMatchObject({ trays: 8, boxes: 2, traysUsed: 12 });
  });
});

describe("more purchase units", () => {
  it("converts bags, maund, gram, tins and bundles to the stored base unit", async () => {
    const { toBase, unitHint, WUNITS, LUNITS, PUNITS } = await import("../src/units.js");
    expect(toBase(2, "Bag50")).toBe(100); expect(toBase(3, "Maund")).toBe(120); expect(toBase(500, "Gram")).toBe(0.5);
    expect(toBase(2, "Can15")).toBe(30); expect(toBase(250, "ml")).toBe(0.25); expect(toBase(2, "Bundle100")).toBe(200); expect(toBase(3, "Dozen")).toBe(36);
    expect(unitHint(2, "Bag50")).toBe("= 100 kg"); expect(unitHint(2, "Kg")).toBe("");
    expect(WUNITS.length).toBeGreaterThan(3); expect(LUNITS).toContain("Drum"); expect(PUNITS).toContain("Bundle50");
  });
});

describe("loss reason and laying advice", () => {
  it("explains a loss caused by bulk feed buying in one plain line", async () => {
    const { lossReason } = await import("../src/insights.js");
    const r = lossReason({ revenue: 20000, expense: 60000, byCat: { "Feed / Raw Materials": 45000, Transport: 15000 }, feedKg: 1500 });
    expect(r.en).toMatch(/bought|buying/); expect(r.en).toMatch(/feed and raw materials/); expect(r.en).toMatch(/1500 kg/); expect(r.hi).toMatch(/दाना और कच्चा माल/);
    expect(lossReason({ revenue: 10, expense: 5 })).toBeNull();
  });
  it("gives simple corrective advice for low laying", async () => {
    const { layingAdvice } = await import("../src/farm.js");
    const a = layingAdvice({ gPerBird: 90, ageWeeks: 80, mortPct: 2 });
    expect(a.length).toBe(3); expect(a[0].en).toMatch(/Give a little more feed/); expect(a[2].en).toMatch(/replace|new flock/); a.forEach((x) => expect(x.hi).toMatch(/[\u0900-\u097F]/));
  });
});

describe("Hindi + English toggle", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); document.body.innerHTML = ""; });
  it("looks up everyday Hindi for the technical terms", async () => {
    const { hiOf } = await import("../src/i18n.jsx");
    expect(hiOf("Mortality")).toMatch(/मृत्यु दर/); expect(hiOf("Raw materials")).toBe("कच्चा माल"); expect(hiOf("Laying rate (7 days)")).toMatch(/अंडे देने की दर/);
    expect(hiOf("Overall Farm Overview")).toBe("पूरे फार्म का हाल"); expect(hiOf("Quintal (100 kg)")).toMatch(/क्विंटल/); expect(hiOf("98 trays")).toBe("98 ट्रे");
  });
  it("shows English (Hindi), then Hindi only, and the choice is remembered", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "on");
    await import("../src/boot.js"); const App = (await import("../src/App.jsx")).default; render(<App />);
    await goto("#/admin"); fireEvent.click(await screen.findByRole("button", { name: /^Log in/ })); await screen.findByText(/Today's Priority Actions/);
    expect(document.body.textContent).toContain("Overall Farm Overviewपूरे फार्म का हाल");
    fireEvent.click(screen.getAllByRole("button", { name: "सिर्फ हिंदी" })[0]); await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(document.body.textContent).toContain("आज के सबसे ज़रूरी काम"); expect(document.body.textContent).not.toContain("Today's Priority Actions"); expect(document.body.textContent).not.toContain("Overall Farm Overview");
    expect(JSON.parse(localStorage.getItem("kf_lang"))).toBe("hi");
    fireEvent.click(screen.getAllByRole("button", { name: "हिंदी + English" })[0]); await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(document.body.textContent).toContain("Today's Priority Actions (आज के सबसे ज़रूरी काम)");
  });
});

describe("priority card, packing preview and unit options in the owner screens", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); document.body.innerHTML = ""; });
  it("home shows at most 3 priority actions before any raw numbers; today's update shows trays and boxes live; purchase units are many", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "on");
    await import("../src/boot.js"); const App = (await import("../src/App.jsx")).default; render(<App />);
    await goto("#/admin"); fireEvent.click(await screen.findByRole("button", { name: /^Log in/ })); await screen.findByText(/Today's Priority Actions/);
    const card = document.querySelector(".prio"); expect(card).toBeTruthy(); expect(card.querySelectorAll("ol > li").length).toBeLessThanOrEqual(3); expect(card.querySelectorAll("ol > li").length).toBeGreaterThan(0);
    const b = JSON.parse(localStorage.getItem("kf_batches"))[0].id;
    await goto(`#/admin/farm/${b}/today`);
    const eggs = await screen.findByLabelText(/^Eggs collected/); fireEvent.change(eggs, { target: { value: "212" } }); fireEvent.change(screen.getByLabelText(/^Eggs broken/), { target: { value: "0" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(document.body.textContent).toMatch(/212 good eggs = 7 trays/); expect(document.body.textContent).toMatch(/1 box \(7 filled \+ 2 empty trays each\)/);
    const opts = [...document.querySelectorAll("select[aria-label^=Unit] option")].map((o) => o.value); expect(opts).toEqual(expect.arrayContaining(["Kg", "Quintal", "Ton", "Gram", "Bag50", "Maund"]));
  });
});
