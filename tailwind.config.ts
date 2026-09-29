import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-devanagari)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: { 50: "#fdf2f2", 100: "#fbe0e0", 500: "#e0353a", 600: "#c8202a", 700: "#a51b23", 900: "#5e0f14" },
        jain: { red: "#d7262b", yellow: "#f5c518", green: "#1f9d4c", blue: "#2b3990" },
      },
    },
  },
  plugins: [],
};
export default config;
