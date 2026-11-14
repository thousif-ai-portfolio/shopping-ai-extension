import { useEffect, useRef, useState } from 'react'
import { aiStatus, chooseFilters, warmUp } from '../ai/llm'
import { SORT_GROUP, SORT_LABELS, type Product, type FilterChoice, type FilterGroup, type Message } from '../adapters/types'
import { SITES, otherSite, searchFor, searchOnOtherSite, searchWords, wantsCompare } from '../ai/product'
import { summarize, type SiteResult, type Summary } from '../ai/compare'

import { decide, type Page } from '../ai/decide'
import { quickReply } from '../ai/reply'

// ?test exposes the AI step to the test runners (scripts/edge.mjs).
if (new URLSearchParams(location.search).has('test'))
  Object.assign(window, {
    __chooseFilters: chooseFilters,
    __aiStatus: aiStatus,
    __decide: (q: string, page: Page, remembered: FilterChoice[]) => decide(q, page, remembered, (x, g) => chooseFilters(x, g)),
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
async function sendToPage<T>(msg: Message, tabId?: number): Promise<T> {
  const id = tabId ?? (await shopTabId())
  // A page that is still loading (or just reloaded after a filter) has no listener yet,
  // so try again for a few seconds before giving up.
  let res
  for (let attempt = 0; ; attempt++) {
    try {
      res = await chrome.tabs.sendMessage(id, msg)
      break
    } catch {
      if (attempt >= 6) throw new Error('Open Amazon.in, Flipkart or Myntra and reload the page.')
      await new Promise((r) => setTimeout(r, 1000))
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
      return await sendToPage<T>(msg, tabId)
    } catch (e) {
      if (i >= 10) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

type PageInfo = { site: string; filters: FilterGroup[]; searchTerm: string }

// After filters are applied the page reloads; once it has loaded, ask it whether it shows any products.
async function noResults(tabId: number): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 2500))
  for (let i = 0; i < 20 && (await chrome.tabs.get(tabId)).status !== 'complete'; i++)
    await new Promise((r) => setTimeout(r, 500))
  await new Promise((r) => setTimeout(r, 1500)) // the site fills in its results after loading
  try {
    return (await sendToPage<{ empty: boolean }>({ type: 'NO_RESULTS' }, tabId)).empty
  } catch {
    return false // never block the answer on this check
  }
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

// Waits for a page to settle after filters were applied (it reloads, then fills in its results).
async function settled(tabId: number) {
  await new Promise((r) => setTimeout(r, 2500))
  for (let i = 0; i < 20 && (await chrome.tabs.get(tabId)).status !== 'complete'; i++)
    await new Promise((r) => setTimeout(r, 500))
  await new Promise((r) => setTimeout(r, 2000))
}

// Remembered filters as words, so "compare on all 3 sites" after "black puma jacket" still means
// black + PUMA on every site (each site names its groups differently: "Brand" vs "Brands").
const asWords = (list: FilterChoice[]) =>
  list.filter((c) => !c.remove && c.group !== SORT_GROUP).map((c) =>
    /max price/i.test(c.group) ? `under ${c.option.replace(/[^\d]/g, '')}` :
    /min price/i.test(c.group) ? `above ${c.option.replace(/[^\d]/g, '')}` :
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

  const [aiState, setAiState] = useState('')
  // Filters this chat has applied, per shopping tab (see withRemembered / remember below).
  const memory = useRef(new Map<number, FilterChoice[]>())

  useEffect(() => {
    aiStatus().then(setAi)
    // Start loading the AI now, so it's ready by the time the user has typed a request.
    warmUp(setAiState).then(
      () => setAiState('ready ✓'),
      (e) => setAiState(`failed to load: ${(e as Error).message}`),
    )
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
      const tabId = await shopTabId()
      setStatus('Reading filters on the page…')
      let page = await sendToPage<PageInfo>({ type: 'GET_FILTERS' }, tabId)

      // "compare amazon, flipkart and myntra", "lowest price on all 3 sites"
      if (wantsCompare(q) && !quickReply(q, page, [])) return compareSites(q, tabId, page)

      // "open amazon, i need a blue shirt" on Flipkart: go to that site, search there, then filter.
      // (Not for questions like "where is my order on amazon": those get an answer.)
      const site = quickReply(q, page, []) ? null : otherSite(q, page.site)
      let text: string | null = null
      if (site) {
        text = searchOnOtherSite(q, page.searchTerm)
        setStatus(`Opening ${site.name} and searching for "${text}"…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await chrome.tabs.update(tabId, { url: site.url(text) })
        page = await waitForNewPage<PageInfo>(tabId, oldUrl, { type: 'GET_FILTERS' })
      } else if ((text = searchFor(q, page.searchTerm))) {
        // Asking for a different product than the page shows ("running shoes" on a jackets page)?
        // Search the site for it first, then filter the new results.
        setStatus(`Searching ${page.site} for "${text}"…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await sendToPage({ type: 'SEARCH', text }, tabId)
        page = await waitForNewPage<PageInfo>(tabId, oldUrl, { type: 'GET_FILTERS' })
      }
      const searched = site ? `Opened ${site.name} and searched for "${text}". ` : text ? `Searched for "${text}". ` : ''

      // What this chat already applied on this tab. A page with zero results can hide its whole
      // filter list, so "remove nike" must still be able to find Nike.
      if (text) memory.current.set(tabId, []) // new search, new page
      const remembered = memory.current.get(tabId) ?? []
      // Answer (greetings, questions, nothing matched) or pick filters: see decide.ts.
      setStatus('AI is choosing filters…')
      const decision = await decide(q, page, remembered, (q, g) => chooseFilters(q, g, setStatus), !!text)
      let choices = decision.choices
      if (decision.reply && !choices.length) return setStatus(`💬 ${decision.reply}`)
      const note = decision.reply ? ` 💬 ${decision.reply}` : ''
      if (!choices.length) return setStatus(`${searched}Done ✅`) // the search itself was the answer
      // "remove the brand filter" → also name each remembered brand, for pages that hide the list.
      // (Sent to the page, but the chips show just "Brand: all".)
      const shown = choices
      choices = [
        ...choices,
        ...choices
          .filter((c) => c.remove && c.option === '*')
          .flatMap((c) => remembered.filter((r) => r.group === c.group).map((r) => ({ ...r, remove: true }))),
      ]

      setStatus('Applying…')
      const { missing } = await sendToPage<{ missing: FilterChoice[] }>({ type: 'APPLY_FILTERS', choices }, tabId)
      const same = (a: FilterChoice, b: FilterChoice) => a.group === b.group && a.option === b.option
      const done = choices.filter((c) => !missing.some((m) => same(m, c)))
      memory.current.set(tabId, remember(remembered, done))
      setApplied(shown.filter((c) => !missing.some((m) => same(m, c))))
      // Filters can combine into zero products ("nike jacket under 500"): say so, with a way out.
      const empty = done.length && !done.every((c) => c.remove) ? await noResults(tabId) : false
      const notOnPage = missing.length
        ? `Could not apply ${missing.map((m) => (m.option === '*' ? m.group : m.option)).join(', ')} (not on this page). `
        : ''
      setStatus(
        searched + notOnPage + (done.length ? 'Done ✅' : '') +
          (empty ? ' ⚠️ No products match all these filters. Try "remove …", a higher budget, or "start over".' : '') + note,
      )
    })

  // Same search + same filters on Amazon, Flipkart and Myntra, cheapest first; then open the
  // cheapest site's results and say why it won. One tab, one site after another (the sites only
  // render their filters in a visible tab).
  async function compareSites(q: string, tabId: number, start: PageInfo) {
    const remembered = memory.current.get(tabId) ?? []
    const text = searchWords(q) || start.searchTerm.trim()
    if (!text) return setStatus('💬 Tell me what to compare, e.g. "compare black roadster shirt size 40 on all 3 sites".')
    // The request plus what this chat already applied here, as plain words.
    // (Site names removed: Amazon even has a brand called "Amazon Brand - Symbol".)
    const request = SITES.reduce((q, s) => q.replace(new RegExp(s.re.source, 'gi'), ' '), `${q} ${asWords(remembered)}`).replace(/\s+/g, ' ').trim()
    const results: SiteResult[] = []
    for (const site of SITES) {
      const step = (s: string) => setStatus(`Comparing (${results.length + 1}/3) ${site.name}: ${s}`)
      try {
        step(`searching "${text}"…`)
        const oldUrl = (await chrome.tabs.get(tabId)).url ?? ''
        await chrome.tabs.update(tabId, { url: site.url(text) })
        const page = await waitForNewPage<PageInfo>(tabId, oldUrl, { type: 'GET_FILTERS' })
        step('choosing filters…')
        const d = await decide(request, page, [], (q, g) => chooseFilters(q, g, () => {}), true)
        // Always cheapest first, whatever else was asked, so the first results are the lowest prices.
        const sort = page.filters.some((g) => g.name === SORT_GROUP && g.options.includes(SORT_LABELS.price_asc))
          ? [{ group: SORT_GROUP, option: SORT_LABELS.price_asc }] : []
        const choices = [...d.choices.filter((c) => c.group !== SORT_GROUP && !c.remove), ...sort]
        step('applying filters…')
        const { missing } = choices.length
          ? await sendToPage<{ missing: FilterChoice[] }>({ type: 'APPLY_FILTERS', choices }, tabId)
          : { missing: [] as FilterChoice[] }
        await settled(tabId)
        step('reading prices…')
        let products: Product[] = []
        for (let i = 0; i < 4 && !products.length; i++) {
          products = (await sendToPage<{ products: Product[] }>({ type: 'GET_PRODUCTS' }, tabId)).products
          if (!products.length) await new Promise((r) => setTimeout(r, 1500))
        }
        const same = (a: FilterChoice, b: FilterChoice) => a.group === b.group && a.option === b.option
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
        await waitForNewPage<PageInfo>(tabId, oldUrl, { type: 'GET_FILTERS' }).catch(() => undefined)
      }
      memory.current.set(tabId, summary.winner.applied)
      setApplied(summary.winner.applied)
    }
    setStatus(`Compared ${SITES.map((s) => s.name).join(', ')} for "${text}", cheapest first. Done ✅`)
  }

  // One finished question and its answer, kept on screen like a chat.
  const ready = /^ready/.test(aiState) // the exact "ready ✓" set when warmUp finishes
  const failed = /failed/.test(aiState)
  const percent = Number(aiState.match(/(\d+)%/)?.[1] ?? NaN)

  function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    // The previous answer moves into the chat history; this request becomes the live one.
    if (asked) setTurns((t) => [...t, { q: asked, status, chips: applied, comparison }])
    setAsked(q)
    setQuery('')
    setStatus('')
    setBusy(true)
    // Afterwards refresh the AI name: it changes if Gemini Nano failed and the backup took over.
    apply(q).finally(() => { setBusy(false); aiStatus().then(setAi) })
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-sm text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white">AI</span>
          <h1 className="text-base font-semibold">Shopping Assistant</h1>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${ready ? 'bg-emerald-100 text-emerald-700' : failed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
          >
            {ready ? '● Ready' : failed ? 'AI failed' : 'Starting…'}
          </span>
        </div>
        <p id="ai-label" className="mt-1 text-xs text-slate-500">
          Private AI on this computer · {ai} · works on Amazon, Flipkart, Myntra
        </p>
        {!ready && (
          <div className="mt-2">
            <p id="ai-state" className="text-xs text-slate-600">{aiState || 'Preparing the AI…'}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-indigo-500 transition-all ${isNaN(percent) ? 'w-1/3 animate-pulse' : ''}`}
                style={isNaN(percent) ? undefined : { width: `${percent}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              The very first time, the AI downloads once (~500 MB, a few minutes). You can type already.
            </p>
          </div>
        )}
        {ready && <span id="ai-state" className="hidden">{aiState}</span>}
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!asked && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-medium">Hi! What are you shopping for?</p>
            <p className="mt-1 text-slate-500">
              Open a search on Amazon, Flipkart or Myntra and tell me in your own words. I'll tick the filters for you.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Try</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  className="example rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => send(e)}
                >
                  {e}
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

      <footer className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
            className="h-11 rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!query.trim() || busy}
            onClick={() => send(query)}
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Enter to send · "start over" clears all filters · nothing leaves your computer</p>
      </footer>
    </div>
  )
}

type Turn = { q: string; status: string; chips: FilterChoice[]; comparison: Summary | null }

const EXAMPLES = ['black puma jacket under 2000', 'cheapest first', 'what brands are there?', 'compare on all 3 sites', 'start over']

// One request and the assistant's answer: what was done, the filters (✅ added, 🗑 removed,
// ↕ sorted), and for a comparison the price on each site.
function Exchange({ turn, working = false, live = false }: { turn: Turn; working?: boolean; live?: boolean }) {
  // "Done ✅ ⚠️ No products match… 💬 I can't compare…" → one line each.
  const lines = turn.status.split(/\s(?=⚠️|💬)/).map((l) => l.trim()).filter(Boolean)
  const finished = /Done|💬|⚠️|Could not/.test(turn.status)
  return (
    <div className="space-y-2">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white">{turn.q}</div>
      <div className="w-fit max-w-[95%] space-y-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2">
        {/* #status holds the whole status text; the live tests read it. */}
        {live && <p id="status" className="hidden">{turn.status}</p>}
        {working && !turn.status && <p className="text-slate-500">⏳ Thinking…</p>}
        {lines.map((l, i) => (
          <p
            key={i}
            className={/^⚠️/.test(l) ? 'rounded-lg bg-amber-50 px-2 py-1 text-amber-800' : /^💬/.test(l) ? 'text-slate-700' : 'text-slate-600'}
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
                className={`chip rounded-full px-2.5 py-0.5 text-xs font-medium ${c.remove ? 'bg-red-50 text-red-700' : c.group === SORT_GROUP ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {c.remove ? '🗑' : c.group === SORT_GROUP ? '↕' : '✅'}{' '}
                {c.group === '*' ? 'All filters' : c.option === '*' ? `${c.group}: all` : `${c.group}: ${c.option}`}
              </span>
            ))}
          </div>
        )}
        {turn.comparison && (
          <div id={live ? 'comparison' : undefined} className="space-y-1.5 rounded-xl bg-slate-50 p-2">
            <p className="font-semibold">{turn.comparison.text.split('\n')[0]}</p>
            <ul className="space-y-1">
              {turn.comparison.rows.map((r) => (
                <li
                  key={r.site}
                  className={r === turn.comparison!.winner ? 'font-medium text-emerald-700' : r.counted ? '' : 'text-slate-500'}
                >
                  {turn.comparison!.text.split('\n').find((l) => l.startsWith(`• ${r.site}:`))}
                  {r.cheapest?.url && (
                    <>
                      {' · '}
                      <a className="text-indigo-600 underline" href={r.cheapest.url} target="_blank" rel="noreferrer">view</a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">
              Same search and filters on each site, cheapest first. The sites share no product ids, so this is the
              cheapest matching item on each, not necessarily the identical product.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
