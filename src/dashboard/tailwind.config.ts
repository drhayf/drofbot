import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: {
          1: "#f8f6f1",
          2: "#f0ede6",
          3: "#e8e4db",
          4: "#ddd8cd",
        },
        ink: {
          1: "#1a1816",
          2: "#4a4640",
          3: "#8a8580",
          4: "#b5b0a8",
        },
        accent: {
          DEFAULT: "#2c5a4a",
          light: "#3d7a66",
          subtle: "rgba(44, 90, 74, 0.08)",
        },
        positive: "#3d7a56",
        caution: "#8a7a3d",
        negative: "#8a4a3d",
        surface: {
          raised: "#ffffff",
          inset: "#f3f0e9",
        },
        border: {
          DEFAULT: "#e0dbd2",
          subtle: "#ebe8e1",
        },
        // Elements
        fire: "#b07050",
        water: "#507090",
        air: "#90905a",
        earth: "#608050",
        ether: "#706090",
        // Frequency
        shadow: "#7a5a6a",
        gift: "#5a7a6a",
        siddhi: "#7a7a5a",
      },
      fontFamily: {
        display: ['"Source Serif 4"', "Georgia", "serif"],
        body: ['"DM Sans"', "-apple-system", "sans-serif"],
      },
      fontSize: {
        data: ["0.9375rem", { letterSpacing: "0.02em", fontWeight: "500" }],
      },
      spacing: {
        // 4px base
        "18": "4.5rem",
        "88": "22rem",
      },
      maxWidth: {
        content: "1120px",
        prose: "680px",
      },
      borderRadius: {
        card: "6px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26, 24, 22, 0.04)",
        "card-hover": "0 2px 8px rgba(26, 24, 22, 0.06)",
        elevated: "0 4px 16px rgba(26, 24, 22, 0.08)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "200ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
