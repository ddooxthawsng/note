/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#cc785c',
          active: '#a9583e',
          hover: '#a9583e',
          disabled: '#e6dfd8',
          50: '#faf9f5',
          100: '#e6dfd8',
          500: '#cc785c',
          600: '#a9583e',
          700: '#8c442e',
        },
        ink: {
          DEFAULT: '#141413',
          strong: '#252523',
          body: '#3d3d3a',
          muted: '#6c6a64',
          'muted-soft': '#8e8b82',
        },
        canvas: {
          DEFAULT: '#faf9f5',
          soft: '#f5f0e8',
          card: '#efe9de',
          strong: '#e8e0d2',
        },
        dark: {
          DEFAULT: '#181715',
          elevated: '#252320',
          soft: '#1f1e1b',
        },
        hairline: {
          DEFAULT: '#e6dfd8',
          soft: '#ebe6df',
        },
        success: '#5db872',
        warning: '#d4a017',
        error: '#c64545',
        accent: {
          teal: '#5db8a6',
          amber: '#e8a55a',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Tiempos Headline', 'Garamond', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
