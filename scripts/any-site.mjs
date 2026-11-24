// End-to-end on many real shops: from a starting page, types "open <shop> i need <product + filters>"
// into the real side panel and records where the tab ended up, whether the search ran, which
// filters were applied and what the panel said. One browser for all of them.
//   npm run build && node scripts/any-site.mjs [name ...]      → scripts/any-site-results.json
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const START = 'https://www.decathlon.in/search?query=running%20shoes'
const RUNS = [
  ['ajio', 'open ajio i need black jeans size 32'], ['nykaa', 'open nykaa i need lipstick under 500'],
  ['blinkit', 'open blinkit i need bread'], ['zepto', 'open zepto i want milk'], ['instamart', 'open instamart i need eggs'],
  ['bigbasket', 'open bigbasket i need rice'], ['meesho', 'open meesho i need cotton kurti under 500'],
  ['tatacliq', 'open tata cliq i need puma shoes size 9'], ['croma', 'open croma i need headphones under 2000'],
  ['reliancedigital', 'open reliance digital i need headphones'], ['snapdeal', 'open snapdeal i need black shoes size 8'],
  ['jiomart', 'open jiomart i need rice'], ['firstcry', 'open firstcry i need baby shoes'], ['lenskart', 'open lenskart i need sunglasses'],
  ['pepperfry', 'open pepperfry i need sofa'], ['ikea', 'open ikea i need chair'], ['bewakoof', 'open bewakoof i need black tshirt size L'],
  ['souledstore', 'open souled store i need tshirt size M'], ['westside', 'open westside i need white shirt size M'],
  ['lifestyle', 'open lifestyle i need black jeans size 32'], ['maxfashion', 'open max fashion i need tshirt'],
  ['shoppersstop', 'open shoppers stop i need watch'], ['urbanic', 'open urbanic i need black dress size S'], ['hm', 'open h&m i need black jeans'],
  ['zara', 'open zara i need black jacket size M'], ['uniqlo', 'open uniqlo i need jacket'], ['puma', 'open puma i need running shoes size 9'],
  ['adidas', 'open adidas i need running shoes size 9'], ['nike', 'open nike i need running shoes size 9'], ['boat', 'open boat i need earbuds'],
  ['vijaysales', 'open vijay sales i need laptop'], ['purplle', 'open purplle i need perfume'], ['vastrado', 'open vastrado i need shirt size L'],
  ['udemy', 'open udemy'], ['allbirds', 'open allbirds.com and show me wool shoes size 10'],
  ['decathlon', 'open decathlon i need running shoes size 8', 'https://www.myntra.com/running-shoes?rawQuery=running%20shoes'],
]
const only = process.argv.slice(2)
const runs = RUNS.filter(([n]) => !only.length || only.includes(n))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-anysite-profile'), args: ['--window-size=1400,900'],
})
const extId = await browser.installExtension(path.resolve('dist'))
const panel = await browser.newPage()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)
await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), { timeout: 0, polling: 500 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
console.log('panel ready')
const results = []

for (const [name, q, start = START] of runs) {
  const t0 = Date.now()
  const shop = await browser.newPage()
  try {
    await shop.goto(start, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(4000)
    // (By site, not exact address: shops rewrite their URLs while loading.)
    const tabId = await panel.evaluate(async (host) => (await chrome.tabs.query({})).find((t) => t.url && new URL(t.url).host === host)?.id, new URL(shop.url()).host)
    if (!tabId) throw new Error(`no tab for ${shop.url()}`)
    console.log(`[${name}] start ${shop.url()} (tab ${tabId})`)
    await panel.evaluate((id) => { const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u) }, tabId)
    // A fresh chat for each shop (memory is per tab anyway).
    await shop.bringToFront(); await panel.bringToFront()
    await panel.click('textarea')
    await panel.keyboard.down('Control'); await panel.keyboard.press('a'); await panel.keyboard.up('Control'); await panel.keyboard.press('Backspace')
    await panel.type('textarea', q)
    await panel.click('#send')
    await shop.bringToFront()
    const FINAL = /Done|⚠️|Could not|💬|didn't respond/
    const read = () => panel.evaluate(() => document.querySelector('#status')?.textContent ?? '')
    for (const end = Date.now() + 3000; Date.now() < end && FINAL.test(await read()); ) await sleep(100)
    let status = ''
    for (const end = Date.now() + 180000; Date.now() < end; await sleep(500)) { status = await read(); if (FINAL.test(status)) break }
    const chips = await panel.$$eval('#latest span.chip', (s) => s.map((x) => x.textContent.trim()))
    await sleep(2500)
    const url = decodeURIComponent((await panel.evaluate(async (id) => (await chrome.tabs.get(id)).url, tabId)) ?? '')
    const r = { name, q, url, status, chips, secs: Math.round((Date.now() - t0) / 1000) }
    results.push(r)
    console.log(`\n[${name}] ${q}\n  → ${status.slice(0, 220)}\n  url: ${url.slice(0, 160)}\n  chips: ${chips.join(' | ') || '-'}   (${r.secs}s)`)
  } catch (e) {
    results.push({ name, q, error: e.message })
    console.log(`\n[${name}] ERROR ${e.message}`)
  }
  await shop.close().catch(() => {})
  fs.writeFileSync('scripts/any-site-results.json', JSON.stringify(results, null, 1))
}
await browser.close()
