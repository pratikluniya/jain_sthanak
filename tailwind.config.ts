import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', '"Mukta"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: { 50: "#fff8ed", 100: "#ffefd4", 500: "#e07a10", 600: "#c4650a", 700: "#a3500c", 900: "#5c2c08" },
      },
    },
  },
  plugins: [],
};
export default config;
