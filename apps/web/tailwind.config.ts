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
        bg: "#f4f7f3",
        ink: "#1f2720",
        accent: "#116149",
        accentSoft: "#d8efe6",
        card: "#ffffff"
      }
    }
  },
  plugins: []
};

export default config;
