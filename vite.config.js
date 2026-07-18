import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite — reemplaza a Create React App (react-scripts).
// Mantiene el puerto 3000, igual que antes.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 3000,
  },
})
