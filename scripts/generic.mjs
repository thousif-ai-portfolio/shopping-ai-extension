// Checks the generic adapter (any site that is not Amazon, Flipkart or Myntra) on real shops:
// what filters, sort and price boxes it finds (and how fast), then ticks one filter.
// Usage: npm run build && node scripts/generic.mjs [url ...]
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'

const URLS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'https://www.decathlon.in/search?query=running%20shoes',
  'https://www.allbirds.com/collections/mens',
  'https://www.ajio.com/search/?text=jacket',
]

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
})
const extId = await browser.installExtension(path.resolve('dist'))
const panel = await browser.newPage()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)

// Sends a message to the content script in the tab whose URL starts like `url`.
// (Retried for 10 s like the panel does: slow pages load the extension late.)
const send = (url, msg) =>
  panel.evaluate(async (u, m) => {
    let last
    for (let i = 0; i < 10; i++) {
      const tab = (await chrome.tabs.query({})).find((t) => t.url?.startsWith(u.slice(0, 30)))
      if (!tab) return { error: 'tab not found' }
      try { return await chrome.tabs.sendMessage(tab.id, m) } catch (e) { last = String(e) }
      await new Promise((r) => setTimeout(r, 1000))
    }
    return { error: last }
  }, url, msg)

for (const url of URLS) {
  console.log(`\n=== ${url}`)
  const shop = await browser.newPage()
  try {
    await shop.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  } catch (e) { console.log('  load failed:', e.message); continue }
  await new Promise((r) => setTimeout(r, 6000))
  await shop.bringToFront()
  const t0 = Date.now()
  const page = await send(url, { type: 'GET_FILTERS' })
  const took = Date.now() - t0
  if (page.error) {
    console.log('  error:', page.error, '| now at', shop.url(), '|', await shop.title().catch(() => '?'))
    continue
  }
  console.log(`  site: ${page.site}   search: "${page.searchTerm}"   (filters read in ${took} ms)`)
  for (const g of page.filters) console.log(`  [${g.name}] ${g.options.slice(0, 8).join(' | ')}${g.options.length > 8 ? ` … (${g.options.length})` : ''}`)

  // Tick the second option of the first real filter group, and see whether the page changed.
  const g = page.filters.find((g) => !/sort|price/i.test(g.name) && g.options.length > 1)
  if (g) {
    const before = await shop.evaluate(() => location.href + document.body.innerText.length)
    const res = await send(url, { type: 'APPLY_FILTERS', choices: [{ group: g.name, option: g.options[1] }] })
    await new Promise((r) => setTimeout(r, 5000))
    const after = await shop.evaluate(() => location.href + document.body.innerText.length).catch(() => 'reloaded')
    console.log(`  apply ${g.name}: ${g.options[1]} → missing ${JSON.stringify(res?.missing)}, page ${before === after ? 'UNCHANGED' : 'changed'}`)
  }
}
await browser.close()
