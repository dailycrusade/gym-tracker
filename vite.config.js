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
    // Vite dev server already rewrites unknown paths to index.html,
    // so React Router's BrowserRouter works without extra config.
  },
  // For production: the serve script uses `npx serve -s` which serves
  // index.html as the fallback for all paths (SPA mode).
})