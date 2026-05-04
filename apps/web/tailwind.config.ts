import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Legacy light-theme tokens (kept for any remaining light UI)
        bg: "#f4f7f3",
        ink: "#1f2720",
        accent: "#7c3aed",
        accentSoft: "#2d1b69",
        card: "#0d111f",

        // Dark midnight theme tokens
        "hp-bg":      "#05070f",
        "hp-mid":     "#080d1a",
        "hp-surface": "rgba(255,255,255,0.04)",
        "hp-border":  "rgba(255,255,255,0.08)",
        "hp-purple":  "#7c3aed",
        "hp-blue":    "#3b82f6",
        "hp-cyan":    "#06b6d4",
        "hp-amber":   "#f59e0b",
        "hp-rose":    "#f43f5e",
        "hp-text":    "#e2e8f0",
        "hp-muted":   "#64748b",
      },
      backgroundOpacity: {
        "8": "0.08",
        "12": "0.12",
      },
      borderOpacity: {
        "8": "0.08",
        "12": "0.12",
      },
    }
  },
  plugins: []
};

export default config;
