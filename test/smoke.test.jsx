import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react";

const errors = [];
const noise = /act\(|ResponsiveContainer|width\(0\)|width\(-1\)|not wrapped|The width|Warning: (Each child|validateDOMNesting)/;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); errors.length = 0; vi.resetModules(); vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.map(String).join(" ").slice(0, 400)));
  location.hash = "";
});
const real = () => errors.filter((e) => !noise.test(e));
const goto = async (h) => { location.hash = h; await act(async () => { window.dispatchEvent(new HashChangeEvent("hashchange")); await new Promise((r) => setTimeout(r, 30)); }); };
async function boot(demo = "on") {
  vi.stubEnv("VITE_DEMO_MODE", demo);
  await import("../src/boot.js");
  const App = (await import("../src/App.jsx")).default;
  return render(<App />);
}
const login = async () => { await goto("#/admin"); fireEvent.click(await screen.findByRole("button", { name: /^Log in$/ })); await screen.findByText(/Good (morning|afternoon|evening)/); };
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });
const ids = () => JSON.parse(localStorage.getItem("kf_batches") || "[]").map((b) => b.id);

describe("demo mode: every owner screen opens without errors", () => {
  it("primary pages and all 14 farm sections", async () => {
    await boot(); await login();
    for (const p of ["farms", "overview", "reports", "settings"]) { await goto("#/admin/" + p); await settle(); }
    const b = ids()[0];
    for (const s of ["overview", "today", "production", "sales", "expenses", "stock", "feed", "mortality", "health", "purchases", "staff", "tasks", "documents", "reports"]) {
      await goto(`#/admin/farm/${b}/${s}`); await settle();
      expect(document.querySelector(".errbox"), "section " + s + " crashed").toBeNull();
    }
    expect(real()).toEqual([]);
  });
  it("all settings pages", async () => {
    await boot(); await login();
    for (const s of ["farms", "owner", "staff", "suppliers", "customers", "fields", "notify", "roles", "backup", "account", "shop", "help"]) {
      await goto("#/admin/settings/" + s); await settle();
      expect(document.querySelector(".errbox"), "settings " + s + " crashed").toBeNull();
      expect(document.querySelector(".admin .wrap").textContent.length, "settings " + s + " is empty").toBeGreaterThan(20);
    }
    expect(real()).toEqual([]);
  });
  it("shop home and customer pages", async () => {
    await boot(); await goto("#/"); await settle();
    expect(document.body.textContent).toContain("Eggester");
    await goto("#/account"); await settle();
    expect(real()).toEqual([]);
  });
});
