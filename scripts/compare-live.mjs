// Live price comparisons across any shops, through the real side panel: from a starting page, types
// a comparison and prints the panel's answer (which shops, cheapest item on each, the pick).
//   npm run build && node scripts/compare-live.mjs            the cases below
//   node scripts/compare-live.mjs "<start url>" "<message>"   one comparison
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'

const CASES = process.argv[3] ? [[process.argv[2], process.argv[3]]] : [
  ['https://www.amazon.in/s?k=puma+jacket', 'compare puma jacket on ajio and snapdeal'],
  ['https://www.croma.com/searchB?q=headphones%3Arelevance&text=headphones', 'compare headphones under 2000 everywhere'],
  ['https://www.decathlon.in/search?query=running%20shoes', 'compare running shoes on all sites'],
  ['https://www.westside.com/search?q=shirt', 'compare white shirt on myntra and ajio'],
  ['https://www.purplle.com/search?q=perfume', 'which is cheaper for perfume, nykaa or purplle?'],
  ['https://www.flipkart.com/search?q=earbuds', 'boat earbuds sabse sasta kahan milega amazon ya flipkart'],
  ['https://www.ajio.com/search/?text=jacket%20men', 'compare black puma jacket on other sites'],
]

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-compare-profile'), args: ['--window-size=1400,900'],
})
const extId = await browser.installExtension(path.resolve('dist'))
const panel = await browser.newPage()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)
await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), { timeout: 0, polling: 500 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const [start, q] of CASES) {
  const t0 = Date.now()
  const shop = await browser.newPage()
  await shop.goto(start, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await sleep(5000)
  const tabId = await panel.evaluate(async (host) => (await chrome.tabs.query({})).find((t) => t.url && new URL(t.url).host === host)?.id, new URL(shop.url()).host)
  await panel.evaluate((id) => { const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u) }, tabId)
  await shop.bringToFront(); await panel.bringToFront()
  await panel.click('textarea')
  await panel.keyboard.down('Control'); await panel.keyboard.press('a'); await panel.keyboard.up('Control'); await panel.keyboard.press('Backspace')
  await panel.type('textarea', q)
  await panel.click('#send')
  await shop.bringToFront()
  const read = () => panel.evaluate(() => document.querySelector('#status')?.textContent ?? '')
  for (const end = Date.now() + 3000; Date.now() < end && /Done|⚠️|💬/.test(await read()); ) await sleep(100)
  let status = '', last = ''
  for (const end = Date.now() + 20 * 60000; Date.now() < end; await sleep(1000)) {
    status = await read()
    if (status !== last && /Comparing \(\d+\/\d+\) [^:]+: searching/.test(status)) console.log(`   … ${status.slice(0, 90)}`)
    last = status
    if (/Done|⚠️|💬/.test(status)) break
  }
  const answer = await panel.evaluate(() => document.querySelector('#latest')?.innerText ?? '')
  console.log(`\n=== "${q}" (from ${new URL(start).host}, ${Math.round((Date.now() - t0) / 1000)} s)\n${status}\n${answer}`)
  await shop.close().catch(() => {})
}
await browser.close()
