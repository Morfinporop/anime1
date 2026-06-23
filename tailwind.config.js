/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    screens: {
      'xs':  '480px',   // маленькие телефоны
      'sm':  '640px',   // большие телефоны
      'md':  '768px',   // планшеты
      'lg':  '1024px',  // маленькие ноутбуки
      'xl':  '1280px',  // десктопы
      '2xl': '1536px',  // большие десктопы
      '3xl': '1920px',  // Full HD+
    },
    extend: {
      fontFamily: {
        display: ['SF Pro Display', '-apple-system', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};