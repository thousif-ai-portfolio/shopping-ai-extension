// End-to-end tests for "any site" (the generic adapter), on the local test shops in
// scripts/test-shops/: each shop uses a different way of building filters, with traps. Serves them
// on localhost, installs the built extension, checks what it reads (filters, search text), then types requests into the real side panel and checks the shop's own state.
//   npm run build && node scripts/generic-shops.mjs [shop]
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve('scripts/test-shops')
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found') }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://localhost:${server.address().port}`

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-shops-profile'),
  args: ['--window-size=1300,900'],
})
const extId = await browser.installExtension(path.resolve('dist'))
const panel = await browser.newPage()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)
await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), { timeout: 0, polling: 500 })
console.log('AI:', await panel.$eval('#ai-label', (p) => p.textContent))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0, passes = 0
function check(name, ok, detail = '') {
  if (ok) passes++
  else failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

let shop, tabId
async function open(page) {
  await shop?.close().catch(() => {}) // one shop tab at a time
  shop = await browser.newPage()
  await shop.goto(`${BASE}/${page}`, { waitUntil: 'load' })
  await sleep(1000)
  tabId = await panel.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, shop.url())
  // Point the open panel at this tab (as if the user had it in front).
  await panel.evaluate((id) => { const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u) }, tabId)
}
const send = (msg) => panel.evaluate(async (id, m) => {
  try { return await chrome.tabs.sendMessage(id, m) } catch (e) { return { error: String(e) } }
}, tabId, msg)
const state = () => shop.evaluate(() => JSON.parse(JSON.stringify(window.state ?? null)))
const groupsOf = (filters) => Object.fromEntries(filters.map((g) => [g.name, g.options]))

// Types a message into the panel and waits for its answer. Returns { status, chips }.
async function chat(query) {
  await shop.bringToFront()
  await panel.bringToFront()
  await panel.click('textarea')
  await panel.keyboard.down('Control'); await panel.keyboard.press('a'); await panel.keyboard.up('Control')
  await panel.keyboard.press('Backspace')
  await panel.type('textarea', query)
  const FINAL = /Done|⚠️|Could not|💬/
  const read = () => panel.evaluate(() => document.querySelector('#status')?.textContent ?? '')
  await panel.click('#send')
  await shop.bringToFront()
  // First the new request's working status ("Reading filters…"), then its answer.
  for (const end = Date.now() + 3000; Date.now() < end && FINAL.test(await read()); ) await sleep(100)
  let status = ''
  for (const end = Date.now() + 120000; Date.now() < end; await sleep(300)) {
    status = await read()
    if (FINAL.test(status)) break
  }
  const chips = await panel.$$eval('#latest span.chip', (s) => s.map((x) => x.textContent.trim()))
  await sleep(1500) // reloads and in-place updates settle
  await shop.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {})
  await sleep(1500)
  console.log(`      "${query}" → ${status.slice(0, 140)}${chips.length ? `  [${chips.join(' | ')}]` : ''}`)
  return { status, chips }
}

const only = process.argv[2]
const run = (name) => !only || only === name

