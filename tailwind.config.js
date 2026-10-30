/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['DM Sans', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        ink: '#17221e',
        paper: '#f5f6f3',
        moss: '#28664d',
        lime: '#c4e86a',
      },
    },
  },
  plugins: [],
};