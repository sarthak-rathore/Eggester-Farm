import React, { useState, useEffect, lazy, Suspense } from "react";
import { FARM, SEED_PRODUCTS } from "./config.js";
import { useLS } from "./store.js";
import { seedDemo } from "./farm.js";
import Shop from "./Shop.jsx";

const Account = lazy(() => import("./Account.jsx"));
const Owner = lazy(() => import("./Owner.jsx"));
const Lz = ({ children }) => <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>;

const useHash = () => {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => { setH(location.hash); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
};

export default function App() {
  const hash = useHash();
  const [products, setProducts] = useLS("kf_products", SEED_PRODUCTS);
  const [orders, setOrders] = useLS("kf_orders", []);
  const [txns, setTxns] = useLS("kf_txns", []);
  useEffect(() => { if (!localStorage.getItem("kf_seeded")) { seedDemo(FARM.demo); localStorage.setItem("kf_seeded", "1"); } }, []);
  const data = { products, setProducts, orders, setOrders, txns, setTxns };
  if (hash.startsWith("#/admin")) return <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Loading…</p>}><Owner {...data} /></Suspense>;
  if (hash.startsWith("#/account")) return <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Loading your account…</p>}><Account {...data} /></Suspense>;
  return <Shop {...data} />;
}

