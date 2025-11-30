import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api requests to Spring Boot backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
