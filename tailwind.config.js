/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#E53935',
          orange: '#FF5722',
          coral: '#F4511E',
          dark: '#111827',
          charcoal: '#1F2937',
          stone: '#374151',
          cream: '#FDFCF7',
          warmwhite: '#FAF9F5',
          surface: '#F4F2EB',
          subtle: '#E7E5DD'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'floating': '0 20px 40px -15px rgba(0, 0, 0, 0.12)'
      }
    },
  },
  plugins: [],
}
