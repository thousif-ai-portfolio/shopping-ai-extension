// For each shop: reads all its filter groups (the generic reader, in the live page), then picks up to
// 3 options from groups that are NOT the common ones (price, brand, colour, size, rating, discount,
// sort, stock, material) and writes "<shop>|<url>|show only <option>" lines, so e2e.mjs can ask
// for them in plain words. Proves shop-specific filters ("Fit: Slim", "Firmness: Firm") work too.
//   node scripts/extra-filters.mjs "<name>|<url>" ... > list.txt
import puppeteer from 'puppeteer-core'
import { build } from 'esbuild'
import os from 'node:os'
import path from 'node:path'

const out = path.join(os.tmpdir(), 'aisf-extra-generic.js')
await build({ stdin: { contents: `export { generic } from './src/adapters/generic'`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'iife', globalName: 'G', outfile: out, logLevel: 'error' })
const COMMON = /price|brand|colou?r|size|rating|review|discount|sort|stock|availab|material|fabric|gender|categor|department|shop for/i
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true, defaultViewport: null,
  userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'aisf-extra-profile'), args: ['--window-size=1400,900'],
})
for (const arg of process.argv.slice(2)) {
  const [name, url] = [arg.slice(0, arg.indexOf('|')), arg.slice(arg.indexOf('|') + 1)]
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 8000))
    await page.addScriptTag({ path: out })
    const groups = await page.evaluate(async () => await G.generic.extractFilters())
    // Shop-specific groups with real words as options (not numbers or counts), at most 3, from different groups.
    const picks = groups.filter((g) => !COMMON.test(g.name) && g.options.length >= 2)
      .map((g) => ({ g: g.name, o: g.options.find((o) => /^[a-z][a-z &'-]{2,24}$/i.test(o) && !/^(yes|no|all|none|other|others)$/i.test(o)) }))
      .filter((p) => p.o).slice(0, 3)
    for (const p of picks) console.log(`${name}|${url}|show only ${p.o.toLowerCase()}|${p.g}: ${p.o}`)
    if (!picks.length) console.error(`${name}: no shop-specific filter groups (${groups.map((g) => g.name).join(', ')})`)
  } catch (e) {
    console.error(`${name}: ${e.message}`)
  }
  await page.close().catch(() => {})
}
await browser.close()
