import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        muted: "#666666",
        line: "#EAEAEA",
        studio: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#2563EB",
          600: "#1D4ED8",
          700: "#1E40AF"
        }
      },
      boxShadow: {
        soft: "0 12px 36px rgba(0, 0, 0, 0.08)",
        card: "0 1px 2px rgba(0, 0, 0, 0.04)"
      },
      backgroundImage: {
        "studio-glow": "linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)",
        "button-gradient": "linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)"
      }
    }
  },
  plugins: []
};

export default config;
