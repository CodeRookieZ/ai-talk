/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wechat-bg': '#EDEDED',
        'wechat-green': '#95EC69',
        'wechat-header': '#F7F7F7',
      },
    },
  },
  plugins: [],
};
