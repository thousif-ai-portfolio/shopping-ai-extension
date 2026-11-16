import { defineManifest } from '@crxjs/vite-plugin'

const SITES = [
  'https://www.amazon.in/*',
  'https://www.flipkart.com/*',
  'https://www.myntra.com/*',
]

export default defineManifest({
  manifest_version: 3,
  name: 'AI Shopping Filters',
  version: '0.1.0',
  description: 'Type what you want; on-device AI applies the right filters.',
  action: { default_title: 'Open AI Shopping Filters' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background.ts', type: 'module' },
  content_scripts: [{ matches: SITES, js: ['src/content/index.ts'] }],
  // offscreen: a hidden page keeps the backup AI loaded while Chrome runs (src/offscreen).
  // favicon: the site logos on the panel's buttons, from Chrome's own icon cache.
  permissions: ['sidePanel', 'tabs', 'offscreen', 'favicon'],
  // The backup AI (Transformers.js) runs as WebAssembly, which extensions must allow explicitly.
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  // Cross-origin isolation lets the AI use several CPU threads instead of one.
  // (Valid Chrome manifest keys that the CRXJS types don't list yet.)
  ...({
    cross_origin_embedder_policy: { value: 'require-corp' },
    cross_origin_opener_policy: { value: 'same-origin' },
  } as object),
  host_permissions: SITES,
})
