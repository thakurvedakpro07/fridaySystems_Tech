import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // ── Dev server ─────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    // Proxy /api/* and /media/* to the Django backend so the browser can call
    // them on the same origin during development — avoids CORS and matches
    // production behaviour (nginx/nginx.conf proxies both under one host too).
    //
    // changeOrigin is intentionally left off: prod's nginx forwards the
    // original Host header unchanged (`proxy_set_header Host $host`), which is
    // what lets TicketAttachmentSerializer.get_file_url() build a correct,
    // browser-reachable absolute URL via request.build_absolute_uri(). Setting
    // changeOrigin here would rewrite the Host header to the proxy target
    // (e.g. "backend:8000" inside Docker Compose) and Django would bake that
    // unreachable hostname into every attachment's file_url instead.
    proxy: {
      "/api": {
        // Outside Docker: VITE_API_TARGET is unset → falls back to localhost:8000
        // Inside Docker:  VITE_API_TARGET=http://backend:8000 (set in docker-compose.yml)
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
      },
      "/media": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
      },
    },
  },

  // ── Production build ────────────────────────────────────────────────────────
  build: {
    outDir: "dist",
    // Sourcemaps in production expose your source tree — keep off unless debugging
    sourcemap: mode !== "production",
    // Warn about chunks larger than 500 kB before they noticeably slow load times
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks:
        //   vendor.js — React, React DOM, React Router (rarely changes → long-lived cache)
        //   state.js  — Zustand
        //   http.js   — Axios
        // The app chunk contains only your own code — it changes most often, so keeping
        // it separate lets browsers cache vendor chunks across deployments.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          state: ["zustand"],
          http: ["axios"],
        },
        // Vite adds a content hash to filenames by default (e.g. vendor-Bq3d9xKm.js)
        // which allows Nginx to cache them with "Cache-Control: immutable".
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
}));