// ---------- 1. Checkboxes in fieldsets, sort <select>, $ price boxes
if (run('checkboxes')) {
  console.log('\n=== checkboxes.html')
  await open('checkboxes.html')
  const page = await send({ type: 'GET_FILTERS' })
  const g = groupsOf(page.filters ?? [])
  check('site name from og:site_name', page.site === 'Test Shop', page.site)
  check('Brand without counts', eq(g.Brand, ['Nike', 'Puma', 'ASICS']), JSON.stringify(g.Brand))
  check('Size keeps "UK 9"', eq(g.Size, ['UK 9', 'UK 10', 'UK 11']), JSON.stringify(g.Size))
  check('Colour read through labels of hidden inputs', eq(g.Colour, ['Black', 'Red', 'Blue']), JSON.stringify(g.Colour))
  check('sort mapped from <select>', eq(g['Sort by'], ['Price: Low to High', 'Price: High to Low', 'Newest First', 'Customer Rating', 'Popularity']), JSON.stringify(g['Sort by']))
  check('price boxes in $', eq(g['Min price'], ['$…']) && eq(g['Max price'], ['$…']), JSON.stringify([g['Min price'], g['Max price']]))
  const junk = page.filters.flatMap((x) => [x.name, ...x.options]).filter((t) => /cookie|newsletter|dark mode|agree|subscribe/i.test(t))
  check('no cookie / newsletter / menu / consent checkboxes', !junk.length, JSON.stringify(junk))
  check('no other groups', Object.keys(g).length === 6, JSON.stringify(Object.keys(g)))
  check('search text from the page title when there is no search', page.searchTerm === 'Trail Shoes', page.searchTerm)
  const { products } = await send({ type: 'GET_PRODUCTS' })
  check('products: selling prices, not struck MRP', eq(products.map((p) => p.price), [79.99, 65, 110, 95.5]), JSON.stringify(products.map((p) => p.price)))
  check('products: real titles', eq(products.map((p) => p.title), ['Nike Pegasus Trail', 'Puma Velocity Nitro', 'ASICS Gel Trabuco', 'Nike Wildhorse']), JSON.stringify(products.map((p) => p.title)))

  let r = await chat('nike shoes size uk 10 under $100 cheapest first')
  let s = await state()
  check('brand + size + max price + sort applied', eq(s.brand, ['nike']) && eq(s.size, ['uk10']) && s.max === '100' && s.sort === 'price-asc', JSON.stringify(s))
  check('price chip in $', r.chips.some((c) => c.includes('Max price: $100')), r.chips.join(' | '))
  r = await chat('black or red')
  s = await state()
  check('two colours ticked through hidden inputs', eq(s.colour, ['black', 'red']), JSON.stringify(s))
  r = await chat('remove nike')
  s = await state()
  check('remove one filter', eq(s.brand, []) && eq(s.size, ['uk10']), JSON.stringify(s))
  r = await chat('between $50 and $90')
  s = await state()
  check('price range with $', s.min === '50' && s.max === '90', JSON.stringify(s))
  r = await chat('clear all filters')
  s = await state()
  check('clear all: every box unticked, prices emptied', eq(s.brand, []) && eq(s.size, []) && eq(s.colour, []) && !s.min && !s.max, JSON.stringify(s))
  r = await chat('show me jackets')
  check('new product → site search through its GET form', /checkboxes\.html\?q=jackets/.test(shop.url()), shop.url())
}

// ---------- 2. ARIA controls, accordions, radios with "All", counts without brackets
if (run('aria')) {
  console.log('\n=== aria.html')
  await open('aria.html')
  const page = await send({ type: 'GET_FILTERS' })
  const g = groupsOf(page.filters ?? [])
  check('closed sections opened and read', !!g.Brand && !!g.Fabric && !!g.Gender, JSON.stringify(Object.keys(g)))
  check('bare counts dropped ("Men 143" → "Men")', eq(g.Gender, ['All', 'Men', 'Women']), JSON.stringify(g.Gender))
  check('"Show more" opened, not an option', eq(g.Brand, ['Libas', 'Biba', 'W', 'Aurelia']), JSON.stringify(g.Brand))
  check('size "L" with a count beside it reads as "L"', eq(g.Size, ['S', 'M', 'L', 'XL']), JSON.stringify(g.Size))
  check('sort radios mapped', eq(g['Sort by'], ['Price: Low to High', 'Price: High to Low', 'Newest First', 'Popularity']), JSON.stringify(g['Sort by']))
  check('Tailwind "filter" menu ignored', !JSON.stringify(page.filters).includes('About us'), JSON.stringify(page.filters))
  check('price slider offered as min/max price', !!g['Min price'] && !!g['Max price'], JSON.stringify(Object.keys(g)))
  const { products } = await send({ type: 'GET_PRODUCTS' })
  check('products: ₹ split over spans, text title over picture text', eq(products.map((p) => [p.title, p.price]), [['Libas Women Cotton Kurta', 1299], ['Biba Silk Anarkali', 2499]]), JSON.stringify(products))

  await chat('libas cotton kurta for women')
  let s = await state()
  check('ARIA checkboxes + radio applied', eq(s.Brand, ['Libas']) && eq(s.Fabric, ['Cotton']) && s.Gender === 'Women', JSON.stringify(s))
  await chat('between 1000 and 2000')
  s = await state()
  check('price slider dragged inside the budget', s.price[0] >= 1000 && s.price[0] <= 1100 && s.price[1] <= 2000 && s.price[1] >= 1900, JSON.stringify(s.price))
  await chat('under 300')
  s = await state()
  check('budget below the cheapest price is refused', s.price[1] >= 1900, JSON.stringify(s.price))
  await chat('sort by price low to high')
  s = await state()
  check('sort radio picked', s['Sort by'] === 'Price - Low to High', JSON.stringify(s))
  await chat('aurelia too')
  s = await state()
  check('option behind "Show more" applied', eq(s.Brand, ['Libas', 'Aurelia']), JSON.stringify(s))
  await chat('size is L')
  s = await state()
  check('"size is L" applied', eq(s.Size, ['L']), JSON.stringify(s))
  await chat('remove the gender filter')
  s = await state()
  check('radio taken off through its "All" option', s.Gender === 'All' && eq(s.Brand, ['Libas', 'Aurelia']), JSON.stringify(s))
  await chat('start over')
  s = await state()
  check('clear all on ARIA controls (sort kept)', eq(s.Brand, []) && eq(s.Fabric, []) && eq(s.Size, []) && s.Gender === 'All', JSON.stringify(s))
}

