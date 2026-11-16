// Tests for comparing across sites: which messages start a comparison (wantsCompare) and how the
// winner and the explanation are worked out (summarize). Fast, no browser.
//   node scripts/compare-test.mjs
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const out = path.join(os.tmpdir(), 'ai-shopping-filters-compare.mjs')
await build({
  stdin: { contents: `export { wantsCompare, searchWords } from './src/ai/product'; export { summarize } from './src/ai/compare'`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
})
const { wantsCompare, searchWords, summarize } = await import(pathToFileURL(out).href + `?${Date.now()}`)

let passed = 0, total = 0
const check = (name, ok, detail = '') => {
  total++; if (ok) passed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   ${detail}`}`)
}

// ===== Which messages compare across sites
const COMPARE = [
  ['can you compare black shirt roadstar size is 40 i need that shirt which is lower price compare to all amazon flipkart and myntra', true],
  ['can you compare and give me all amazon and flipkart and myntra fo white shirst which is better i need roadstar size is 40', true],
  ['compare prices on all 3 sites', true],
  ['cheapest on all three websites', true],
  ['lowest price across sites', true],
  ['flipkart vs amazon for nike shoes', true],
  ['teeno sites pe sasta dikhao', true],
  ['check every site for puma jacket', true],
  ['compare iphone and samsung', false], // products, not sites
  ['open amazon', false], // one site: a switch, not a comparison
  ['black puma jacket under 2000', false],
  ['is amazon better', false],
  ['which is cheapest', false],
  ['puma vs adidas', false],
]
for (const [q, want] of COMPARE) check(`wantsCompare ${JSON.stringify(q)} = ${want}`, wantsCompare(q) === want, `got ${!want}`)

// ===== What is searched on every site
const WORDS = [
  ['can you compare black shirt roadstar size is 40 i need that shirt which is lower price compare to all amazon flipkart and myntra', 'black shirt roadstar'],
  ['compare nike running shoes size 9 on all 3 sites', 'nike running shoes'],
  ['flipkart vs amazon for samsung phone 8gb ram under 15000', 'samsung phone 8gb ram'],
]
for (const [q, want] of WORDS) check(`searchWords ${JSON.stringify(q.slice(0, 50))} = "${want}"`, searchWords(q) === want, `got "${searchWords(q)}"`)

// ===== Winner and explanation
const p = (price, title = 'Roadster Shirt') => ({ title, price, url: `https://x/${price}` })
const brand = { group: 'Brand', option: 'Roadster' }, size = { group: 'Size', option: '40' }, sort = { group: 'Sort by', option: 'Price: Low to High' }
const r = (site, applied, products, error) => ({ site, applied, url: `https://${site}`, products, ...(error && { error }) })

let s = summarize([r('Amazon', [brand, size, sort], [p(599), p(649)]), r('Flipkart', [{ group: 'Brand', option: 'ROADSTER' }, size, sort], [p(549)]), r('Myntra', [brand, size, sort], [p(499), p(519)])])
check('cheapest site wins', s.winner?.site === 'Myntra', s.text)
check('explains the difference to each other site', /₹50 less than Flipkart/.test(s.text) && /₹100 less than Amazon/.test(s.text), s.text)
check('marks the winner and the extra cost', /Myntra: ₹499.*cheapest/.test(s.text) && /Amazon: ₹599.*₹100 more/.test(s.text), s.text)

s = summarize([r('Amazon', [size, sort], [p(236, 'Youth First Shirt')]), r('Flipkart', [brand, size, sort], [p(378)]), r('Myntra', [brand, size, sort], [p(319)])])
check('a site without the brand filter is not counted, even if cheaper', s.winner?.site === 'Myntra' && /Amazon: ₹236.*Not compared: its brand filter/.test(s.text), s.text)

