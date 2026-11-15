import React from "react";
import { ResponsiveContainer } from "recharts";
export * from "./kit.jsx";
export const ChartCard = ({ title, hint, h = 260, children }) => (
  <div className="card chart"><h3>{title}</h3>{hint && <p className="muted sm">{hint}</p>}<ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer></div>
);
