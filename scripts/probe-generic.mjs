// Debug helper: runs the generic adapter directly inside a live page (no extension) to time each
// step and show option markup. node scripts/probe-generic.mjs <url> ["css selector to dump"]
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'
import { build } from 'esbuild'

const out = path.join(os.tmpdir(), 'aisf-generic-probe.js')
await build({ entryPoints: ['src/adapters/generic.ts'], bundle: true, format: 'iife', globalName: 'G', outfile: out, logLevel: 'error' })
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: path.join(os.tmpdir(), 'ai-shopping-filters-probe-profile'),
})
const [url, dump] = process.argv.slice(2)
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 8000))
await page.addScriptTag({ path: out })
const info = await page.evaluate(async (dump) => {
  // How busy the page is on its own: content changes in 3 s of doing nothing.
  let changes = 0
  const mo = new MutationObserver((l) => (changes += l.length))
  mo.observe(document.body, { childList: true, subtree: true })
  await new Promise((r) => setTimeout(r, 3000))
  mo.disconnect()
  console.log('idle changes', changes)
  window.__idleChanges = changes
  const t = performance.now()
  const filters = await G.generic.extractFilters()
  const total = performance.now() - t
  const t2 = performance.now()
  await G.generic.extractFilters()
  const t3 = performance.now()
  const n = document.querySelectorAll('input[type=checkbox],input[type=radio],[role=checkbox],[role=radio]').length
  const products = G.generic.products().slice(0, 6).map((p) => `${p.price} | ${p.title.slice(0, 70)}`)
  return { products, idleChanges: window.__idleChanges, checks: n, total: Math.round(total), second: Math.round(performance.now() - t2), groups: filters.map((g) => `${g.name}: ${g.options.join(' | ')}`),
    // "text:Above" = the labels whose text starts with "Above"
    dump: dump ? [...(dump.startsWith('text:') ? [...document.querySelectorAll('label, [role=checkbox], li')].filter((e) => e.textContent.trim().startsWith(dump.slice(5))) : document.querySelectorAll(dump))].slice(0, 3).map((e) => e.outerHTML.replace(/\s+/g, ' ').slice(0, 6000)) : [] }
}, dump)
console.log(JSON.stringify(info, null, 1))
await browser.close()
