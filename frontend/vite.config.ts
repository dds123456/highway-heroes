import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: false,
  },
  build: {
    rollupOptions: { input: { main: 'index.html', offline: 'offline.html' } },
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
