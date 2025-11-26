import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente baseadas no modo atual
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Injeta a API KEY de forma segura para o código cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      // Proxy para desenvolvimento local
      proxy: {
        '/files': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/messages': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    // Otimização para build
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