// ---------- 3. Link filters that reload the page each click
if (run('links')) {
  console.log('\n=== links.html')
  await open('links.html')
  const page = await send({ type: 'GET_FILTERS' })
  const g = groupsOf(page.filters ?? [])
  check('link filters read', eq(g.Brand, ['Nike', 'Puma', 'Adidas']) && eq(g.Colour, ['Black', 'Red']), JSON.stringify(g))
  check('sort links mapped', eq(g['Sort by'], ['Price: Low to High', 'Price: High to Low', 'Popularity']), JSON.stringify(g['Sort by']))
  const { products } = await send({ type: 'GET_PRODUCTS' })
  check('€ prices: "89,99 €" and "1.299 €"', eq(products.map((p) => p.price), [89.99, 1299]), JSON.stringify(products))

  await chat('red nike jacket')
  const q = () => new URL(shop.url()).searchParams
  check('two filters across two page reloads', q().getAll('brand').includes('Nike') && q().getAll('colour').includes('Red'), shop.url())
  await chat('lowest price first')
  check('sort link', q().get('sort') === 'Lowest price' && q().getAll('brand').includes('Nike'), shop.url())
  await chat('remove nike')
  check('remove a link filter (and nothing else)', !q().getAll('brand').length && q().getAll('colour').includes('Red'), shop.url())
  await chat('adidas and puma')
  check('two in one group across reloads', eq(q().getAll('brand').sort(), ['Adidas', 'Puma']), shop.url())
  await chat('clear all filters')
  // Each reload takes one filter off; the rest follow on the next pages (up to a few seconds).
  for (let i = 0; i < 40 && (q().getAll('brand').length || q().getAll('colour').length); i++) await sleep(500)
  check('clear all across several reloads', !q().getAll('brand').length && !q().getAll('colour').length, shop.url())
  // Nothing may keep clicking on its own afterwards (no leftover reload loop).
  await sleep(3000)
  const before = shop.url()
  await sleep(6000)
  check('no reload loop afterwards', shop.url() === before, `${before} → ${shop.url()}`)
}

// ---------- 4. Filters in a drawer opened by a button; JavaScript-only search
if (run('drawer')) {
  console.log('\n=== drawer.html')
  await open('drawer.html')
  const page = await send({ type: 'GET_FILTERS' })
  const g = groupsOf(page.filters ?? [])
  check('"Filters" button opened, drawer read', eq(g.Material, ['Cotton', 'Fleece']), JSON.stringify(g))
  check('open cookie banner neither hides the filters nor is read as one', !JSON.stringify(g).match(/Necessary|Analytics/), JSON.stringify(g))
  check('<select> filter without its placeholder', eq(g.Size, ['S', 'M', 'L']), JSON.stringify(g.Size))
  check('sort list behind a button read', eq(g['Sort by'], ['Price: Low to High', 'Price: High to Low', 'Customer Rating', 'Popularity']), JSON.stringify(g['Sort by']))
  check('price range inputs offered as min/max price', !!g['Min price'] && !!g['Max price'], JSON.stringify(Object.keys(g)))
  await chat('under £1000')
  let p = (await state()).price
  check('uneven range slider: max at or just under the budget', p[1] <= 1000 && p[1] >= 900, JSON.stringify(p))
  await chat('above £200')
  p = (await state()).price
  check('uneven range slider: min at or just over the budget', p[0] >= 200 && p[0] <= 300 && p[1] <= 1000, JSON.stringify(p))
  await chat('cheapest first')
  check('sort option inside its row clicked', (await state()).sort === 'Price (low → high)', JSON.stringify(await state()))
  await chat('cotton size L')
  let s = await state()
  check('checkbox + select in a modal applied', eq(s.Material, ['Cotton']) && s.size === 'l', JSON.stringify(s))
  await chat('i want a fleece hoodie size M')
  s = await state()
  check('same product as the title ("Hoodies"): filters, no new search', eq(s.Material, ['Cotton', 'Fleece']) && s.size === 'm' && !shop.url().includes('query='), JSON.stringify(s) + ' ' + shop.url())
  await chat('show me jeans')
  check('JavaScript-only search box used for another product', new URL(shop.url()).searchParams.get('query') === 'jeans', shop.url())
}

