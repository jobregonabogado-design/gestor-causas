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
        // ✅ FIX (encontrado con Joaquín probando desde el celular varias
        // veces): gmail-callback.html y ms-callback.html quedaban CACHEADOS
        // por el Service Worker (precacheAndRoute los incluye igual que
        // cualquier otro .html) — así que un celular con un Service Worker
        // viejo activo seguía sirviendo la versión VIEJA de esa página para
        // siempre, sin importar cuántas correcciones nuevas se desplegaran
        // ahí. skipWaiting/clientsClaim (más abajo) ayudan a que el Service
        // Worker se actualice más rápido, pero mientras tanto seguía
        // fallando en el celular. Estas dos páginas son la vuelta desde el
        // login de Google/Microsoft — TIENEN que cargar siempre la versión
        // real desde el servidor, nunca una copia guardada.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/gmail-callback\.html$/, /^\/ms-callback\.html$/],
        globIgnores: ['gmail-callback.html', 'ms-callback.html'],
        // ✅ FIX: sin esto, un Service Worker nuevo (con una corrección recién
        // desplegada) queda "esperando" y la pestaña sigue usando el viejo
        // hasta que se cierren TODAS las pestañas del sitio — cerrar sesión
        // adentro de la app no cuenta. Pasó de verdad: varias correcciones
        // (Fiscalía, Gmail) parecían no aplicarse aunque el deploy ya estaba
        // hecho. skipWaiting + clientsClaim hacen que el nuevo Service Worker
        // tome el control apenas se detecta, sin esperar a cerrar pestañas.
        skipWaiting: true,
        clientsClaim: true,
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
