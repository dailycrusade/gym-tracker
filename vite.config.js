import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // HMR page reloads drop the Bluetooth connection mid-session.
    // Re-enable with VITE_HMR=1 if you need live reload while developing.
    hmr: !!process.env.VITE_HMR,
  },
})