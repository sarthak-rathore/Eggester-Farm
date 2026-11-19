import { Loading } from "./ui.jsx";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { SEED_PRODUCTS, CUSTOMERS } from "./config.js";
import { useLS } from "./store.js";
import Shop from "./Shop.jsx";

const Account = lazy(() => import("./Account.jsx"));
const Owner = lazy(() => import("./Owner.jsx"));
const Lz = ({ children }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

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
  const data = { products, setProducts, orders, setOrders, txns, setTxns };
  if (hash.startsWith("#/admin")) return <Suspense fallback={<Loading />}><Owner {...data} /></Suspense>;
  if (CUSTOMERS && hash.startsWith("#/account")) return <Suspense fallback={<Loading />}><Account {...data} /></Suspense>;
  return <Shop {...data} />;
}

