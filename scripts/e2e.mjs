// End-to-end test on the LIVE sites: opens a separate Chrome with the built extension, opens the
// panel once (like a real user), waits for the AI, then for each test types a request, clicks
// Apply and checks which filters were really applied on the page.
// Usage: node scripts/e2e.mjs [site] [--q="custom request"]
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DIST = path.resolve('dist')
// E2E_PROFILE lets tests run while another test window (same profile) is open.
const PROFILE = process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile')

const JACKETS = { amazon: 'https://www.amazon.in/s?k=jacket+men', flipkart: 'https://www.flipkart.com/search?q=jacket+men', myntra: 'https://www.myntra.com/jackets?rawQuery=jacket%20men' }
// followUp: type into the same, already-filtered page instead of opening a new one.
// expect: the exact chips that should appear. null = "nothing should be applied".
const TESTS = [
  { site: 'Amazon', url: JACKETS.amazon, query: 'black puma jacket size M under 2000', expect: ['Colour: Black', 'Brands: PUMA', "Men's General Size: M", 'Max price: ₹2000'] },
  { site: 'Amazon', url: 'https://www.amazon.in/s?k=running+shoes+men', query: 'nike running shoes size 9', expect: ['Brands: Nike', 'Purpose: Running', "Men's Shoe Size (UK/India): 9"] },
  { site: 'Amazon', url: 'https://www.amazon.in/s?k=mobile+phones', query: 'samsung 5g phone with 8gb ram under 15000', expect: ['Brands: Samsung', 'Cellular Technology: 5G', 'RAM Size: 8 to 9.9 GB', 'Max price: ₹15000'] },
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'black puma jacket under 2000', expect: ['Color: Black', 'Brand: PUMA', 'Max price: ₹2000'] },
  { site: 'Flipkart', followUp: true, query: 'size L', expect: ['Size: L'] },
  // Brand section already has a filter, so Flipkart shows "BrandClear" as its heading.
  { site: 'Flipkart', followUp: true, query: 'adidas too', expect: ['Brand: ADIDAS'] },
  { site: 'Flipkart', url: 'https://www.flipkart.com/search?q=mobile+phones', query: 'oneplus phone with 256gb storage', expect: ['Brand: OnePlus', 'Internal Storage: 256 GB & Above'] },
  { site: 'Flipkart', url: 'https://www.flipkart.com/search?q=running+shoes+men', query: 'sparx shoes size 8', expect: ['Brand: Sparx', 'Size: 8'] },
  { site: 'Myntra', url: JACKETS.myntra, query: 'black roadster jacket 40% off', expect: ['Color: Black', 'Brand: Roadster', 'Discount Range: 40% and above'] },
  { site: 'Myntra', url: 'https://www.myntra.com/men-sports-shoes?rawQuery=men%20sports%20shoes', query: 'skechers shoes size 9', expect: ['Brand: Skechers', 'Size: UK9'] },
  { site: 'Myntra', url: 'https://www.myntra.com/women-kurtas-kurtis-suits?rawQuery=women%20kurtas', query: 'libas cotton kurta size M', expect: ['Brand: Libas', 'Fabrics: Cotton', 'Size: M'] },
  { site: 'Myntra', url: JACKETS.myntra, query: 'show me something nice', expect: null },
]

