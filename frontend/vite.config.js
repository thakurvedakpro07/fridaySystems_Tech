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
        // Outside Docker: VITE_API_TARGET is unset → falls back to localhost:8000
        // Inside Docker:  VITE_API_TARGET=http://backend:8000 (set in docker-compose.yml)
        //   "backend" is the Docker service name — Docker's internal DNS resolves
        //   it to the backend container's IP on the private Docker network.
        //   Using "localhost" here would point to the frontend container itself,
        //   where no Django process is running.
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
