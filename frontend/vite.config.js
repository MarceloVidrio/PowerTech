import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false, // si 5173 está ocupado (p. ej. por CasaFast) usa el siguiente
    proxy: {
      '^/lecturas(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '^/api(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/user(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/alarm(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/building(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '/report/': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/room(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/sensor(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/device(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/events(?:/|$|\\?)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },

      '^/monitoring/': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },

  resolve: {
    // Evita errores realpath con archivos sincronizados mediante OneDrive.
    preserveSymlinks: true,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})