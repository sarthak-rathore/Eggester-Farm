import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react";

const errors = [];
const noise = /act\(|ResponsiveContainer|width\(0\)|width\(-1\)|not wrapped/;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); errors.length = 0; vi.resetModules(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.map(String).join(" ").slice(0, 400)));
  location.hash = "";
});
const real = () => errors.filter((e) => !noise.test(e));
const goto = async (h) => { location.hash = h; await act(async () => { window.dispatchEvent(new HashChangeEvent("hashchange")); await new Promise((r) => setTimeout(r, 30)); }); };
const settle = (ms = 60) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function boot(demo) {
  vi.stubEnv("VITE_DEMO_MODE", demo); vi.stubEnv("VITE_OTP_CHANNEL", "email");
  await import("../src/boot.js"); const App = (await import("../src/App.jsx")).default; return render(<App />);
}
const get = (k) => JSON.parse(localStorage.getItem(k) || "null");
const fakeSession = () => btoa(JSON.stringify({ role: "Owner", exp: Date.now() + 3600e3 })).replace(/=/g, "") + ".sig";
const asOwner = () => { sessionStorage.setItem("kf_ok", "1"); sessionStorage.setItem("kf_role", "Owner"); sessionStorage.setItem("kf_who", "Owner"); sessionStorage.setItem("kf_tok", fakeSession()); };

describe("demo mode off = clean system", () => {
  it("starts empty: no sample data anywhere", async () => {
    await boot("off"); await goto("#/"); await settle();
    for (const k of ["kf_farms", "kf_batches", "kf_logs", "kf_orders", "kf_products", "kf_coupons", "kf_staff", "kf_cust", "kf_exp", "kf_seeded", "kf_demo"]) expect(localStorage.getItem(k), k).toBeNull();
    expect(document.body.textContent).toContain("prices are being set up");
    expect(document.body.textContent).not.toMatch(/98765|demo@customer|Admin@123/);
    expect(real()).toEqual([]);
  });
  it("sample data from an earlier demo run is removed automatically", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "on"); await import("../src/boot.js");
    expect(get("kf_batches").length).toBeGreaterThan(0); expect(get("kf_orders").length).toBeGreaterThan(0);
    localStorage.setItem("kf_users", JSON.stringify([{ id: "demo-user", email: "demo@customer.com" }, { id: "real1", email: "real@x.com" }]));
    vi.resetModules(); vi.stubEnv("VITE_DEMO_MODE", "off"); await import("../src/boot.js");
    for (const k of ["kf_batches", "kf_logs", "kf_orders", "kf_products", "kf_farms", "kf_demo", "kf_seeded"]) expect(localStorage.getItem(k), k).toBeNull();
    expect(get("kf_users").map((u) => u.id)).toEqual(["real1"]); // real customers stay
  });
  it("owner login is OTP only: no password, no demo hint", async () => {
    await boot("off"); await goto("#/admin");
    expect(await screen.findByRole("button", { name: /Send me a code/ })).toBeTruthy();
    expect(screen.queryByLabelText(/Password/)).toBeNull(); expect(document.body.textContent).not.toMatch(/Demo mode|Admin@123/);
  });
  it("OTP flow: ask for code, enter it, reach the dashboard", async () => {
    const calls = []; vi.stubGlobal("fetch", vi.fn(async (url, init) => { calls.push(url); const j = (b, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => b });
      if (url.endsWith("send-otp")) return j({ token: "t.s", to: "ow•••@x.com", expiresIn: 300 });
      if (url.endsWith("verify-otp")) return JSON.parse(init.body).otp === "123456" ? j({ session: fakeSession() }) : j({ error: "wrong" }, false);
      return j({ ok: true }); }));
    await boot("off"); await goto("#/admin"); await screen.findByLabelText(/Your email/);
    fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: "owner@x.com" } }); fireEvent.click(screen.getByRole("button", { name: /Send me a code/ })); await settle();
    const box = await screen.findByLabelText(/Enter the code/); expect(document.body.textContent).toContain("ow•••@x.com");
    fireEvent.change(box, { target: { value: "000000" } }); fireEvent.click(screen.getByRole("button", { name: /^Log in$/ })); await settle();
    expect(document.body.textContent).toContain("not correct"); expect(document.body.textContent).not.toMatch(/Error|stack|undefined/);
    fireEvent.change(screen.getByLabelText(/Enter the code/), { target: { value: "123456" } }); fireEvent.click(screen.getByRole("button", { name: /^Log in$/ })); await settle();
    await screen.findByText(/Good (morning|afternoon|evening)/); expect(document.body.textContent).toContain("set up your farm");
    expect(calls.some((c) => c.endsWith("send-otp"))).toBe(true);
  });
  it("a fake or expired owner session is rejected", async () => {
    sessionStorage.setItem("kf_ok", "1"); sessionStorage.setItem("kf_role", "Owner"); // no server token
    await boot("off"); await goto("#/admin");
    expect(await screen.findByRole("button", { name: /Send me a code/ })).toBeTruthy();
  });
  it("server not set up: friendly message, no technical details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "not_configured" }) })));
    await boot("off"); await goto("#/admin"); await screen.findByLabelText(/Your email/);
    fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: "a@b.com" } }); fireEvent.click(screen.getByRole("button", { name: /Send me a code/ })); await settle();
    expect(document.body.textContent).toContain("not set up yet"); expect(document.body.textContent).not.toMatch(/OTP_SECRET|RESEND|FAST2SMS|ADMIN_EMAIL/);
  });
});

