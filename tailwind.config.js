/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* 语义色板：全站唯一真源。
         原先的 primary / earth / accent / secondary / warning / danger 六套色板
         经核查零使用率，已移除，避免再次出现多套近似色并存。 */
      colors: {
        brand: { DEFAULT: '#2d7a4f', deep: '#1a4a2e', tint: '#eaf3e8', line: '#cfe0c9' },
        ink: { DEFAULT: '#1c1c1c', soft: '#3d423d' },
        muted: '#737a72',
        subtle: '#9aa199',
        faint: '#dde1d8',
        paper: { DEFAULT: '#f8f6f0', warm: '#f1efe7' },
        surface: '#ffffff',
        gold: { DEFAULT: '#e8a83e', deep: '#8a5f1c', soft: '#fbf1dd' },
        clay: '#d95c5c',
      },
      fontFamily: {
        sans: ['"Inter Var"', 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif SC"', 'Songti SC', 'STSong', 'Source Han Serif SC', 'SimSun', 'Georgia', 'serif'],
      },
      /* 流式字号阶梯：杂志风依赖强字号对比，标题与正文差距要拉开 */
      fontSize: {
        display: ['clamp(2.6rem, 5.6vw, 4.6rem)', { lineHeight: '0.98', letterSpacing: '-0.04em' }],
        h1: ['clamp(2rem, 3.8vw, 3rem)', { lineHeight: '1.06', letterSpacing: '-0.035em' }],
        h2: ['clamp(1.5rem, 2.4vw, 2.1rem)', { lineHeight: '1.14', letterSpacing: '-0.03em' }],
        h3: ['clamp(1.1rem, 1.4vw, 1.35rem)', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        lede: ['clamp(1rem, 1.15vw, 1.125rem)', { lineHeight: '1.75' }],
        body: ['0.9375rem', { lineHeight: '1.75' }],
        small: ['0.8125rem', { lineHeight: '1.65' }],
        caption: ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.04em' }],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(28,28,28,.05)',
        md: '0 6px 20px rgba(28,28,28,.07)',
        lg: '0 20px 50px rgba(28,28,28,.13)',
      },
      transitionTimingFunction: { 'out-soft': 'cubic-bezier(.22, 1, .36, 1)' },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        float: 'float 5s ease-in-out infinite',
        ticker: 'ticker 40s linear infinite',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        float: { '0%,100%': { transform: 'translateY(0) rotate(0)' }, '50%': { transform: 'translateY(-12px) rotate(2deg)' } },
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%23ffffff' stroke-opacity='.16' stroke-width='.5'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
