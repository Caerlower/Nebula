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
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // One clear HMR channel — avoids stale servers when localhost resolves to ::1.
    hmr: {
      host: '127.0.0.1',
      port: 5173,
      protocol: 'ws',
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**', '../nebula-hub/public/landing/**'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
