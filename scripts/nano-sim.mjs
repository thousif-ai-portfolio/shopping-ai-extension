// Simulates Chrome's Gemini Nano (which can't run on the dev laptop) to test that code path:
//  a) a broken Nano (reports available, then crashes) → must fall back to the backup AI
//  b) a working Nano that answers like the real one → must give the same filters
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const groups = JSON.parse(fs.readFileSync('scripts/fixtures/flipkart.json', 'utf8'))
const query = 'black puma jacket under 2000'
const expected = ['Color: Black', 'Brand: PUMA', 'Max price: ₹2000']

const FAKES = {
  broken: `window.__nanoTries = 0; window.LanguageModel = { availability: async () => 'available', create: async () => { window.__nanoTries++; throw new Error('simulated Nano crash') } }`,
  working: `window.LanguageModel = { availability: async () => 'available', create: async (opts) => {
    window.__nanoOpts = opts
    return { prompt: async (q) => 'black, puma', destroy() {} } } }`,
}

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
  userDataDir: path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
})
const extId = await browser.installExtension(path.resolve('dist'))
let allOk = true
for (const [name, fake] of Object.entries(FAKES)) {
  const panel = await browser.newPage()
  panel.on('console', (m) => { if (/\[ai\]/.test(m.text())) console.log(`  [panel] ${m.text().slice(0, 200)}`) })
  await panel.evaluateOnNewDocument(fake)
  await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html?test`)
  await new Promise((r) => setTimeout(r, 1500))
  const label = await panel.$eval('#ai-label', (p) => p.textContent)
  const t0 = Date.now()
  const got = await panel.evaluate(async (q, g) => (await window.__chooseFilters(q, g)).map((x) => `${x.group}: ${x.option}`), query, groups)
  const ok = got.length === expected.length && expected.every((e) => got.includes(e))
  allOk &&= ok
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} Nano — panel says "${label}" — got: ${got.join(' | ')} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  if (name === 'broken') {
    // After one failure: the next request goes straight to the backup (Nano not tried again),
    // and the panel names the backup AI.
    const t1 = Date.now()
    const again = await panel.evaluate(async (q, g) => (await window.__chooseFilters(q, g)).map((x) => `${x.group}: ${x.option}`), query, groups)
    const tries = await panel.evaluate(() => window.__nanoTries)
    const name2 = await panel.evaluate(() => window.__aiStatus())
    const ok2 = tries === 1 && /backup/i.test(name2) && expected.every((e) => again.includes(e))
    allOk &&= ok2
    console.log(`${ok2 ? 'PASS' : 'FAIL'} broken Nano, 2nd request — Nano tried ${tries} time(s) in total, AI now "${name2}" (${((Date.now() - t1) / 1000).toFixed(1)}s)`)
  }
  if (name === 'working') console.log('  options sent to LanguageModel.create:', JSON.stringify(await panel.evaluate(() => window.__nanoOpts)).slice(0, 200))
  await panel.close()
}
await browser.close()
process.exit(allOk ? 0 : 1)
