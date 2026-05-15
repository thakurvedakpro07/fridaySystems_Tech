import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Proxy API requests to the Django backend so you don't have to
    // type the full backend URL in your frontend code.
    // Example: fetch("/api/tickets/") works in both dev and prod.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
