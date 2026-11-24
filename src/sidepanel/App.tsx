import { useEffect, useRef, useState } from 'react'
import { aiStatus, chooseFilters } from '../ai/llm'
import { SORT_GROUP, SORT_LABELS, samePage, wait, type Product, type FilterChoice, type Message, type Page } from '../adapters/types'
import { SITES, otherSite, searchFor, compareTargets, filterWords, searchAt, searchOnOtherSite, searchWords, unknownSite, wantsCompare, withoutShop, type CompareTarget } from '../ai/product'
import { summarize, type SiteResult, type Summary } from '../ai/compare'
import { decide } from '../ai/decide'
import { normalizeQuery } from '../ai/rules'
import { label, quickReply } from '../ai/reply'

// ?test exposes the AI step to the test runners (scripts/edge.mjs).
if (new URLSearchParams(location.search).has('test'))
  Object.assign(window, {
    __chooseFilters: chooseFilters,
    __aiStatus: aiStatus,
    __decide: (q: string, page: Page, remembered: FilterChoice[]) => decide(q, page, remembered, chooseFilters),
  })

// The shopping tab the panel works on: the active tab of this window.
async function shopTabId(): Promise<number> {
  // ?tab=<id> lets automated tests open this panel as a normal tab and target another tab.
  const forced = Number(new URLSearchParams(location.search).get('tab'))
  if (forced) return forced
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab.')
  return tab.id
}

// Send a message to the content script running in that tab.
async function sendToPage<T>(msg: Message, tabId?: number, tries = 15): Promise<T> {
  const id = tabId ?? (await shopTabId())
  // A page that is still loading (or just reloaded or redirected after a filter: Reliance) has no
  // listener yet, so try again for a while before giving up.
  let res
  // A page that stops answering while its filters are read (seen once on Myntra): give up after
  // 2 minutes instead of "Reading filters…" forever. (Applying has its own limit.)
  const slow = new Error('This page took too long to answer. Reload it and try again.')
  for (let attempt = 0; ; attempt++) {
    try {
      const ask = chrome.tabs.sendMessage(id, msg)
      res = msg.type === 'GET_FILTERS' ? await Promise.race([ask, wait(120000).then(() => { throw slow })]) : await ask
      break
    } catch (e) {
      if (e === slow) throw e
      if (attempt >= tries) {
        const url = (await chrome.tabs.get(id).catch(() => null))?.url ?? ''
        throw new Error(/^https?:/.test(url)
          ? 'This page did not answer (it may still be loading, or it blocks extensions). Reload it and try again.'
          : 'Open a shopping site and reload the page.')
      }
      await wait(1000)
    }
  }
  if (res?.error) throw new Error(res.error)
  return res
}

// After starting a search, wait for the new results page to finish loading (max 25 s),
// then for its content script to answer (it starts a moment after the page loads).
async function waitForNewPage<T>(tabId: number, oldUrl: string, msg: Message): Promise<T> {
  await new Promise<void>((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer); resolve() }
    const listener = (id: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (id === tabId && info.status === 'complete' && tab.url !== oldUrl) done()
    }
    const timer = setTimeout(done, 25000)
    chrome.tabs.onUpdated.addListener(listener)
  })
  for (let i = 0; ; i++) {
    try {
      return await sendToPage<T>(msg, tabId, 1) // (this loop does the waiting)
    } catch (e) {
      if (i >= 10) throw e
      await wait(1000)
    }
  }
}

// After filters are applied the page reloads; once it has loaded, ask it whether it shows any products.
async function noResults(tabId: number): Promise<boolean> {
  await settled(tabId, 1500)
  try {
    return (await sendToPage<{ empty: boolean }>({ type: 'NO_RESULTS' }, tabId)).empty
  } catch {
    return false // never block the answer on this check
  }
}

