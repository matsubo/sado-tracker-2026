import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        "noto-sans-jp": ["Noto Sans JP", "sans-serif"],
        sans: ["Inter", "Noto Sans JP", "system-ui", "sans-serif"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        brand: {
          "cyan-400": "#00d3f2",
          "cyan-950": "#053345",
          "lime-200": "#d8f999",
          "lime-800": "#3d6300",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(to right, rgba(0, 211, 242, .9), rgba(216, 249, 153, .9))",
        "brand-gradient-dark": "linear-gradient(to right, #053345, #3d6300)",
      },
    },
  },
  plugins: [],
};

export default config;
