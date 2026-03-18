import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#1A3C28",
          "green-dark": "#122B1C",
          "green-light": "#2E7D47",
          "green-accent": "#4CA868",
        },
      },
    },
  },
  plugins: [],
};
export default config;
