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
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#E5E5E5",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#525252",
          600: "#404040",
          700: "#171717"
        }
      },
      boxShadow: {
        soft: "0 12px 36px rgba(0, 0, 0, 0.08)",
        card: "0 1px 2px rgba(0, 0, 0, 0.04)"
      },
      backgroundImage: {
        "studio-glow": "linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)",
        "button-gradient": "linear-gradient(180deg, #171717 0%, #0A0A0A 100%)"
      }
    }
  },
  plugins: []
};

export default config;
