import { defineManifest } from '@crxjs/vite-plugin'

const SITES = [
  'https://www.amazon.in/*',
  'https://www.flipkart.com/*',
  'https://www.myntra.com/*',
]

export default defineManifest({
  manifest_version: 3,
  name: 'AI Shopping Filters',
  version: '0.1.2',
  description: 'Type what you want; on-device AI applies the right filters.',
  // Drawn from assets/icon.svg.
  icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: { default_title: 'Open AI Shopping Filters', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background.ts', type: 'module' },
  // Every site: Amazon, Flipkart and Myntra have their own adapters, other shops a generic one.
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['src/content/index.ts'] }],
  // favicon: the site logos on the panel's buttons, from Chrome's own icon cache.
  permissions: ['sidePanel', 'tabs', 'favicon'],
  host_permissions: SITES,
})
