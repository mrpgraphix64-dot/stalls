import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-html-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split('?')[0] : '';
          if (
            url === '/' ||
            url === '/index.html' ||
            url === '/manage' ||
            url.startsWith('/manage/') ||
            url.startsWith('/build') ||
            (!url.includes('.') && !url.startsWith('/@') && !url.startsWith('/src') && !url.startsWith('/assets') && !url.startsWith('/images'))
          ) {
            if (!url.startsWith('/manage/api')) {
              req.url = '/index.dev.html';
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/manage/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/send-enquiry.php': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin.php': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.dev.html')
    }
  }
});
