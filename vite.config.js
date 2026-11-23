import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// base './' so the build works from any folder or subpath.
// `--mode inline` bundles the models into the JS for hosts that can't serve .glb.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  publicDir: mode === 'inline' ? false : 'public',
  resolve: {
    alias: {
      '@model-source': fileURLToPath(new URL(`./src/scene/sources/${mode === 'inline' ? 'inline' : 'url'}.ts`, import.meta.url)),
    },
  },
}))
