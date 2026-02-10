import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const proxyTarget = env.VITE_PROXY_TARGET?.trim();
    const proxy = proxyTarget
      ? {
          '/api/': {
            target: proxyTarget,
            changeOrigin: true,
          },
          '/public/': {
            target: proxyTarget,
            changeOrigin: true,
          },
        }
      : undefined;
    const previewHosts = (env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1,.onrender.com')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy,
      },
      preview: {
        host: '0.0.0.0',
        allowedHosts: previewHosts,
        proxy,
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
