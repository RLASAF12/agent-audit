import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        eu: {
          blue: '#003399',
          gold: '#FFCC00',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-in-out',
        'pulse-once': 'pulseOnce 1s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseOnce: {
          '0%': { backgroundColor: 'rgba(255, 204, 0, 0.3)' },
          '50%': { backgroundColor: 'rgba(255, 204, 0, 0.1)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}

export default config
