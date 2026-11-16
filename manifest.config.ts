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
  // favicon: the site logos on the panel's buttons, from Chrome's own icon cache.
  permissions: ['sidePanel', 'tabs', 'favicon'],
  host_permissions: SITES,
})
