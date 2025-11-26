
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Garante que process.env funcione em alguns contextos, mas import.meta.env é preferível
    'process.env': process.env
  }
});
