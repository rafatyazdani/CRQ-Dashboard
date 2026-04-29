/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accenture brand purple
        brand: {
          50:  "#f5e6ff",
          100: "#ead6ff",
          200: "#d4adff",
          300: "#bf85ff",
          400: "#a94dff",
          500: "#A100FF",
          600: "#8800d9",
          700: "#6e00b3",
          800: "#56008c",
          900: "#3d0066",
          950: "#240040",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
