import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Everything the app needs is bundled: `dependencies` is empty on purpose, so
// the packaged app carries no node_modules of its own.
export default defineConfig({
  main: {
    resolve: { alias: { '@core': resolve('src/core') } },
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias: { '@core': resolve('src/core') } },
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } },
    plugins: [react()]
  }
})
