/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    fontFamily: {
      'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      'heading': ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif']
    },
    extend: {
      colors: {
        primary: '#0D9488',
        'primary-dark': '#0B7A70',
        secondary: '#F59E0B',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse-slow 5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0px)' }
        },
        'pulse-slow': {
          '0%': { opacity: '0.8' },
          '50%': { opacity: '0.3' },
          '100%': { opacity: '0.8' }
        }
      }
    },
  },
  plugins: [],
};