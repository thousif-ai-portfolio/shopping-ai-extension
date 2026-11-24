import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Shopping Filters',
  version: '0.1.3',
  description: 'Type what you want on any shopping site; on-device AI applies the right filters.',
  // Drawn from assets/icon.svg.
  icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: { default_title: 'Open AI Shopping Filters', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background.ts', type: 'module' },
  // Every site: Amazon, Flipkart and Myntra have their own adapters, other shops a generic one.
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['src/content/index.ts'] }],
  // favicon: the site logos on the panel's buttons, from Chrome's own icon cache.
  permissions: ['sidePanel', 'tabs', 'favicon'],
  // Any shop: the same sites the content script runs on, so Chrome's warning stays the same.
  host_permissions: ['http://*/*', 'https://*/*'],
})