// ---------- 4b. Tabbed filter dialog (Westside-like): open "Sort By" tab, keyboard price slider, Apply
if (run('tabs')) {
  console.log('\n=== tabs.html')
  await open('tabs.html')
  const page = await send({ type: 'GET_FILTERS' })
  const g = groupsOf(page.filters ?? [])
  check('sort read from the tab that was already open', eq(g['Sort by'], ['Price: Low to High', 'Price: High to Low', 'Newest First', 'Popularity']), JSON.stringify(g['Sort by']))
  check('colour tab read', eq(g.Colour, ['White', 'Blue', 'Black']), JSON.stringify(g.Colour))
  check('slider in a tab offered as min/max price', !!g['Min price'] && !!g['Max price'], JSON.stringify(Object.keys(g)))
  await chat('white shirt')
  let s = await state()
  check('colour ticked in its tab, then Apply', eq(s.colour, ['White']), JSON.stringify(s))
  await chat('under 2000')
  s = await state()
  check('keyboard slider: max at or just under the budget', s.price[1] <= 2000 && s.price[1] >= 1950 && eq(s.colour, ['White']), JSON.stringify(s))
  await chat('cheapest first')
  s = await state()
  check('sort chosen in its tab, then Apply', s.sort === 'price-asc' && eq(s.colour, ['White']), JSON.stringify(s))
}

// ---------- 5. Not a shop
if (run('blog')) {
  console.log('\n=== blog.html')
  await open('blog.html')
  const page = await send({ type: 'GET_FILTERS' })
  check('no filters on a non-shop page', eq(page.filters, []), JSON.stringify(page.filters))
  const r = await chat('nike under 100')
  check('answers instead of clicking anything', /💬/.test(r.status) && !r.chips.length, r.status)
  const ticked = await shop.evaluate(() => [...document.querySelectorAll('input:checked')].length)
  check('nothing ticked on the page', ticked === 0)
}

// ---------- 6. A page with no content script (browser page)
if (run('nopage')) {
  console.log('\n=== chrome://version (no content script possible)')
  shop = await browser.newPage()
  await shop.goto('chrome://version')
  tabId = await panel.evaluate(async () => (await chrome.tabs.query({})).find((t) => t.url?.startsWith('chrome://version'))?.id)
  await panel.evaluate((id) => { const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u) }, tabId)
  const r = await chat('black shoes')
  check('clear message on a browser page', /Open a shopping site/.test(r.status), r.status)
  // Going somewhere else needs nothing from this page (error pages, blocked sites, browser pages).
  const go = await chat('open decathlon')
  const url = await panel.evaluate(async (id) => (await chrome.tabs.get(id)).url, tabId)
  check('"open decathlon" works from a page the extension cannot read', /decathlon\.in/.test(url) && /Opened www\.decathlon\.in/.test(go.status), `${go.status} | ${url}`)
  // An address that doesn't load: a clear answer, not an error after a long wait.
  const bad = await chat('open no-such-shop-for-testing-qx7.com')
  check('a shop that does not load is reported plainly', /can't read that page/.test(bad.status), bad.status)
}

console.log(`\n${passes}/${passes + failures} checks passed`)
await browser.close()
server.close()
process.exit(failures ? 1 : 0)