describe("live mode: set up a farm and do a day's work", () => {
  it("add farm and batch in Settings, then Today's Update updates stock, sales and money", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
    asOwner(); await boot("off"); await goto("#/admin/settings/farms"); await screen.findByText("Your farms");
    // add a farm through the screen
    fireEvent.click((await screen.findAllByText("Add new"))[0]); fireEvent.change(screen.getByLabelText("Farm name"), { target: { value: "Main Farm" } }); fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]); await settle();
    expect(get("kf_farms")[0].name).toBe("Main Farm");
    // add a batch through the screen
    fireEvent.click(screen.getAllByText("Add new")[1]);
    fireEvent.change(screen.getByLabelText(/Batch name/), { target: { value: "Batch A" } }); fireEvent.change(screen.getByLabelText("How many chicks"), { target: { value: "1000" } }); fireEvent.change(screen.getByLabelText(/Cost per chick/), { target: { value: "40" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]); await settle();
    const batch = get("kf_batches")[0]; expect(batch.name).toBe("Batch A"); expect(batch.count).toBe(1000);
    // an egg price (tray of 30 = Rs 200)
    localStorage.setItem("kf_products", JSON.stringify([{ id: "p1", name: "Eggs", price: 200, moq: 1, eggs: 30, unit: "tray", active: "Yes", emoji: "🥚", tiers: "" }]));
    vi.resetModules(); document.body.innerHTML = ""; await boot("off");
    await goto(`#/admin/farm/${batch.id}/today`); await settle(100);
    fireEvent.change(screen.getByLabelText("Eggs collected"), { target: { value: "540" } }); fireEvent.change(screen.getByLabelText("Eggs broken"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Add a sale/ }));
    fireEvent.change(screen.getByLabelText("How many"), { target: { value: "1" } }); // 1 box (the sale line's quantity is the only field with this label before purchases)
    fireEvent.click(screen.getByRole("button", { name: /Save today's update/ })); await settle(100);
    const log = get("kf_logs")[0]; expect(log.eggs).toBe(540); expect(log.broken).toBe(10);
    const o = get("kf_orders")[0]; expect(o.items[0].unit).toBe("box"); expect(o.items[0].eggs * o.items[0].qty).toBe(270); expect(o.total).toBe(1800); // 9 trays x Rs 200
    expect(document.body.textContent).toContain("Saved for");
    // the numbers on the dashboard follow
    await goto(`#/admin/farm/${batch.id}/stock`); await screen.findByText("Available now");
    expect(document.body.textContent).toMatch(/Available now\s*8[\s\S]*trays/); // (530 good - 270 sold) / 30 = 8.67 -> 8 trays
    expect(real()).toEqual([]);
  });
});
