import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F8F9FC',
        ink: '#16213E',
        accent: '#4F46E5',
        positive: '#059669',
        warning: '#D97706',
        negative: '#DC2626',
      },
    },
  },
  plugins: [],
};

export default config;
