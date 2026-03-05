/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mafia: {
          bg: '#1a1a2e',
          surface: '#16213e',
          card: '#0f3460',
          accent: '#e94560',
          gold: '#f5c518',
          police: '#4a9eff',
          citizen: '#4ade80',
          danger: '#ef4444',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        game: ['Noto Sans KR', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
