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
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/index.dev.html';
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