type Applied = { missing: FilterChoice[]; reloading?: boolean }
// Applies filters and returns the ones the page did not have. On other sites a click can reload
// the page half-way; the rest is then applied on the new page, so wait and ask it (up to ~40 s).
// unsure: the page kept reloading and never said how it ended.
async function applyOnPage(choices: FilterChoice[], tabId: number): Promise<{ missing: FilterChoice[]; unsure: boolean }> {
  // (The id lets the page ignore this request if it arrives twice: sendToPage resends after errors.)
  // Never wait forever on a page that gets stuck (a shop's script in a loop): after the time limit,
  // stop waiting and ask the user to check the page ("unsure").
  const limit = 60000 + 30000 * choices.length
  const first = await Promise.race([
    sendToPage<Applied>({ type: 'APPLY_FILTERS', choices, id: `${Date.now()}-${Math.random()}` }, tabId),
    wait(limit).then(() => null),
  ])
  if (!first) return { missing: [], unsure: true }
  let res = first
  const missing = [...res.missing]
  for (let i = 0; res.reloading && i < 8; i++) {
    await settled(tabId, 500)
    try {
      res = await sendToPage<Applied>({ type: 'APPLY_RESULT' }, tabId)
    } catch {
      continue // between pages: ask again
    }
    if (!res.reloading) missing.push(...res.missing.filter((m) => !missing.some((x) => same(x, m))))
  }
  return { missing, unsure: !!res.reloading }
}

// Updates the chat's memory after applying: add new filters, drop removed ones, "clear all" empties it.
function remember(before: FilterChoice[], done: FilterChoice[]): FilterChoice[] {
  if (done.some((c) => c.group === '*')) return []
  let list = [...before]
  for (const c of done) {
    // Only the latest sort order counts.
    if (c.group === SORT_GROUP) list = list.filter((r) => r.group !== SORT_GROUP)
    if (c.remove) list = list.filter((r) => r.group !== c.group || (c.option !== '*' && r.option !== c.option))
    else if (!list.some((r) => r.group === c.group && r.option === c.option)) list.push({ group: c.group, option: c.option })
  }
  return list
}

// Waits for a page to settle after filters were applied (it reloads, then fills in its results
// for `fill` ms more).
async function settled(tabId: number, fill = 2000) {
  await wait(2500)
  for (let i = 0; i < 20 && (await chrome.tabs.get(tabId)).status !== 'complete'; i++)
    await wait(500)
  await wait(fill)
}

const same = (a: FilterChoice, b: FilterChoice) => a.group === b.group && a.option === b.option

// Remembered filters as words, so "compare on all 3 sites" after "black puma jacket" still means
// black + PUMA on every site (each site names its groups differently: "Brand" vs "Brands").
const asWords = (list: FilterChoice[]) =>
  list.filter((c) => !c.remove && c.group !== SORT_GROUP).map((c) =>
    /max price/i.test(c.group) ? `under ${c.option.replace(/[^\d.]/g, '')}` :
    /min price/i.test(c.group) ? `above ${c.option.replace(/[^\d.]/g, '')}` :
    /size/i.test(c.group) ? `size ${c.option}` : c.option).join(' ')

