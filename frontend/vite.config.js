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
    // Rutas que se envían al backend (puerto 3000). Las páginas de la app usan
    // otras rutas (/hogar, /aparatos, /consumo...) y las maneja Vue Router.
    proxy: Object.fromEntries([
      '^/api(?:/|$)',
      '^/user(?:/|$)',
      '^/alarm(?:/|$)',
      '^/lecturas(?:/|$)',
      '^/events(?:/|$|\\?)',
    ].map((ruta) => [ruta, { target: 'http://localhost:3000', changeOrigin: true }])),
  },

  resolve: {
    // Evita errores realpath con archivos sincronizados mediante OneDrive.
    preserveSymlinks: true,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})