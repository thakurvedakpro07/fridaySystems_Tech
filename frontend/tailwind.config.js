/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      boxShadow: {
        card:        "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-sm":   "0 1px 4px 0 rgb(0 0 0 / 0.06)",
        "card-hover":"0 4px 16px -2px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)",
        dropdown:    "0 10px 40px -4px rgb(0 0 0 / 0.14), 0 4px 16px -2px rgb(0 0 0 / 0.08)",
        modal:       "0 24px 64px -8px rgb(0 0 0 / 0.22), 0 8px 24px -4px rgb(0 0 0 / 0.08)",
        glow:        "0 0 0 3px rgb(99 102 241 / 0.2)",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-right": {
          "0%":   { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.18s ease-out both",
        "slide-up":       "slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "skeleton-pulse": "skeleton-pulse 1.6s ease-in-out infinite",
        shimmer:          "shimmer 1.4s ease-in-out infinite",
        float:            "float 3s ease-in-out infinite",
        "scale-in":       "scale-in 0.15s ease-out both",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)",
        "hero-pattern": "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(99 102 241 / 0.15), transparent)",
      },
    },
  },
  plugins: [],
};
