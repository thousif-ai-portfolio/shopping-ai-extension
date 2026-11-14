// Saves the real filter lists from each site and category (exactly what the adapters read)
// into scripts/fixtures/<name>.json, so edge-case tests run against real data.
// Usage: node scripts/snapshot.mjs [name ...]     (no names = all pages below)
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

export const PAGES = {
  amazon: 'https://www.amazon.in/s?k=jacket+men',
  flipkart: 'https://www.flipkart.com/search?q=jacket+men',
  myntra: 'https://www.myntra.com/jackets?rawQuery=jacket%20men',
  'amazon-shoes': 'https://www.amazon.in/s?k=running+shoes+men',
  'flipkart-shoes': 'https://www.flipkart.com/search?q=running+shoes+men',
  'myntra-shoes': 'https://www.myntra.com/men-sports-shoes?rawQuery=men%20sports%20shoes',
  'amazon-phones': 'https://www.amazon.in/s?k=mobile+phones',
  'flipkart-phones': 'https://www.flipkart.com/search?q=mobile+phones',
  'myntra-kurtas': 'https://www.myntra.com/women-kurtas-kurtis-suits?rawQuery=women%20kurtas',
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES)
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
    userDataDir: path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
  })
  const extId = await browser.installExtension(path.resolve('dist'))
  const panel = await browser.newPage()
  await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)
  fs.mkdirSync('scripts/fixtures', { recursive: true })

  for (const name of names) {
    const url = PAGES[name]
    const shop = await browser.newPage()
    await shop.goto(url, { waitUntil: 'domcontentloaded' })
    await new Promise((r) => setTimeout(r, 5000))
    await shop.bringToFront() // opening "more" lists needs a visible, rendering tab
    const filters = await panel.evaluate(async (u) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url?.startsWith(u.slice(0, 40)))
      return (await chrome.tabs.sendMessage(tab.id, { type: 'GET_FILTERS' })).filters
    }, url)
    fs.writeFileSync(`scripts/fixtures/${name}.json`, JSON.stringify(filters, null, 1))
    console.log(`${name}: ${filters.length} groups, ${filters.reduce((n, g) => n + g.options.length, 0)} options`)
    await shop.close()
  }
  await browser.close()
}
