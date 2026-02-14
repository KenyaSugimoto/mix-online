import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const DEV_BACKEND_ORIGIN =
  process.env.VITE_DEV_BACKEND_ORIGIN ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: DEV_BACKEND_ORIGIN,
        changeOrigin: true,
      },
      "/ws": {
        target: DEV_BACKEND_ORIGIN,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
