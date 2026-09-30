import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ["pixi.js"],
          network: ["msw", "axios", "@tanstack/react-query"],
        },
      },
    },
  },
});