// Harder cases, run with --extra: price ranges, negation, Myntra top-bar groups, two brands,
// number+unit filters and synonyms, clicked live.
const EXTRA = [
  { site: 'Flipkart', url: 'https://www.flipkart.com/search?q=mobile+phones', query: 'redmi phone between 10000 and 15000', expect: ['Brand: REDMI', 'Min price: ₹10000', 'Max price: ₹15000'] },
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'jacket without hood not puma', expect: ['Hooded: Without Hood'] },
  { site: 'Flipkart', url: 'https://www.flipkart.com/search?q=running+shoes+men', query: 'white shoes 4 star 40% off', expect: ['Color: White', 'Customer Ratings: 4★ & above', 'Discount: 40% or more'] },
  { site: 'Amazon', url: 'https://www.amazon.in/s?k=mobile+phones', query: 'phone with 6000 mah battery and amoled display above 10000', expect: ['Display Type: AMOLED', 'Battery Capacity: 6,000 mAh & Above', 'Min price: ₹10000'] },
  { site: 'Amazon', url: 'https://www.amazon.in/s?k=running+shoes+men', query: 'maroon shoes uk 8', expect: ['Colour: Red', "Men's Shoe Size (UK/India): 8"] },
  { site: 'Myntra', url: 'https://www.myntra.com/women-kurtas-kurtis-suits?rawQuery=women%20kurtas', query: 'pink anarkali kurta 3/4 sleeve', expect: ['Color: Pink', 'Shape: Anarkali', 'Sleeve Length: Three-Quarter Sleeves'] },
  { site: 'Myntra', url: 'https://www.myntra.com/men-sports-shoes?rawQuery=men%20sports%20shoes', query: 'adidas or puma shoes', expect: ['Brand: ADIDAS', 'Brand: Puma'] },
]
// Asking for a different product than the page shows: the extension must search the site for it,
// then apply the filters on the new results. Run with --search.
// search: words the new search must contain. expectSome: chips that must be among those applied
// (the new page's exact filter list isn't known in advance).
const SEARCH = [
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'give me running shoes', search: 'running shoes', expectSome: [] },
  { site: 'Amazon', url: JACKETS.amazon, query: 'nike running shoes size 9 under 3000', search: 'nike running shoes', expectSome: ['Brands: Nike', 'Max price: ₹3000'] },
  { site: 'Myntra', url: JACKETS.myntra, query: 'pink cotton kurta size M', search: 'pink cotton kurta', expectSome: ['Fabrics: Cotton', 'Size: M'], forbid: /^Brand: Pink/ },
  { site: 'Flipkart', url: 'https://www.flipkart.com/search?q=running+shoes+men', query: 'samsung phone with 8gb ram under 15000', search: 'samsung phone 8gb ram', expectSome: ['Max price: ₹15000'] },
  // Added Nov 12 after a user-found bug. to: the site the tab must end up on. exact: the whole search term.
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'can you open amazon i need blue shirt which under 500', to: 'Amazon', search: 'blue shirt', exact: true, expectSome: ['Max price: ₹500'] },
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'mujhe kurta chahiye 1000 ke andar', search: 'kurta', exact: true, expectSome: ['Max price: ₹1000'] },
  { site: 'Myntra', url: JACKETS.myntra, query: 'nike shoes on flipkart', to: 'Flipkart', search: 'nike shoes', exact: true, expectSome: ['Brand: NIKE'] },
  { site: 'Amazon', url: JACKETS.amazon, query: 'show this on myntra', to: 'Myntra', search: 'jacket men', exact: true, expectSome: [] },
  // Second user-found bug: three sites named (stay), typo, a colour the maroon-shirt page lacks, "size is 40".
  { site: 'Myntra', url: 'https://www.myntra.com/merun-shirt?rawQuery=merun%20shirt', query: 'can you compare and give me all amazon and flipkart and myntra fo white shirst which is better i need roadstar size is 40', search: 'white shirt roadstar', exact: true, expectSome: ['Brand: Roadster', 'Size: 40'] },
]
// Multi-message chats on one page (--chat): add, sort, remove, change price, clear all.
// check(url) returns what's wrong with the page's URL after that message, or ''.
const has = (re) => (u) => (re.test(u) ? '' : `URL should match ${re}`)
const hasNot = (re) => (u) => (re.test(u) ? `URL should not match ${re}` : '')
const all = (...fns) => (u) => fns.map((f) => f(u)).filter(Boolean).join('; ')
const MYNTRA_SHOES = 'https://www.myntra.com/men-sports-shoes?rawQuery=men%20sports%20shoes'
const CHAT_TESTS = [
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'black puma jacket', expect: ['Color: Black', 'Brand: PUMA'], check: all(has(/\]=Black/), has(/\]=PUMA/)) },
  { site: 'Flipkart', followUp: true, query: 'sort by price low to high', expect: ['Sort by: Price: Low to High'], check: all(has(/sort=price_asc/), has(/\]=Black/), has(/\]=PUMA/)) },
  { site: 'Flipkart', followUp: true, query: 'remove puma', expect: ['-Brand: PUMA'], check: all(hasNot(/\]=PUMA/), has(/\]=Black/), has(/sort=price_asc/)) },
  { site: 'Flipkart', followUp: true, query: 'now under 1500', expect: ['Max price: ₹1500'], check: all(has(/price_range\.to=1500/), has(/\]=Black/)) },
  { site: 'Flipkart', followUp: true, query: 'clear all filters', expect: ['-*: *'], check: hasNot(/facets\./) },
  { site: 'Amazon', url: JACKETS.amazon, query: 'nike jacket under 2000', expect: ['Brands: Nike', 'Max price: ₹2000'], check: all(has(/p_123:/), has(/p_36:-200000/)) },
  { site: 'Amazon', followUp: true, query: 'cheapest first', expect: ['Sort by: Price: Low to High'], check: all(has(/s=price-asc-rank/), has(/p_123:/), has(/p_36:-200000/)) },
  { site: 'Amazon', followUp: true, query: 'remove nike', expect: ['-Brands: Nike'], check: all(hasNot(/p_123:/), has(/p_36:-200000/)) },
  { site: 'Amazon', followUp: true, query: 'above 1000', expect: ['Min price: ₹1000'], check: has(/p_36:100000-200000/) },
  { site: 'Amazon', followUp: true, query: 'start over', expect: ['-*: *'], check: hasNot(/rh=/) },
  { site: 'Myntra', url: MYNTRA_SHOES, query: 'puma shoes size 9', expect: ['Brand: Puma', 'Size: UK9'], check: all(has(/Brand:Puma/), has(/size_facet:UK9/)) },
  { site: 'Myntra', followUp: true, query: 'newest first', expect: ['Sort by: Newest First'], check: all(has(/sort=new/), has(/Brand:Puma/)) },
  { site: 'Myntra', followUp: true, query: 'remove size', expect: ['-Size: *'], check: all(hasNot(/size_facet/), has(/Brand:Puma/)) },
  { site: 'Myntra', followUp: true, query: 'reset', expect: ['-*: *'], check: hasNot(/[?&]f=/) },
]
// Price comparison across the three sites (--compare). compare: the sites that must end up with a
// matching price (others may be "not compared" when a filter doesn't exist there).
const COMPARE_TESTS = [
  // The user's own request (Nov 12), on the page where they typed it.
  { site: 'Myntra', url: 'https://www.myntra.com/white-shirt-roadstar?rawQuery=white%20shirt%20roadstar', query: 'can you compare black shirt roadstar size is 40 i need that shirt which is lower price compare to all amazon flipkart and myntra', compare: ['Myntra'], search: 'black shirt roadstar' }, // Flipkart shirts only have XS–5XL (no 40); Amazon shows no Roadster,
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'compare nike running shoes size 9 on all 3 sites', compare: ['Flipkart', 'Myntra'], search: 'nike running shoes' },
  { site: 'Amazon', url: JACKETS.amazon, query: 'lowest price for puma jacket across sites', compare: ['Amazon', 'Flipkart', 'Myntra'], search: 'puma jacket' },
  // With a budget: Myntra has no price filter, so its items are checked against the budget instead.
  { site: 'Flipkart', url: JACKETS.flipkart, query: 'compare puma jacket under 2000 on all 3 sites', compare: ['Amazon', 'Flipkart', 'Myntra'], search: 'puma jacket' },
]
if (process.argv.includes('--compare')) TESTS.splice(0, TESTS.length, ...COMPARE_TESTS)
if (process.argv.includes('--chat')) TESTS.splice(0, TESTS.length, ...CHAT_TESTS)
if (process.argv.includes('--extra')) TESTS.splice(0, TESTS.length, ...EXTRA)
if (process.argv.includes('--search')) TESTS.splice(0, TESTS.length, ...SEARCH)

