import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nuwaxApiKey = env.NUWAX_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        // 女娲平台 API 代理：本地开发走 /nuwax-api 前缀，绕过浏览器跨域限制
        '/nuwax-api': {
          target: 'https://agent.nuwax.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/nuwax-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (request) => {
              if (nuwaxApiKey) request.setHeader('Authorization', `Bearer ${nuwaxApiKey}`);
            });
          },
        },
        // 农业农村部官网代理：抓取「部要闻」列表用于真实新闻展示
        '/moa-news': {
          target: 'https://www.moa.gov.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/moa-news/, ''),
        },
      },
    },
  };
});
