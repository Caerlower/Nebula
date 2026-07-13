import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The landing ships as static files served by the Next.js Hub (apps/nebula-hub)
  // under /landing, with a rewrite mapping / to /landing/index.html.
  base: '/landing/',
  build: {
    outDir: '../nebula-hub/public/landing',
    emptyOutDir: true,
  },
})
