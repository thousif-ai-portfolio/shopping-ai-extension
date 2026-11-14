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
// --blind: only the batch written without looking at the code
const SEARCH = process.argv.includes('--blind') ? SEARCH_BLIND : [...MINE, ...SEARCH_BLIND]

const out = path.join(os.tmpdir(), 'ai-shopping-filters-product.mjs')
await build({
  stdin: { contents: `export * from './src/ai/product'; export { quickReply } from './src/ai/reply'`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
})
const { otherSite, searchFor, searchOnOtherSite, quickReply } = await import(pathToFileURL(out).href + `?${Date.now()}`)

// Exactly the panel's order (App.tsx): questions get an answer, never a site switch.
const step = (q, now, current) => {
  const site = quickReply(q, { site: now, filters: [] }, []) ? null : otherSite(q, now)
  return { site: site?.name ?? null, search: site ? searchOnOtherSite(q, current) : searchFor(q, current) }
}

let passed = 0
for (const c of SEARCH) {
  const got = step(c.q, c.now, c.current)
  const ok = got.site === c.site && got.search === c.search
  if (ok) passed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${c.now}] ${JSON.stringify(c.q)}` + (ok ? '' : `\n      got site ${got.site}, search ${JSON.stringify(got.search)}   want site ${c.site}, search ${JSON.stringify(c.search)}`))
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
