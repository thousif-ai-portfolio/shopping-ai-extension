import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  worker: { format: 'es' }, // the AI worker uses code-splitting, which needs ES module output
  // The hidden AI page isn't in the manifest, so list it here to have it built.
  build: { rollupOptions: { input: { offscreen: 'src/offscreen/index.html' } } },
})
