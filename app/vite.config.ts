import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Dev only: a browser pane that is open but not on screen paints no animation
// frames, so every motion stays frozen at its first frame. With ?raf-shim in the URL,
// timers drive requestAnimationFrame instead. It runs before any module, because
// motion captures requestAnimationFrame when it loads. Never part of a build.
const rafShim = (): Plugin => ({
  name: 'raf-shim',
  apply: 'serve',
  transformIndexHtml: () => [
    {
      tag: 'script',
      injectTo: 'head-prepend',
      children:
        "if (location.search.includes('raf-shim')) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)",
    },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), rafShim()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Listen on the LAN too, so a phone on the same Wi-Fi can open the dev app.
    host: true,
    port: 5173,
    strictPort: true,
  },
})
