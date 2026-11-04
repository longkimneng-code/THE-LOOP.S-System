/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        loops: {
          bg: '#07090D',
          card: '#111520',
          elevated: '#171D2D',
          border: 'rgba(255, 255, 255, 0.08)',
          gold: '#E5A93C',
          'gold-light': '#F3C368',
          mint: '#10B981',
          rose: '#F43F5E',
          sky: '#38BDF8',
          muted: '#94A3B8'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
};

