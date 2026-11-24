// Runs the everyday messages (everyday-cases.mjs) through decide(), the same function the panel
// uses, and checks both the filters chosen and the kind of reply.
//   node scripts/everyday.mjs        fast: rules only, no AI (seconds)
//   node scripts/everyday.mjs --ai   the real on-device AI inside the built extension (slow)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { EVERYDAY as ALL } from './everyday-cases.mjs'
import { BLIND } from './blind-cases.mjs'
import { BLIND2 } from './blind-cases-2.mjs'
import { GENERIC } from './generic-cases.mjs'
import { GENERIC_BLIND } from './generic-blind-cases.mjs'
import { FILTER45 } from './filter45-cases.mjs'
// --blind: only the batch written without looking at the code; --generic: only "any site" pages
const EVERYDAY = process.argv.includes('--blind') ? BLIND2 : process.argv.includes('--generic') ? [...GENERIC, ...GENERIC_BLIND] : [...ALL, ...BLIND, ...BLIND2, ...GENERIC, ...GENERIC_BLIND, ...FILTER45]

const useAi = process.argv.includes('--ai')
const fixtures = Object.fromEntries(
  fs.readdirSync('scripts/fixtures').map((f) => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(`scripts/fixtures/${f}`, 'utf8'))]),
)
const SITE = { amazon: 'Amazon', flipkart: 'Flipkart', myntra: 'Myntra', generic: 'Test Shop' }
const toChoice = (s) => {
  const remove = s.startsWith('-')
  const [group, option] = s.replace(/^-/, '').split(/: (.*)/)
  return { group, option, ...(remove && { remove: true }) }
}
const fmt = (x) => `${x.remove ? '-' : ''}${x.group}: ${x.option}`

// The kind of answer, from its first words (reply.ts).
function kindOf(reply) {
  if (!reply) return null
  const k = [
    [/^Tell me what you're looking for/, 'empty'], [/^Hi!/, 'greet'], [/^You're welcome/, 'thanks'], [/^I filter, sort/, 'help'],
    [/^(Applied in this chat|No filters from this chat)/, 'applied'], [/^Filters on this page/, 'filters'],
    [/^Tell me your budget/, 'price'], [/^Sorry, I can/, 'offtopic'], [/^I can't compare/, 'compare'],
    [/^No matching filters/, 'nomatch'], [/^(No size \S+ on this page|I couldn't find a (size|price|rating|discount|sort)|No (price|rating|discount) option on this page|I can't sort by discount|This page can't be sorted|Out-of-stock items are already|No in-stock filter|These results are already|Shops can't hide)/, 'note'], [/^Not on this page/, 'colour-missing'], [/^This .* page has no/, 'nolist'],
  ].find(([re]) => re.test(reply))
  if (k) return k[1]
  const list = reply.match(/^(\w+) on this page:/)
  return list ? `list:${list[1]}` : `unknown: ${reply.slice(0, 60)}`
}

let run // (q, page, remembered) => Promise<{ reply?, choices }>
let browser
if (useAi) {
  const puppeteer = (await import('puppeteer-core')).default
  browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: false, pipe: true, enableExtensions: true, defaultViewport: null, protocolTimeout: 0,
    userDataDir: process.env.E2E_PROFILE ?? path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
  })
  const extId = await browser.installExtension(path.resolve('dist'))
  const panel = await browser.newPage()
  await panel.goto(`chrome-extension://${extId}/src/sidepanel/index.html?test`)
  await panel.waitForFunction(() => !/checking/.test(document.querySelector('#ai-label')?.textContent ?? 'checking'), { timeout: 0, polling: 1000 })
  run = (q, page, remembered) => panel.evaluate((q, page, r) => window.__decide(q, page, r), q, page, remembered)
} else {
  // Bundle the panel's own decide() with a rules-only chooser (no AI words).
  const out = path.join(os.tmpdir(), 'ai-shopping-filters-decide.mjs')
  await build({
    stdin: {
      contents: `import { decide } from './src/ai/decide'; import { matchFilters } from './src/ai/match'; import { applyRules } from './src/ai/rules'
        export const run = (q, page, r, searched) => decide(q, page, r, async (x, g) => matchFilters(applyRules(x, { terms: [], max_price: null, min_price: null, min_discount: null, min_rating: null }), g, x), searched)`,
      resolveDir: process.cwd(), loader: 'ts',
    },
    bundle: true, format: 'esm', outfile: out, logLevel: 'error',
  })
  run = (await import(pathToFileURL(out).href + `?${Date.now()}`)).run
}

const results = []
for (const c of EVERYDAY) {
  // page: 'empty' = a page showing no filters (home page, zero results).
  const page = { site: SITE[c.site.split('-')[0]], filters: c.page === 'empty' ? [] : fixtures[c.site], searchTerm: c.searchTerm }
  let got = [], kind = null, error
  try {
    const d = await run(c.q, page, (c.applied ?? []).map(toChoice), !!c.searched) // searched: right after a search
    got = d.choices.map(fmt)
    kind = kindOf(d.reply)
    c.replyText = d.reply
  } catch (e) {
    error = e.message
  }
  const expect = c.expect ?? []
  const missing = expect.filter((e) => !got.includes(e))
  const extra = got.filter((g) => !expect.includes(g))
  const wantKind = c.reply ?? null
  const pass = !error && !missing.length && !extra.length && kind === wantKind
  results.push({ ...c, got, kind, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${c.site}] ${JSON.stringify(c.q.slice(0, 80))}` +
    (pass ? '' : `\n      missing: ${missing.join(', ') || '-'}   extra: ${extra.join(', ') || '-'}   reply: ${kind ?? '-'} (want ${wantKind ?? 'none'})${error ? `   error: ${error}` : ''}`))
}
await browser?.close()

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
const byCat = {}
for (const r of results) (byCat[r.cat] ??= [0, 0])[r.pass ? 0 : 1]++
console.log(Object.entries(byCat).map(([k, [p, f]]) => `${k} ${p}/${p + f}`).join(' · '))
if (process.argv.includes('--show-replies'))
  for (const r of results.filter((r) => r.replyText)) console.log(`\n"${r.q.slice(0, 50)}"\n  → ${r.replyText}`)
fs.writeFileSync(`scripts/everyday-results${useAi ? '-ai' : ''}.json`, JSON.stringify(results, null, 1))
process.exit(passed === results.length ? 0 : 1)
