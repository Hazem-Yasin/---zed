/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Arabic text at 12px is hard to read; 13px keeps dense UIs compact but legible
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      fontFamily: {
        amiri: ['"Scheherazade New"', 'Amiri', '"Noto Naskh Arabic"', 'serif'],
        quran: ['"Scheherazade New"', 'Amiri', '"Noto Naskh Arabic"', 'serif'],
        cairo: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        mushaf: {
          bg: '#fcf8ec',
          page: '#faf4e6',
          border: '#d4b483',
          gold: '#c99b24',
          frame: '#936a28',
          text: '#1a1917',
          darkBg: '#121519',
          darkPage: '#1a1e24',
          darkBorder: '#353c48',
        },
        themeBranch: {
          blue: '#1976D2',
          green: '#2E7D32',
          orange: '#EF6C00',
          purple: '#6A1B9A',
          red: '#C2185B',
          teal: '#00796B',
          gold: '#D97706',
        }
      }
    },
  },
  plugins: [],
}
