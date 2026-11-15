import React from "react";
import { createRoot } from "react-dom/client";
import "./boot.js"; // must run before App: seeds or removes sample data
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
// anything not caught elsewhere is logged quietly; people only ever see friendly messages
addEventListener("unhandledrejection", (e) => { console.error("[unhandled]", e.reason); e.preventDefault(); });