const args = process.argv.slice(2)
const only = args.find((a) => !a.startsWith('--'))?.toLowerCase()
const customQuery = args.find((a) => a.startsWith('--q='))?.slice(4)
const customUrl = args.find((a) => a.startsWith('--url='))?.slice(6) // with --q: one try on this page
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const secs = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)}s`

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: PROFILE,
  defaultViewport: null, protocolTimeout: 0, args: ['--window-size=1400,900'],
})
const extId = await browser.installExtension(DIST)

// Open the panel once, as a normal tab.
const panel = await browser.newPage()
panel.on('console', (m) => { if (/\[ai\]/.test(m.text())) console.log(`  [panel] ${m.text().slice(0, 300)}`) })
panel.on('pageerror', (e) => console.log(`  [panel error] ${e.message}`))
const t0 = Date.now()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html`)
await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), { timeout: 0, polling: 1000 })
console.log(await panel.$eval('#ai-label', (p) => p.textContent), `(${secs(t0)} after opening the panel)`)

// Independent check of the live page: is each expected filter really in the site's URL?
// (The panel's chips come from the extension itself, so they are not enough on their own.)
function missingFromUrl(site, url, all) {
  const u = url.replace(/\+/g, ' ')
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // A sort order is its own URL value on every site (Amazon s=, Flipkart and Myntra sort=).
  const sorts = all.filter((e) => e.startsWith('Sort by: '))
  const expect = all.filter((e) => !e.startsWith('Sort by: '))
  const sortValue = new URL(url).searchParams.get(site === 'Amazon' ? 's' : 'sort')
  if (sorts.length && !sortValue) return [...sorts, ...missingFromUrl(site, url, expect)]
  if (site === 'Amazon') {
    // Amazon's URL holds internal ids (rh=p_123:256097,p_36:-200000), so compare the count.
    const rh = new URL(url).searchParams.get('rh') ?? ''
    const values = rh.split(',').filter(Boolean).flatMap((p) => p.split(':')[1].split('|')).length
    const prices = expect.filter((e) => /^(Min|Max) price/.test(e)).length
    const want = expect.length - (prices === 2 ? 1 : 0) // min+max share one p_36 range
    return values === want ? [] : [`URL has ${values} filters, expected ${want}`]
  }
  return expect.filter((e) => {
    const [group, option] = e.split(/: (.*)/)
    if (site === 'Flipkart' && /price/.test(group)) {
      const v = option.match(/\d+/)?.[0] ?? (group.startsWith('Min') ? 'Min' : 'Max')
      return !u.includes(`price_range.${group.startsWith('Min') ? 'from' : 'to'}=${v}`)
    }
    if (site === 'Flipkart') return !new RegExp(String.raw`\]=${esc(option)}(&|$)`, 'i').test(u)
    if (/discount/i.test(group)) return !u.includes(`Discount Range:${option.match(/\d+/)[0]}.0_`)
    return !new RegExp(String.raw`[:,]${esc(option)}(_[0-9a-f]{6})?(::|,|&|$)`, 'i').test(u)
  })
}

