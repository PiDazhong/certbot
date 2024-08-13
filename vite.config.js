import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command }) => {
  const isDevelopment = command === 'serve';

  return {
    mode: isDevelopment ? 'development' : 'production',
    server: {
      open: true,
      proxy: {
        '/mysql': {
          target: 'http://localhost:7005',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        pages: path.resolve(__dirname, 'src/pages'),
        utils: path.resolve(__dirname, 'src/utils'),
      },
    },
    plugins: [react()],
    build: {
      outDir: 'certbot',
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        isDevelopment ? 'development' : 'production',
      ),
      'process.env.PUBLIC_PATH': JSON.stringify(
        isDevelopment ? '/public/' : '/',
      ),
    },
  };
});
