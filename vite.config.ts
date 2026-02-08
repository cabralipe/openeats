import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const previewHosts = (env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1,.onrender.com')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/': 'http://localhost:8000',
          '/public/': 'http://localhost:8000',
        },
      },
      preview: {
        host: '0.0.0.0',
        allowedHosts: previewHosts,
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
