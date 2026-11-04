import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api/stock': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/finance': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
});

