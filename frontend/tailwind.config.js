/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf8ef',
          100: '#f8edda',
          200: '#f1d8b0',
          300: '#e8be7e',
          400: '#dda04a',
          500: '#c4974a',  // primary gold
          600: '#a07830',
          700: '#7d5e28',
          800: '#5c4620',
          900: '#3d2e15',
        },
        dark: {
          bg:      '#0D0C0B',
          surface: '#161412',
          border:  '#262220',
          muted:   '#7A746E',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
