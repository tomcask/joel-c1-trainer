import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.GITHUB_PAGES === "true" ? "/joel-c1-trainer/" : "/";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    chunkSizeWarningLimit: 700,
  },
});
