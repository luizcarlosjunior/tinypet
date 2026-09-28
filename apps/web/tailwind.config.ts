import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#fff4ed", 100: "#ffe6d5", 200: "#feccaa", 300: "#fdab74", 400: "#fb7d3c", 500: "#f95d16", 600: "#ea420c", 700: "#c22f0c", 800: "#9a2712", 900: "#7c2312" },
        ink: { 50: "#f6f7f9", 100: "#eceef2", 200: "#d5d9e2", 300: "#b1b8c8", 400: "#8792a8", 500: "#68748e", 600: "#535d75", 700: "#444c5f", 800: "#3a4150", 900: "#242833", 950: "#171a21" },
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
