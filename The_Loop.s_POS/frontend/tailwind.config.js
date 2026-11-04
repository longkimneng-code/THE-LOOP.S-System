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
        obsidian: {
          950: '#090A0F',
          900: '#0F1117',
          850: '#13161F',
          800: '#181C26',
          750: '#1F273D',
          700: '#232838',
          600: '#32394E',
          500: '#47516B'
        },
        brass: {
          400: '#E5C358',
          500: '#D4AF37',
          600: '#B89628',
          700: '#94751B'
        },
        studio: {
          950: '#07090D',
          900: '#0C0F17',
          850: '#111520',
          800: '#171D2D',
          700: '#232B40',
          600: '#34405E',
          400: '#64748B',
          300: '#94A3B8',
          200: '#CBD5E1',
          100: '#F1F5F9',
        },
        gold: {
          400: '#FBBF24',
          500: '#E5A93C',
          600: '#D97706',
          glow: 'rgba(229, 169, 60, 0.15)',
        },
        crimson: {
          400: '#FB7185',
          500: '#F43F5E',
          glow: 'rgba(244, 63, 94, 0.15)',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
          glow: 'rgba(16, 185, 129, 0.15)',
        },
        porcelain: {
          50: '#FAFBFD',
          100: '#F3F4F8',
          200: '#E5E7F0',
          300: '#D1D5E3'
        },
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
        display: ['Syne', 'sans-serif'],
        sans: ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}

