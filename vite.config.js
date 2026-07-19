import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Configuración de Vite — reemplaza a Create React App (react-scripts).
// Mantiene el puerto 3000, igual que antes.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 3000,
  },
})
