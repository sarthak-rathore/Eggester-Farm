import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020", sourcemap: false, chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks(id) { // big libraries get their own long-cached files; charts load only when a chart screen opens
      if (!id.includes("node_modules")) return;
      if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
      if (/node_modules\/(recharts|d3-[^/]*|victory-vendor|recharts-scale|react-smooth|react-transition-group|decimal\.js-light|fast-equals|tiny-invariant|clsx|lodash|eventemitter3|internmap)\//.test(id)) return "charts";
    } } },
  },
});
