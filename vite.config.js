import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Configuración de Vite — reemplaza a Create React App (react-scripts).
// Mantiene el puerto 3000, igual que antes.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ✅ NUEVO: registra un Service Worker que cachea los archivos de la
    // app (JS/CSS/HTML) — sin esto, sin señal la app ni siquiera cargaba.
    // A propósito NO se cachean acá las respuestas de Supabase (los datos
    // de las causas) — eso se maneja aparte, a mano, en src/lib/offline.js,
    // para controlar bien qué tan "vieja" puede quedar la información.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'LexOffice — Gestión Penal',
        short_name: 'LexOffice',
        description: 'Gestor de causas penales',
        theme_color: '#1E293B',
        background_color: '#F8F9FC',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
      workbox: {
        // No intenta cachear las llamadas a la API de Supabase — esas se
        // manejan con la caché propia en src/lib/offline.js.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
    }),
  ],
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 3000,
  },
})
