import type { Config } from "tailwindcss";

// Палитра и шрифты — как у aimag-electric (стальной синий + сигнальный янтарный).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        steel: {
          50: "#f3f5f8",
          100: "#e4e9f0",
          200: "#c6d0de",
          300: "#9caebf",
          400: "#6c839c",
          500: "#4d6580",
          600: "#3c5069",
          700: "#334156",
          800: "#2c3849",
          900: "#0e1622",
          950: "#080d15",
        },
        signal: {
          DEFAULT: "#ffb300",
          50: "#fff4d6",
          400: "#ffc23d",
          500: "#ffb300",
          600: "#e69800",
          700: "#b87500",
          800: "#8a5a00",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
