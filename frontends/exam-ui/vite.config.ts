// frontends/exam-ui/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
      },
      '/sessions': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/ingest': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/incidents': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket proxy for session-service STOMP notifications
      '/ws': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,  // Enable WebSocket upgrade
      },
    },
  },
});