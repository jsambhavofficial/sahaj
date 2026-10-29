import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          800: "#0c4a6e",
          900: "#082f49",
        },
        risk: {
          low: {
            bg: "#ecfdf5",
            text: "#065f46",
            border: "#a7f3d0",
            dot: "#10b981",
          },
          moderate: {
            bg: "#fffbeb",
            text: "#92400e",
            border: "#fde68a",
            dot: "#f59e0b",
          },
          high: {
            bg: "#fff7ed",
            text: "#9a3412",
            border: "#fed7aa",
            dot: "#f97316",
          },
          urgent: {
            bg: "#fef2f2",
            text: "#991b1b",
            border: "#fecaca",
            dot: "#ef4444",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;

