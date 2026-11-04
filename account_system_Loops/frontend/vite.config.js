import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '../../../components/admin/ImportHistoryView': path.resolve(__dirname, '../../The_Loop.s_POS/frontend/src/components/admin/ImportHistoryView.jsx'),
      '../../../context/PosContext': path.resolve(__dirname, '../../The_Loop.s_POS/frontend/src/context/PosContext.jsx')
    }
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api/finance': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
