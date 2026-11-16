// Runs every sentence in cases.mjs through the real AI step (same code the panel uses)
// against the saved filter lists, and reports pass/fail.
// Usage: node scripts/edge.mjs [label]     → writes scripts/edge-results-<label>.json
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { CASES as EDGE } from './cases.mjs'
import { CHAT } from './chat-cases.mjs'

// node scripts/edge.mjs [label] [--chat-only]
const CASES = process.argv.includes('--chat-only') ? CHAT : [...EDGE, ...CHAT.map((c) => ({ ...c, cat: `chat:${c.cat}` }))]

const label = process.argv[2] ?? 'run'
// Every saved filter list, by name: amazon, flipkart-phones, myntra-shoes, ...
const fixtures = Object.fromEntries(
  fs.readdirSync('scripts/fixtures').map((f) => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(`scripts/fixtures/${f}`, 'utf8'))]),
)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
})
const extId = await browser.installExtension(path.resolve('dist'))
const panel = await browser.newPage()
await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html?test`)
await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), {
  timeout: 0, polling: 1000,
})

const results = []
for (const c of CASES) {
  const t0 = Date.now()
  let got, error
  try {
    got = await panel.evaluate(
      async (q, groups) => (await window.__chooseFilters(q, groups)).map((x) => `${x.remove ? '-' : ''}${x.group}: ${x.option}`),
      c.q, fixtures[c.site],
    )
  } catch (e) {
    error = e.message
    got = []
  }
  const missing = c.expect.filter((e) => !got.includes(e))
  const extra = got.filter((g) => !c.expect.includes(g))
  const pass = !error && !missing.length && !extra.length
  results.push({ ...c, got, missing, extra, pass, error, ms: Date.now() - t0 })
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${c.site}] "${c.q}"` +
    (pass ? '' : `\n      missing: ${missing.join(', ') || '-'}   extra: ${extra.join(', ') || '-'}${error ? `   error: ${error}` : ''}`))
}
await browser.close()

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
const byCat = {}
for (const r of results) (byCat[r.cat] ??= [0, 0])[r.pass ? 0 : 1]++
console.log(Object.entries(byCat).map(([k, [p, f]]) => `${k} ${p}/${p + f}`).join(' · '))
fs.writeFileSync(`scripts/edge-results-${label}.json`, JSON.stringify(results, null, 1))