async function waitForStatus(ms = 600000) {
  const end = Date.now() + ms
  let last = ''
  while (Date.now() < end) {
    const s = await panel.evaluate(() => document.querySelector('#status')?.textContent ?? '')
    if (s !== last) console.log(`  ${new Date().toLocaleTimeString()}  ${s}`)
    last = s
    if (/Done|⚠️|Could not|💬/.test(s)) return s // 💬 = the panel answered instead of applying
    await sleep(500)
  }
  return `timeout (last status: ${last})`
}

let shop, passed = 0, ran = 0
const tests = TESTS.filter((t) => !only || t.site.toLowerCase() === only).slice(0, customUrl ? 1 : undefined)
for (const [n, t] of tests.entries()) {
  const query = customQuery ?? t.query
  if (!t.followUp || !shop) {
    shop = await browser.newPage()
    await shop.goto(customUrl ?? t.url, { waitUntil: 'domcontentloaded', timeout: 90000 }) // sites can be slow
    await sleep(4000)
  }
  const tabId = await panel.evaluate(async (u) => (await chrome.tabs.query({})).find((x) => x.url === u)?.id, shop.url())
  // Point the open panel at this tab without reloading it (reloading would unload the AI).
  await panel.evaluate((id) => { const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u) }, tabId)
  await shop.bringToFront() // sites only render (and open "more" lists) in the visible tab
  await sleep(300)
  await panel.bringToFront()
  await panel.click('textarea')
  await panel.keyboard.down('Control'); await panel.keyboard.press('a'); await panel.keyboard.up('Control')
  await panel.keyboard.press('Backspace')
  await panel.type('textarea', query)
  const started = Date.now()
  await panel.click('#send')
  await sleep(300)
  // While the extension works, keep the shop tab visible like a real user would see it.
  await shop.bringToFront()
  const status = await waitForStatus()
  // Chips: "✅ Brand: PUMA" (added), "🗑 Brand: PUMA" (removed → "-Brand: PUMA"), "↕ Sort by: …".
  const chips = await panel.$$eval('#latest span.chip', (s) => s.map((x) => {
    const t = x.textContent.trim()
    const rest = t.replace(/^\S+\s*/, '')
    if (!t.startsWith('🗑')) return rest
    if (rest === 'All filters') return '-*: *'
    return '-' + rest.replace(/: all$/, ': *')
  }))
  // Sorting, removing and Amazon filters reload the page: wait for it before checking or typing again.
  await sleep(2500)
  await shop.waitForFunction(() => document.readyState === 'complete', { timeout: 45000 }).catch(() => {})
  await sleep(2500)
  const url = decodeURIComponent(decodeURIComponent(shop.url()))
  let ok, notInUrl = []
  if (customQuery) ok = /Done/.test(status)
  else if (t.expect === null) ok = /No matching filters/.test(status)
  else if (t.check) {
    const problem = t.check(url)
    if (problem) notInUrl.push(problem)
    ok = /Done/.test(status) && chips.length === t.expect.length && t.expect.every((e) => chips.includes(e)) && !problem
  }
  else if (t.compare) {
    // Every site searched with the clean words; the expected sites have a real price; the tab ends
    // on the winner, and the winner really is the lowest of the counted prices.
    const box = await panel.$eval('#comparison', (e) => e.innerText).catch(() => '')
    console.log('  comparison:\n    ' + box.replace(/\n/g, '\n    '))
    const priceOf = (site) => Number((box.match(new RegExp(`• ${site}: ₹([\\d,]+)`)) ?? [])[1]?.replace(/,/g, '') ?? NaN)
    const counted = ['Amazon', 'Flipkart', 'Myntra'].filter((s) => new RegExp(`• ${s}: ₹[\\d,]+, [^\\n]*(cheapest|more\\))`).test(box))
    const winner = (box.match(/Picked (\w+)/) ?? [])[1]
    const lowest = counted.sort((a, b) => priceOf(a) - priceOf(b))[0]
    const host = new URL(shop.url()).hostname
    if (!/Compared .* for "([^"]+)"/.test(status) || !status.includes(`"${t.search}"`)) notInUrl.push(`search words wrong in status: ${status}`)
    for (const s of t.compare) if (!counted.includes(s)) notInUrl.push(`${s} has no compared price`)
    if (!winner || winner !== lowest) notInUrl.push(`winner ${winner} is not the lowest counted (${lowest})`)
    if (winner && !host.includes(winner.toLowerCase())) notInUrl.push(`tab is on ${host}, not the winner ${winner}`)
    ok = /Done/.test(status) && !notInUrl.length
  }
  else if (t.search) {
    // The site must now show results for the new search, with the requested filters applied.
    const landed = t.to ?? t.site
    const host = new URL(shop.url()).hostname
    const onSite = host.includes(landed.toLowerCase())
    const term = (new URL(shop.url()).searchParams.get(landed === 'Amazon' ? 'k' : landed === 'Flipkart' ? 'q' : 'rawQuery') ?? '').toLowerCase().trim()
    const searchedOk = onSite && (t.exact ? term === t.search : t.search.split(' ').every((w) => term.includes(w)))
    notInUrl = missingFromUrl(landed, url, chips) // every chip shown must really be on the page
    if (!onSite) notInUrl.push(`tab is on ${host}, expected ${landed}`)
    const forbidden = t.forbid ? chips.filter((c) => t.forbid.test(c)) : []
    if (forbidden.length) notInUrl.push(`should not apply: ${forbidden.join(', ')}`)
    ok = /Done/.test(status) && searchedOk && t.expectSome.every((e) => chips.includes(e)) && !notInUrl.length
    if (!searchedOk) notInUrl.push(`search term is "${term}", expected "${t.search}"`)
  }
  else {
    // A follow-up only adds its own filters; all earlier ones on that page must still be in the URL.
    const all = [...t.expect]
    for (let k = n; tests[k]?.followUp && k > 0; k--) all.push(...(tests[k - 1].expect ?? []))
    notInUrl = missingFromUrl(t.site, url, all)
    ok = /Done/.test(status) && chips.length === t.expect.length && t.expect.every((e) => chips.includes(e)) && !notInUrl.length
  }
  ran++; if (ok) passed++
  console.log(`${ok ? 'PASS' : 'FAIL'} [${t.site}${t.followUp ? ' follow-up' : ''}] "${query}" → ${status} in ${secs(started)}`)
  console.log('  chips:', chips.join(' | ') || '(none)')
  if (!ok && t.expect) console.log('  expected:', t.expect.join(' | '))
  if (notInUrl.length) console.log('  NOT on the page:', notInUrl.join(' | '))
  console.log('  url  :', url)
  await shop.screenshot({ path: `scripts/e2e-${n + 1}-${t.site.toLowerCase()}.png` })
}
console.log(`\n${passed}/${ran} live tests passed`)
await browser.close()
