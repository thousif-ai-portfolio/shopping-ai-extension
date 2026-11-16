import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  worker: {
    format: 'es', // the AI worker uses code-splitting, which needs ES module output
    // The AI runtime's .wasm (26 MB) ships once, in public/ort (worker.ts points there via wasmPaths);
    // don't also emit the library's own copy, which is only its fallback when wasmPaths is unset.
    plugins: () => [{
      name: 'drop-duplicate-ort-wasm',
      generateBundle(_, bundle) {
        for (const file in bundle) if (/ort-wasm.*\.wasm$/.test(file)) delete bundle[file]
      },
    }],
  },
  // The hidden AI page isn't in the manifest, so list it here to have it built.
  build: { rollupOptions: { input: { offscreen: 'src/offscreen/index.html' } } },
})