s = summarize([r('Amazon', [brand, sort], [p(700)]), r('Flipkart', [], [], 'page did not load'), r('Myntra', [brand, sort], [])])
check('errors and empty sites are reported, the rest still compared', s.winner?.site === 'Amazon' && /Flipkart: couldn't check/.test(s.text) && /Myntra: no matching products/.test(s.text) && /only site/.test(s.text), s.text)

s = summarize([r('Amazon', [], [], 'x'), r('Flipkart', [], [], 'y'), r('Myntra', [brand], [])])
check('nothing to pick: says so, no winner', !s.winner && /nothing was picked/.test(s.text), s.text)

s = summarize([r('Amazon', [sort], [p(900), p(300), p(500)]), r('Flipkart', [sort], [p(450)]), r('Myntra', [sort], [p(450)])])
check('takes the lowest of the first results, even if out of order', s.winner?.site === 'Amazon' && s.winner.cheapest.price === 300, s.text)

s = summarize([r('Amazon', [sort], [p(1299)]), r('Flipkart', [sort], [p(1299)]), r('Myntra', [sort], [p(1500)])])
check('a tie picks one and says ₹0 less, not a wrong amount', !!s.winner && /₹0 less/.test(s.text), s.text)

// ===== From the first live run (Nov 12): what the sites really returned
const color = { group: 'Color', option: 'Black' }
s = summarize([
  r('Amazon', [{ group: 'Colour', option: 'Black' }, sort], [p(236, 'Youth First Men’s Cotton Casual Shirt'), p(263, 'NexaFlair Casual Shirt')]),
  r('Flipkart', [{ group: 'Brand', option: 'Roadster' }, color, sort], [p(276, 'Roadster Women Regular Fit Printed Curved Collar Casual Shirt')]),
  r('Myntra', [brand, size, sort], [p(333, 'Roadster Casual Shirt')]),
], 'black shirt roadstar')
check('colour in the search words counts as applied (Myntra not excluded for colour)', !s.rows[2].lacking.includes('colour'), s.text)
check('a site whose titles show no Roadster is not counted (Amazon)', !s.rows[0].counted, s.text)
check('Flipkart lacks size 40 (its shirts only have XS–5XL): not counted, says why', !s.rows[1].counted && /Flipkart: .*size filter/.test(s.text), s.text)
check('the black Roadster shirt with size 40 wins', s.winner?.site === 'Myntra', s.text)

s = summarize([
  r('Amazon', [{ group: 'Brands', option: 'Nike' }, { group: "Men's Shoe Size (UK/India)", option: '9' }, sort], [p(2495, 'Nike Men Sliders'), p(2995, 'Nike Men Revolution 7 Running Shoes')]),
  r('Flipkart', [{ group: 'Brand', option: 'NIKE' }, { group: 'Size', option: '9' }, sort], [p(2420, 'NIKE W FLEX EXPERIENCE RN 11 NN Running Shoes For Women')]),
  r('Myntra', [{ group: 'Size', option: 'UK9' }, sort], [p(2597, 'Nike Run Defy Men Running Shoes'), p(1999, 'Campus Men Running Shoes')]),
], 'nike running shoes')
check('sliders are not running shoes: Amazon compares its cheapest running shoe instead', s.rows[0].cheapest?.price === 2995, s.text)
check('no brand filter on Myntra: the Nike-titled shoe counts, not the cheaper Campus one', s.rows[2].counted && s.rows[2].cheapest?.price === 2597, s.text)
check('cheapest real match wins', s.winner?.site === 'Flipkart', s.text)

s = summarize([
  r('Amazon', [{ group: 'Brands', option: 'Nike' }, { group: "Men's Shoe Size (UK/India)", option: '9' }, sort], [p(5125, 'NikeWomens WMNS Court Legacy Sneakers'), p(5995, 'Nike Men Revolution 7 Road Running Shoes')]),
  r('Flipkart', [{ group: 'Brand', option: 'NIKE' }, { group: 'Size', option: '9' }, sort], [p(2420, 'NIKE W FLEX EXPERIENCE RN 11 NN Running Shoes For Women')]),
  r('Myntra', [{ group: 'Brand', option: 'Nike' }, { group: 'Size', option: 'UK9' }, sort], [p(2597, 'Nike Run Defy Men Running Shoes')]),
], 'nike running shoes')
check('"running shoes": court sneakers are skipped, the running shoe is compared', s.rows[0].cheapest?.price === 5995, s.text)
s = summarize([r('Amazon', [sort], [p(500, 'Formal Shirt')]), r('Flipkart', [sort], [p(400, 'Casual Shirt')]), r('Myntra', [sort], [])], 'casual shirt')
check('"casual shirt": a formal shirt does not count', s.winner?.site === 'Flipkart' && !s.rows[0].counted, s.text)
s = summarize([r('Amazon', [sort], [p(999, 'Ray-Ban Men Sunglasses')]), r('Flipkart', [sort], [p(799, 'Fastrack Sunglasses')]), r('Myntra', [sort], [])], 'sunglasses')
check('"sunglasses": plural "-sses" titles still count', s.winner?.site === 'Flipkart' && s.rows[0].counted, s.text)

// ===== Found in the panel screenshot (Nov 12): a budget must not exclude sites without a price filter
const max2000 = { group: 'Max price', option: '₹2000' }
s = summarize([
  r('Amazon', [{ group: 'Brands', option: 'PUMA' }, max2000, sort], [p(999, "PUMA Essentials Men's Track Jacket")]),
  r('Flipkart', [{ group: 'Brand', option: 'PUMA' }, sort], [p(1122, 'PUMA Men Solid Casual Jacket'), p(2600, 'PUMA Puffer Jacket')]),
  r('Myntra', [{ group: 'Brand', option: 'Puma' }, sort], [p(2263, 'Puma Train All Day Jacket'), p(1263, 'Puma Sweat Jacket')]),
], 'puma jacket')
check('no price filter on Myntra/Flipkart: their items are checked against ₹2000 instead', s.rows.every((x) => x.counted), s.text)
check('items over the budget are skipped (Myntra ₹2,263)', s.rows[2].cheapest?.price === 1263, s.text)
s = summarize([r('Amazon', [max2000, sort], [p(2500, 'Jacket')]), r('Flipkart', [sort], [p(1800, 'Jacket')]), r('Myntra', [sort], [p(2100, 'Jacket')])], 'jacket')
check('only items within budget can win', s.winner?.site === 'Flipkart' && /Amazon: no matching products/.test(s.text), s.text)

// ===== Blind batch: written by a reviewer who never saw the code
const { COMPARE_BLIND } = await import('./compare-blind-cases.mjs')
for (const c of COMPARE_BLIND) {
  const got = wantsCompare(c.q)
  const words = got ? searchWords(c.q) : null
  check(`blind ${JSON.stringify(c.q.slice(0, 60))}`, got === c.compare && (!c.compare || words === c.search), `got compare ${got}, search ${JSON.stringify(words)}; want ${c.compare}, ${JSON.stringify(c.search)}`)
}

console.log(`\n${passed}/${total} passed`)
process.exit(passed === total ? 0 : 1)
