/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#2B2B45',
        cream: '#FFF9EC',
        cloud: '#8ED3F4',
        grape: '#B9A7FF',
        lemon: '#FFE066',
        peach: '#FFB4A2',
        cartoon: {
          yellow: '#FDE68A',
          orange: '#FFB26B',
          coral: '#FF8A80',
          mint: '#A7F3D0',
          blue: '#93C5FD',
          indigo: '#A5B4FC',
          dark: '#1E293B',
          muted: '#7C7A8A',
        },
      },
      fontFamily: {
        cartoon: [
          '"Chalkboard SE"',
          '"Comic Sans MS"',
          '"Marker Felt"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'bounce-soft': 'bounceSoft 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'pop-in': 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shake': 'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'wiggle': 'wiggle 1.4s ease-in-out infinite',
        'dash': 'dash 0.8s linear infinite',
        'sparkle': 'sparkle 1.6s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
      },
      keyframes: {
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(-4%)' },
          '50%': { transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        popIn: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        dash: {
          to: { strokeDashoffset: '-24' },
        },
        sparkle: {
          '0%, 100%': { transform: 'scale(0.85) rotate(-8deg)', opacity: '0.65' },
          '50%': { transform: 'scale(1.15) rotate(8deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
