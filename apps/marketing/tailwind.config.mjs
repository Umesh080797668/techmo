/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary:    { DEFAULT: '#1e40af', light: '#3b82f6', dark: '#1e3a8a' },
        secondary:  { DEFAULT: '#0f172a' },
        accent:     { DEFAULT: '#f59e0b' },
        surface:    { DEFAULT: '#ffffff' },
        background: { DEFAULT: '#f8fafc' },
        success:    { DEFAULT: '#16a34a' },
        warning:    { DEFAULT: '#d97706' },
        danger:     { DEFAULT: '#dc2626' },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'fast':   '150ms',
        'normal': '250ms',
        'slow':   '350ms',
      },
    },
  },
  plugins: [],
};