export default function App() {
  const [query, setQuery] = useState('')
  const [ai, setAi] = useState('checking…')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<FilterChoice[]>([])
  const [comparison, setComparison] = useState<Summary | null>(null)
  // The chat: finished requests, the live one, and whether it is still working.
  const [turns, setTurns] = useState<Turn[]>([])
  const [asked, setAsked] = useState('')
  const [busy, setBusy] = useState(false)
  // Filters this chat has applied, per shopping tab (see remember below).
  const memory = useRef(new Map<number, FilterChoice[]>())

  useEffect(() => {
    aiStatus().then(setAi)
  }, [])

  async function run(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (e) {
      setStatus(`⚠️ ${(e as Error).message}`)
    }
  }

  const apply = (q: string) =>
    run(async () => {
      setApplied([]) // don't keep showing the previous request's chips
      setComparison(null)
      // A pasted list of requests (a test plan, a chat) read as one would search for all its words.
      // (The longest real request in the tests is 25 words.)
      if (q.trim().split(/\s+/).length > 45 || q.split('\n').filter((l) => l.trim()).length >= 4)
        return setStatus('💬 That looks like several requests at once. Send them one at a time (e.g. "size 9", then "under 5000") and I\'ll do each in turn.')
      const tabId = await shopTabId()
      setStatus('Reading filters on the page…')
      // A page the extension can't read (an error page like "Access denied", a browser page, a tab
      // opened before installing) still lets you go somewhere else: "open nike", "open nykaa.com".
      let page: Page
      let unreadable: unknown = null
      try {
        page = await sendToPage<Page>({ type: 'GET_FILTERS' }, tabId)
      } catch (e) {
        unreadable = e
        const url = (await chrome.tabs.get(tabId)).url ?? ''
        page = { site: /^https?:/.test(url) ? new URL(url).hostname.replace(/^www\./, '') : '', filters: [], searchTerm: '' }
      }
      // A page just opened or searched that can't be read: say so, instead of waiting and failing.
      const readNew = async (oldUrl: string, what: string): Promise<Page | null> => {
        try {
          const p = await waitForNewPage<Page>(tabId, oldUrl, { type: 'GET_FILTERS' })
          if (!p.blocked) return p
          setStatus(`⚠️ ${what}, but the site is blocking this browser (it shows "Access denied" instead of the shop), so there is nothing to filter. Reload it later, or try with VPNs, ad blockers or automation tools turned off.`)
        } catch {
          setStatus(`⚠️ ${what}, but I can't read that page: it didn't load, or the site is blocking this browser (for example "Access denied"). If it shows products in this tab, ask me again.`)
        }
        return null
      }

      // Questions like "where is my order on amazon" get an answer, never a compare or a site switch.
      const question = !!quickReply(q, page, [])
      // "compare amazon, flipkart and myntra", "compare puma shoes on ajio and snapdeal", "compare all"
      if (wantsCompare(q) && !question) return compareSites(q, tabId, page)

      // "open amazon, i need a blue shirt" on Flipkart: go to that site, search there, then filter.
      const site = question ? null : otherSite(q, page.site)
      let text: string | null = null
      let asked = q // what to pick filters from (without a shop's name)
      // Another shop by name or address ("open vastardo website", "go to nykaa.com"): never search
      // this shop for its name. An address typed by the user is opened; a bare name is not guessed.
      const elsewhere = question || site ? null : unknownSite(q, page.site, new URL((await chrome.tabs.get(tabId)).url ?? 'about:blank').hostname, page.filters.flatMap((g) => g.options))
      if (elsewhere && !elsewhere.domain)
        return setStatus(`💬 I can't open "${elsewhere.name}" by name: it isn't one of the shops I know, and a guessed address could open a wrong or fake site. Open it in this tab and ask again (I work on any shop), or type its exact web address, e.g. "open shopname.com, brown shirt size L".`)
      // Anything else needs this page's filters.
      if (unreadable && !site && !elsewhere?.domain) throw unreadable
      if (page.blocked && !site && !elsewhere?.domain)
        return setStatus('⚠️ This site is blocking this browser (it shows "Access denied" instead of the shop), so there is nothing to filter. Reload it later, or try with VPNs, ad blockers or automation tools turned off.')
      if (elsewhere?.domain) {
        setStatus(`Opening ${elsewhere.domain}…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await chrome.tabs.update(tabId, { url: `https://${elsewhere.domain}/` })
        const opened = await readNew(oldUrl, `Opened ${elsewhere.domain}`)
        if (!opened) return
        page = opened
        // Then search it for the product asked for, if any ("brown shirt"), and filter those results.
        const wanted = searchAt(q, elsewhere.domain, elsewhere.name)
        if (wanted) {
          text = wanted
          setStatus(`Searching ${elsewhere.domain} for "${text}"…`)
          const shopUrl = (await chrome.tabs.get(tabId)).url ?? ''
          await sendToPage({ type: 'SEARCH', text }, tabId)
          const results = await readNew(shopUrl, `Searched ${elsewhere.domain} for "${text}"`)
          if (!results) return
          page = results
          // Some search boxes ignore everything a script can do: say so instead of filtering the home page.
          // (Only a "#" or an empty "?" added to the address is not a search.)
          if (samePage((await chrome.tabs.get(tabId)).url ?? '', shopUrl))
            return setStatus(`Opened ${elsewhere.domain}, but its search box didn't respond to "${text}". Search there yourself, then ask me to filter (e.g. "size L under 2000").`)
        }
        // The shop's name is not a filter: filter by the rest of the request only.
        asked = withoutShop(q, elsewhere.domain, elsewhere.name)
      } else if (site) {
        text = searchOnOtherSite(q, page.searchTerm)
        setStatus(`Opening ${site.name} and searching for "${text}"…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await chrome.tabs.update(tabId, { url: site.url(text) })
        const opened = await readNew(oldUrl, `Opened ${site.name} and searched for "${text}"`)
        if (!opened) return
        page = opened
      } else if ((text = searchFor(q, page.searchTerm))) {
        // Asking for a different product than the page shows ("running shoes" on a jackets page)?
        // Search the site for it first, then filter the new results.
        setStatus(`Searching ${page.site} for "${text}"…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await sendToPage({ type: 'SEARCH', text }, tabId)
        const results = await readNew(oldUrl, `Searched ${page.site} for "${text}"`)
        if (!results) return
        page = results
      }
      const searched = site ? `Opened ${site.name} and searched for "${text}". `
        : elsewhere?.domain ? `Opened ${elsewhere.domain}${text ? ` and searched for "${text}"` : ''}. `
        : text ? `Searched for "${text}". ` : ''

      // What this chat already applied on this tab. A page with zero results can hide its whole
      // filter list, so "remove nike" must still be able to find Nike.
      if (text || elsewhere?.domain) memory.current.set(tabId, []) // new search or another shop: new page
      const remembered = memory.current.get(tabId) ?? []
      // Answer (greetings, questions, nothing matched) or pick filters: see decide.ts.
      setStatus('AI is choosing filters…')
      // (After opening another shop the request counts as searched: no "no matching filters" for its name.)
      const fresh = !!text || !!elsewhere?.domain
      let decision = await decide(asked, page, remembered, (q, g) => chooseFilters(q, g, setStatus), fresh)
      // A page just opened may draw its filters late (heavy shops): read it once more before
      // saying a filter isn't there.
      if (fresh && !decision.choices.length && filterWords(asked)) {
        setStatus('Waiting for the filters to appear…')
        await wait(4000)
        page = await sendToPage<Page>({ type: 'GET_FILTERS' }, tabId)
        decision = await decide(asked, page, remembered, (q, g) => chooseFilters(q, g, setStatus), fresh)
      }
      let choices = decision.choices
      if (decision.reply && !choices.length) return setStatus(`${searched}💬 ${decision.reply}`)
      let note = decision.reply ? ` 💬 ${decision.reply}` : ''
      if (!choices.length) return setStatus(`${searched}Done ✅`) // the search itself was the answer
      // "remove the brand filter" → also name each remembered brand, for pages that hide the list.
      // (Sent to the page, but the chips show just "Brand: all".)
      const shown = choices
      choices = [
        ...choices,
        ...choices
          .filter((c) => c.remove && c.option === '*')
          .flatMap((c) => remembered.filter((r) => r.group === c.group || (c.group === '*' && r.group !== SORT_GROUP)).map((r) => ({ ...r, remove: true }))),
      ]

      setStatus('Applying…')
      const { missing, unsure } = await applyOnPage(choices, tabId)
      const done = choices.filter((c) => !missing.some((m) => same(m, c)))
      memory.current.set(tabId, remember(remembered, done))
      setApplied(shown.filter((c) => !missing.some((m) => same(m, c))))
      // "nike instead of puma" where only Puma could come off (a page filtered by Puma may list no
      // other brands): read the page again, now without Puma, and add Nike.
      if (done.length && done.every((c) => c.remove) && /\binstead of\b/.test(normalizeQuery(asked))) {
        // (The page may still be reloading after the removal: try twice.)
        let add: FilterChoice[] = []
        for (let i = 0; i < 2 && !add.length; i++) {
          await settled(tabId)
          if (i) await wait(3000)
          const again = await sendToPage<Page>({ type: 'GET_FILTERS' }, tabId).catch(() => null)
          if (!again) continue
          const second = await decide(asked, again, memory.current.get(tabId) ?? [], (q, g) => chooseFilters(q, g, setStatus), false)
          add = second.choices.filter((c) => !c.remove)
        }
        if (add.length) {
          const r = await applyOnPage(add, tabId)
          const ok = add.filter((c) => !r.missing.some((m) => same(m, c)))
          done.push(...ok)
          memory.current.set(tabId, remember(memory.current.get(tabId) ?? [], ok))
          setApplied([...shown.filter((c) => !missing.some((m) => same(m, c))), ...ok])
        }
        // Only the old one came off: say why the new one wasn't added (e.g. no Nike among the brands
        // left once size L, under ₹1,500 and 4★ are applied).
        else {
          const wanted = normalizeQuery(asked).match(/(.+?)\s+instead of/)?.[1]?.trim()
          if (wanted) note += ` 💬 Took that off, but "${wanted}" is not among this page's options with your other filters. Try removing one of them first.`
        }
      }
      // Filters can combine into zero products ("nike jacket under 500"): say so, with a way out.
      const empty = done.length && !done.every((c) => c.remove) ? await noResults(tabId) : false
      // (Removals sent along with "clear all" may already be off: not worth a warning.)
      const unmet = missing.filter((m) => !(m.remove && choices.some((c) => c.group === '*')))
      const notOnPage = unmet.length
        ? `Could not apply ${unmet.map((m) => (m.option === '*' ? m.group : m.option)).join(', ')} (not on this page). `
        : ''
      setStatus(
        searched + notOnPage + (done.length ? 'Done ✅' : '') +
          (unsure ? ' ⚠️ The page took a long time (or kept reloading), so check that every filter is ticked.' : '') +
          (empty ? ' ⚠️ No products match all these filters. Try "remove …", a higher budget, or "start over".' : '') + note,
      )
    })

  // Same search + same filters on every shop to compare (see compareTargets: the shops named, or
  // all well-known shops selling that kind of product), cheapest first; then open the cheapest
  // shop's results and say why it won. One tab, one shop after another (shops only draw their
  // filters in a visible tab).
  async function compareSites(q: string, tabId: number, start: Page) {
    const remembered = memory.current.get(tabId) ?? []
    const host = new URL((await chrome.tabs.get(tabId)).url ?? 'about:blank').hostname
    const targets = compareTargets(q, start.site, host)
    // (Shop names and addresses removed: Amazon even has a brand called "Amazon Brand - Symbol".)
    const withoutShops = targets.reduce((s, t) => withoutShop(s, t.domain ?? t.name, t.name), q)
    const text = searchWords(SITES.reduce((s, x) => s.replace(new RegExp(x.re.source, 'gi'), ' '), withoutShops)) || start.searchTerm.trim()
    if (!text) return setStatus('💬 Tell me what to compare, e.g. "compare black roadster shirt size 40 on all sites" or "compare puma shoes on ajio and snapdeal".')
    // The request plus what this chat already applied here, as plain words.
    const request = SITES.reduce((s, x) => s.replace(new RegExp(x.re.source, 'gi'), ' '), `${withoutShops} ${asWords(remembered)}`).replace(/\s+/g, ' ').trim()
    const results: SiteResult[] = []
    for (const [n, site] of targets.entries()) {
      const step = (s: string) => setStatus(`Comparing (${n + 1}/${targets.length}) ${site.name}: ${s} (about ${Math.ceil((targets.length - n) * 0.75)} min left)`)
      try {
        step(`searching "${text}"…`)
        // One shop may not hold up the rest: 2 minutes each at most.
        const page = await Promise.race([
          openAndSearch(site, text, tabId),
          wait(120000).then(() => { throw new Error('it took too long to load') }),
        ])
        step('choosing filters…')
        // As "just searched" (each shop was searched for the product): a sub-type filter such as
        // "Perfumed Cream & Solid Perfume" would narrow it wrongly. Other kinds of items (socks for
        // "running shoes") are left out by the title check in summarize().
        const d = await decide(request, page, [], (q, g) => chooseFilters(q, g, () => {}), true)
        // The results as found, before sorting: a shop may pad the cheapest-first list with other
        // things (Ajio: socks for "running shoes"), so these still count if the sorted ones don't match.
        const unsorted = await sendToPage<{ products: Product[] }>({ type: 'GET_PRODUCTS' }, tabId).then((r) => r.products, () => [] as Product[])
        // Always cheapest first, whatever else was asked, so the first results are the lowest prices.
        const sort = page.filters.some((g) => g.name === SORT_GROUP && g.options.includes(SORT_LABELS.price_asc))
          ? [{ group: SORT_GROUP, option: SORT_LABELS.price_asc }] : []
        const choices = [...d.choices.filter((c) => c.group !== SORT_GROUP && !c.remove), ...sort]
        step('applying filters…')
        const { missing } = choices.length ? await applyOnPage(choices, tabId) : { missing: [] as FilterChoice[] }
        await settled(tabId)
        step('reading prices…')
        let products: Product[] = []
        for (let i = 0; i < 4 && !products.length; i++) {
          products = (await sendToPage<{ products: Product[] }>({ type: 'GET_PRODUCTS' }, tabId)).products
          if (!products.length) await wait(1500)
        }
        // Sorted first (cheapest), then the unsorted ones not already there; summarize() keeps only
        // matching items and checks the budget on each.
        products = [...products, ...unsorted.filter((u) => !products.some((p) => p.url === u.url))]
        results.push({ site: site.name, applied: choices.filter((c) => !missing.some((m) => same(m, c))), url: (await chrome.tabs.get(tabId)).url ?? '', products })
      } catch (e) {
        results.push({ site: site.name, applied: [], url: '', products: [], error: (e as Error).message })
      }
    }
    const summary = summarize(results, text)
    setComparison(summary)
    // Show the winner's filtered, cheapest-first results (and remember them for follow-ups).
    if (summary.winner) {
      const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
      if (summary.winner.url !== oldUrl) {
        await chrome.tabs.update(tabId, { url: summary.winner.url })
        await waitForNewPage<Page>(tabId, oldUrl, { type: 'GET_FILTERS' }).catch(() => undefined)
      }
      memory.current.set(tabId, summary.winner.applied)
      setApplied(summary.winner.applied)
    }
    setStatus(`Compared ${targets.map((s) => s.name).join(', ')} for "${text}", cheapest first. Done ✅`)
  }

  // Opens one shop's results for the text: the three by their search address, any other shop by
  // opening it and using its own search. Throws when the shop can't be read or searched.
  async function openAndSearch(site: CompareTarget, text: string, tabId: number): Promise<Page> {
    const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
    if (site.url) {
      await chrome.tabs.update(tabId, { url: site.url(text) })
      return waitForNewPage<Page>(tabId, oldUrl, { type: 'GET_FILTERS' })
    }
    await chrome.tabs.update(tabId, { url: `https://${site.domain}/` })
    await waitForNewPage<Page>(tabId, oldUrl, { type: 'GET_FILTERS' })
    const home = (await chrome.tabs.get(tabId)).url ?? ''
    await sendToPage({ type: 'SEARCH', text }, tabId)
    const page = await waitForNewPage<Page>(tabId, home, { type: 'GET_FILTERS' })
    if (samePage((await chrome.tabs.get(tabId)).url ?? '', home)) throw new Error("its search box didn't respond")
    return page
  }

  function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    // The previous answer moves into the chat history; this request becomes the live one.
    if (asked) setTurns((t) => [...t, { q: asked, status, chips: applied, comparison }])
    setAsked(q)
    setQuery('')
    setStatus('')
    setBusy(true)
    // Afterwards refresh the AI name: it changes if Gemini Nano failed and the rules took over.
    apply(q).finally(() => { setBusy(false); aiStatus().then(setAi) })
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-sm text-neutral-800">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-xs font-bold text-white">AI</span>
          <h1 className="text-base font-semibold">Shopping Assistant</h1>
        </div>
        {/* Not shown; the tests read which AI is in use from here. */}
        <span id="ai-label" className="hidden">{ai}</span>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!asked && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-medium">Hi! What are you shopping for?</p>
            <p className="mt-1 text-neutral-500">
              Open a search on any shopping site (or one of these) and tell me in your own words. I'll tick the filters for you.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {SITES.map((s) => (
                <button
                  key={s.name}
                  className="site flex flex-col items-center gap-2 rounded-xl border border-neutral-300 bg-white py-3 font-medium text-black transition hover:border-black hover:shadow-sm"
                  onClick={() => openSite(s.home)}
                >
                  <SiteLogo url={s.home} size={32} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <Exchange key={i} turn={t} />
        ))}
        {asked && (
          <div id="latest">
            <Exchange turn={{ q: asked, status, chips: applied, comparison }} working={busy} live />
          </div>
        )}
        <div ref={(el) => el?.scrollIntoView({ block: 'end' })} />
      </main>

      <footer className="border-t border-neutral-200 bg-white p-3">
        {/* After the first message the welcome card is gone, so the sites stay reachable here. */}
        {asked && (
          <div className="mb-2 flex gap-1.5">
            {SITES.map((s) => (
              <button
                key={s.name}
                className="site flex items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:border-black hover:text-black"
                onClick={() => openSite(s.home)}
              >
                <SiteLogo url={s.home} size={14} />
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-black focus:ring-2 focus:ring-neutral-200"
            rows={2}
            placeholder={busy ? 'Working on it…' : 'e.g. black puma jacket size M under 2000'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(query)
              }
            }}
          />
          <button
            id="send"
            className="h-11 rounded-xl bg-black px-4 font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={!query.trim() || busy}
            onClick={() => send(query)}
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">Enter to send · "start over" clears all filters · nothing leaves your computer</p>
      </footer>
    </div>
  )
}

type Turn = { q: string; status: string; chips: FilterChoice[]; comparison: Summary | null }

// Opens a site in the current tab, the one this panel works on.
const openSite = (url: string) => shopTabId().then((id) => chrome.tabs.update(id, { url }))

// The site's own icon from Chrome's favicon cache (needs the "favicon" permission; served from
// the extension itself, so no network request), in greyscale to fit the black-and-white panel.
function SiteLogo({ url, size }: { url: string; size: number }) {
  const src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size > 16 ? 64 : 32}`)
  return <img src={src} width={size} height={size} alt="" className="grayscale" />
}

// One request and the assistant's answer: what was done, the filters (✅ added, 🗑 removed,
// ↕ sorted), and for a comparison the price on each site.
function Exchange({ turn, working = false, live = false }: { turn: Turn; working?: boolean; live?: boolean }) {
  // "Done ✅ ⚠️ No products match… 💬 I can't compare…" → one line each.
  const lines = turn.status.split(/\s(?=⚠️|💬)/).map((l) => l.trim()).filter(Boolean)
  const finished = /Done|💬|⚠️|Could not/.test(turn.status)
  return (
    <div className="space-y-2">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-black px-3 py-2 text-white">{turn.q}</div>
      <div className="w-fit max-w-[95%] space-y-2 rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3 py-2">
        {/* #status holds the whole status text; the live tests read it. */}
        {live && <p id="status" className="hidden">{turn.status}</p>}
        {working && !turn.status && <p className="text-neutral-500">⏳ Thinking…</p>}
        {lines.map((l, i) => (
          <p
            key={i}
            className={/^⚠️/.test(l) ? 'rounded-lg bg-neutral-100 px-2 py-1 text-black' : /^💬/.test(l) ? 'text-neutral-700' : 'text-neutral-600'}
          >
            {working && !finished && i === lines.length - 1 ? '⏳ ' : ''}
            {l.replace(/^💬\s*/, '')}
          </p>
        ))}
        {turn.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {turn.chips.map((c) => (
              <span
                key={c.group + c.option}
                className={`chip rounded-full px-2.5 py-0.5 text-xs font-medium ${c.remove ? 'bg-neutral-100 text-neutral-500 line-through' : c.group === SORT_GROUP ? 'border border-black bg-white text-black' : 'bg-black text-white'}`}
              >
                {c.remove ? '🗑' : c.group === SORT_GROUP ? '↕' : '✅'}{' '}
                {c.group === '*' ? 'All filters' : label(c)}
              </span>
            ))}
          </div>
        )}
        {turn.comparison && (
          <div id={live ? 'comparison' : undefined} className="space-y-1.5 rounded-xl bg-neutral-50 p-2">
            <p className="font-semibold">{turn.comparison.text.split('\n')[0]}</p>
            <ul className="space-y-1">
              {turn.comparison.rows.map((r) => (
                <li
                  key={r.site}
                  className={r === turn.comparison!.winner ? 'font-semibold text-black' : r.counted ? '' : 'text-neutral-500'}
                >
                  {turn.comparison!.text.split('\n').find((l) => l.startsWith(`• ${r.site}:`))}
                  {r.cheapest?.url && (
                    <>
                      {' · '}
                      <a className="text-black underline" href={r.cheapest.url} target="_blank" rel="noreferrer">view</a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-neutral-500">
              Same search and filters on each site, cheapest first. The sites share no product ids, so this is the
              cheapest matching item on each, not necessarily the identical product.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
