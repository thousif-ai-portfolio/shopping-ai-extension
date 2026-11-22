// Checks the search step (src/ai/product.ts) against scripts/search-cases.mjs, the same way the
// panel uses it: another site first, else a new product search, else no search.
//   node scripts/search.mjs            the cases
//   node scripts/search.mjs --sweep    also lists what every everyday/blind message would search
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { SEARCH as MINE } from './search-cases.mjs'
import { SEARCH_BLIND } from './search-blind-cases.mjs'
import { SEARCH_BLIND2 } from './search-blind-cases-2.mjs'
// --blind: only the batches written without looking at the code
const SEARCH = process.argv.includes('--blind') ? [...SEARCH_BLIND, ...SEARCH_BLIND2] : [...MINE, ...SEARCH_BLIND, ...SEARCH_BLIND2]

const out = path.join(os.tmpdir(), 'ai-shopping-filters-product.mjs')
await build({
  stdin: { contents: `export * from './src/ai/product'; export { quickReply } from './src/ai/reply'`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
})
const { otherSite, searchFor, searchOnOtherSite, searchAt, unknownSite, quickReply } = await import(pathToFileURL(out).href + `?${Date.now()}`)

const HOST = { Amazon: 'www.amazon.in', Flipkart: 'www.flipkart.com', Myntra: 'www.myntra.com' }
// Exactly the panel's order (App.tsx): questions get an answer, never a site switch; then a known
// site; then another shop by name (answer only) or by typed address (open it, search there).
const step = (q, now, current) => {
  const question = !!quickReply(q, { site: now, filters: [] }, [])
  const site = question ? null : otherSite(q, now)
  const other = question || site ? null : unknownSite(q, now, HOST[now] ?? `www.${now}`)
  if (other && !other.domain) return { site: null, search: null, unknown: other.name, domain: null }
  if (other) return { site: null, search: searchAt(q, other.domain, other.name), unknown: null, domain: other.domain }
  return { site: site?.name ?? null, search: site ? searchOnOtherSite(q, current) : searchFor(q, current), unknown: null, domain: null }
}

let passed = 0
for (const c of SEARCH) {
  const got = step(c.q, c.now, c.current)
  const ok = got.site === c.site && got.search === c.search && got.unknown === (c.unknown ?? null) && got.domain === (c.domain ?? null)
  if (ok) passed++
  const show = (x) => `site ${x.site}, search ${JSON.stringify(x.search)}${x.unknown ? `, unknown ${x.unknown}` : ''}${x.domain ? `, domain ${x.domain}` : ''}`
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${c.now}] ${JSON.stringify(c.q)}` + (ok ? '' : `\n      got ${show(got)}   want ${show(c)}`))
}
console.log(`\n${passed}/${SEARCH.length} passed`)

if (process.argv.includes('--sweep')) {
  const { EVERYDAY } = await import('./everyday-cases.mjs')
  const { BLIND } = await import('./blind-cases.mjs')
  const { BLIND2 } = await import('./blind-cases-2.mjs')
  // The saved pages' searches: jackets, shoes, phones, kurtas.
  const CURRENT = { amazon: 'jacket', flipkart: 'jacket men', myntra: 'jackets', shoes: 'shoes', phones: 'mobile phones', kurtas: 'kurta' }
  console.log('\nEveryday/blind messages that would start a search or open another site:')
  for (const c of [...EVERYDAY, ...BLIND, ...BLIND2]) {
    const [site, kind] = c.site.split('-')
    const now = { amazon: 'Amazon', flipkart: 'Flipkart', myntra: 'Myntra' }[site]
    const got = step(c.q, now, CURRENT[kind] ?? CURRENT[site])
    if (got.site || got.search) console.log(`  [${c.site}] ${JSON.stringify(c.q.slice(0, 70))} → ${got.site ? `open ${got.site}, ` : ''}search ${JSON.stringify(got.search)}`)
  }
}
process.exit(passed === SEARCH.length ? 0 : 1)
