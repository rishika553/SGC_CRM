/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F7F9F6',
        card: '#FFFFFF',
        sidebar: {
          DEFAULT: '#2F4F3A',
          text: '#FFFFFF',
          active: '#DCE9DE',
          'active-text': '#2F4F3A',
        },
        primary: {
          DEFAULT: '#5E8C61',
          hover: '#4F7A52',
          50: '#F7F9F6',
          100: '#DCE9DE',
          600: '#5E8C61',
          700: '#4F7A52',
        },
        accent: '#DCE9DE',
        border: '#E3E8E3',
        heading: '#27332B',
        secondary: '#6B7280',
        text: {
          DEFAULT: '#27332B',
          primary: '#27332B',
          secondary: '#6B7280',
        },
        status: {
          completed: '#4CAF50',
          in_progress: '#5E8C61',
          pending: '#E8A317',
          rejected: '#D9534F',
        },
        table: {
          header: '#F1F5F1',
          hover: '#EEF5EF',
          border: '#E3E8E3',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'DEFAULT': '18px',
        'md': '12px',
        'lg': '16px',
        'xl': '18px',
        '2xl': '18px',
        'card': '18px',
      },
      boxShadow: {
        'card': '0 6px 20px rgba(47, 79, 58, 0.05)',
        'soft': '0 6px 20px rgba(47, 79, 58, 0.05)',
        'subtle': '0 2px 8px rgba(47, 79, 58, 0.04)',
      }
    },
  },
  plugins: [],
}
