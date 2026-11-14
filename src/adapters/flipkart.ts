import { SORT_GROUP, SORT_LABELS, firstPrice, type FilterChoice, type FilterGroup, type Product, type SiteAdapter } from './types'

// How Flipkart filters work (checked on the live page, Nov 2026):
// - Each filter group is a <section>; its first child is the heading ("BRAND", "SIZE", ...).
// - Sections start collapsed: options only exist in the page after the heading is clicked.
// - Each option is <div title="PUMA"> containing a <label> with a checkbox.
// - Ticking an option updates the page in place (no reload) and collapses all sections again,
//   so before each tick we re-open that option's section.
// - Price is two <select> dropdowns (min and max) instead of checkboxes.
// Class names on Flipkart are random-looking and change often, so we only use tags and attributes.

const MIN_PRICE = 'Min price'
const MAX_PRICE = 'Max price'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
// A section with an active filter gets a "Clear" link in its heading ("PriceClear"), so drop it.
const headingOf = (s: Element) => (s.firstElementChild?.textContent?.trim() ?? '').replace(/\s*clear$/i, '')
const findSection = (name: string) =>
  [...document.querySelectorAll('section')].find((s) => headingOf(s).toUpperCase() === name.toUpperCase())
const isFilterSection = (s: Element) => !!s.firstElementChild?.querySelector('svg') && !!headingOf(s)
const isOpen = (s: Element) => !!s.querySelector('input[type=checkbox], select')

async function open(s: Element) {
  if (isOpen(s)) return
  ;(s.firstElementChild?.firstElementChild as HTMLElement | null)?.click()
  await wait(300)
}

// The "126 MORE" pop-up (an A–Z grid of every brand) has no tick boxes, so options can't be
// ticked while it is open. It shows the letters "#ABC…XYZ".
const popupOpen = (s: Element) => /#?ABCDEFGHIJKLMNOPQRSTUVWXYZ/.test((s as HTMLElement).innerText.replace(/\s/g, ''))
// It has no close button (its ✕ only clears the search box), so fold the section and open it
// again, which brings back the normal list with tick boxes.
// force: also when it isn't recognisable by its letters (the Size "MORE" grid has none).
async function closeMorePopup(s: Element, force = false) {
  for (let attempt = 0; attempt < 2 && (popupOpen(s) || (force && attempt === 0)); attempt++) {
    const heading = s.firstElementChild?.firstElementChild as HTMLElement | null
    heading?.click()
    await wait(400)
    if (!isOpen(s)) { heading?.click(); await wait(500) }
  }
}

const priceSelects = () => [...(findSection('Price')?.querySelectorAll('select') ?? [])]

// React ignores a plain `select.value = x`; set it the way a real user change would.
function choose(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

// Wait until Flipkart has applied the change: the URL changes first, then the page re-renders.
// Clicking again before it is quiet can make Flipkart drop the previous filter, so wait until
// nothing has changed on the page for 0.7 s (max 6 s).
async function waitForUpdate(before: string) {
  for (let i = 0; i < 40 && location.href === before; i++) await wait(100)
  let last = Date.now()
  const watcher = new MutationObserver(() => (last = Date.now()))
  watcher.observe(document.body, { childList: true, subtree: true })
  const start = Date.now()
  while (Date.now() - last < 700 && Date.now() - start < 6000) await wait(100)
  watcher.disconnect()
}

// Is this filter really applied? Flipkart lists every active filter in the URL
// (p[]=facets.brand[]=PUMA, p[]=facets.price_range.to=2000), so check there.
const pageUrl = () => decodeURIComponent(decodeURIComponent(location.href)).replace(/\+/g, ' ')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Options found already ticked on the page. Flipkart ticks the brand of a brand search by itself
// ("nike running shoes" → NIKE) without putting it in the URL, so the URL check alone misses it.
const tickedOnPage = new Set<string>()
const key = (c: FilterChoice) => `${c.group}\n${c.option}`.toUpperCase()
function isApplied(c: FilterChoice) {
  if (tickedOnPage.has(key(c))) return true
  if (c.group === MIN_PRICE || c.group === MAX_PRICE) {
    const select = priceSelects()[c.group === MIN_PRICE ? 0 : 1]
    const value = select && [...select.options].find((o) => o.text === c.option)?.value
    return !!value && pageUrl().includes(`price_range.${c.group === MIN_PRICE ? 'from' : 'to'}=${value}`)
  }
  return new RegExp(String.raw`\]=${escapeRe(c.option)}(&|$)`, 'i').test(pageUrl())
}

export const flipkart: SiteAdapter = {
  name: 'Flipkart',
  matches: (url) => url.hostname.endsWith('flipkart.com'),
  // Category pages have no ?q=, so fall back to the page path ("/mens-footwear/sports-shoes/pr").
  searchTerm: () => new URL(location.href).searchParams.get('q') ?? location.pathname.replace(/[/-]/g, ' '),
  searchUrl: (text) => `https://www.flipkart.com/search?q=${encodeURIComponent(text)}`,
  // Result cards (class names change often, so: the card's product link and its first ₹ amount).
  products: (): Product[] =>
    [...document.querySelectorAll<HTMLElement>('div[data-id]')]
      .map((c) => {
        const link = c.querySelector<HTMLAnchorElement>('a[href*="/p/"]')
        const text = c.innerText.replace(/\s+/g, ' ')
        // "Ad" only as a whole word: "Adidas …" is a product, not an advert.
        const ad = /^\s*(Sponsored|Ad)\b/i.test(text)
        const title = link?.title || c.querySelector('img')?.alt || text.split('₹')[0].replace(/^\s*(Sponsored|Ad)\b\s*/i, '').trim()
        return { title, price: firstPrice(text), url: link ? new URL(link.getAttribute('href')!, location.href).href : '', ad }
      })
      .filter((p) => !p.ad && p.title && p.price > 0 && p.url)
      .map(({ title, price, url }) => ({ title, price, url })),

  async extractFilters(): Promise<FilterGroup[]> {
    // Open every collapsed section so its options appear in the page.
    for (const s of document.querySelectorAll('section')) {
      if (isFilterSection(s) && !isOpen(s)) {
        ;(s.firstElementChild?.firstElementChild as HTMLElement | null)?.click()
        await wait(150)
      }
    }
    await wait(500)

    const groups: FilterGroup[] = []
    for (const s of document.querySelectorAll('section')) {
      if (!isFilterSection(s)) continue
      const options = [...s.querySelectorAll<HTMLElement>('div[title]')]
        .filter((d) => d.querySelector('input[type=checkbox]'))
        .map((d) => d.title)
      // Long lists show ~6 options plus "126 MORE", which opens a grid of every option.
      // Read the full list from it, then close it. (Applying uses the section's search box.)
      const more = [...s.querySelectorAll<HTMLElement>('span')].find((e) => /^\d+ MORE$/i.test(e.textContent?.trim() ?? ''))
      if (more) {
        more.click()
        await wait(900)
        for (const d of s.querySelectorAll<HTMLElement>('div[title]')) if (!options.includes(d.title)) options.push(d.title)
        await closeMorePopup(s)
      }
      if (options.length) groups.push({ name: headingOf(s), options })
    }
    const [min, max] = priceSelects()
    if (min && max) {
      groups.push({ name: MIN_PRICE, options: [...min.options].map((o) => o.text) })
      groups.push({ name: MAX_PRICE, options: [...max.options].map((o) => o.text) })
    }
    groups.push({ name: SORT_GROUP, options: Object.keys(SORT) })
    return groups
  },

  async applyFilters(choices: FilterChoice[]) {
    if (choices.some((c) => c.group === '*')) {
      setTimeout(() => location.assign(flipkart.searchUrl(flipkart.searchTerm())), 50) // "clear all filters"
      return []
    }
    const adds = choices.filter((c) => !c.remove && c.group !== SORT_GROUP)
    // Min price before max price: changing the minimum resets Flipkart's maximum.
    const rank = (c: FilterChoice) => (c.group === MIN_PRICE ? 0 : c.group === MAX_PRICE ? 1 : 2)
    const ordered = [...adds].sort((a, b) => rank(a) - rank(b))
    // Apply, then check the page really kept each one; retry the ones it dropped (2 more rounds).
    for (let round = 0; round < 3; round++) {
      const todo = ordered.filter((c) => !isApplied(c))
      if (!todo.length) break
      for (const c of todo) await applyOne(c)
    }
    const missing = ordered.filter((c) => !isApplied(c))

    // Removing and sorting: edit the URL (p[]=facets.brand[]=PUMA, sort=price_asc) and reload once.
    const removes = choices.filter((c) => c.remove)
    const sort = choices.find((c) => c.group === SORT_GROUP && !c.remove)
    if (removes.length || sort) {
      const url = new URL(location.href)
      const entries = url.searchParams.getAll('p[]')
      const values = (c: FilterChoice): string[] => {
        if (c.option !== '*') return [c.option]
        // A whole group: the options currently ticked in that section.
        const s = findSection(c.group)
        return s ? [...s.querySelectorAll<HTMLElement>('div[title]')].filter((d) => d.querySelector('input:checked')).map((d) => d.title) : []
      }
      const drop = (entry: string) => {
        const e = decodeURIComponent(entry).replace(/\+/g, ' ')
        return removes.some((c) => {
          if (c.group === MIN_PRICE || (c.group.toLowerCase().includes('price') && c.option === '*')) if (e.startsWith('facets.price_range.from')) return true
          if (c.group === MAX_PRICE || (c.group.toLowerCase().includes('price') && c.option === '*')) if (e.startsWith('facets.price_range.to')) return true
          return values(c).some((v) => e.toLowerCase().endsWith(`]=${v.toLowerCase()}`))
        })
      }
      url.searchParams.delete('p[]')
      for (const e of entries) if (!drop(e)) url.searchParams.append('p[]', e)
      if (sort && SORT[sort.option]) url.searchParams.set('sort', SORT[sort.option])
      if (url.toString() !== location.href) setTimeout(() => location.assign(url.toString()), 50)
    }
    return missing
  },
}

// Flipkart's sort values (sort= in the URL).
const SORT: Record<string, string> = {
  [SORT_LABELS.price_asc]: 'price_asc',
  [SORT_LABELS.price_desc]: 'price_desc',
  [SORT_LABELS.newest]: 'recency_desc',
  [SORT_LABELS.popularity]: 'popularity',
}

// Applies one filter (one click or one price dropdown change).
async function applyOne(c: FilterChoice) {
  const before = location.href

  if (c.group === MIN_PRICE || c.group === MAX_PRICE) {
    const s = findSection('Price')
    if (s) await open(s)
    const select = priceSelects()[c.group === MIN_PRICE ? 0 : 1]
    const opt = select && [...select.options].find((o) => o.text === c.option)
    if (!opt) return
    if (select.value !== opt.value) { choose(select, opt.value); await waitForUpdate(before) }
    return
  }

  // The sidebar may still be redrawing after the previous filter, so look up the
  // section fresh and retry a few times.
  let box: HTMLElement | undefined
  for (let attempt = 0; attempt < 3 && !box; attempt++) {
    if (attempt) await wait(800)
    const s = findSection(c.group)
    if (!s) continue
    await closeMorePopup(s) // in case it is still open from reading the filters
    await open(s)
    const findBox = () => [...s.querySelectorAll<HTMLElement>('div[title]')].find((d) => d.title === c.option)
    box = findBox()
    // Found, but without a tick box: the section is still showing its "MORE" grid. Reset it
    // (fold and open again) and look again on the next attempt.
    if (box && !box.querySelector('input[type=checkbox]') && attempt < 2) {
      await closeMorePopup(s, true)
      box = undefined
      continue
    }
    // Long lists (Brand) only show a few options; type into the section's search box to reveal it.
    const search = s.querySelector<HTMLInputElement>('input[type=text]')
    if (!box && search) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, c.option)
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(800)
      box = findBox()
    }
    // No search box (Size): open "12 MORE"; a freshly opened grid has tick boxes.
    if (!box) {
      const more = [...s.querySelectorAll<HTMLElement>('span')].find((e) => /^\d+ MORE$/i.test(e.textContent?.trim() ?? ''))
      if (more) { more.click(); await wait(900); box = findBox() }
    }
  }
  const input = box?.querySelector<HTMLInputElement>('input[type=checkbox]')
  if (input?.checked && location.href === before && !isApplied(c)) tickedOnPage.add(key(c)) // ticked by Flipkart itself
  else if (input && !input.checked) { (box!.querySelector('label') ?? box!).click(); await waitForUpdate(before) }
  // In the A–Z "MORE" grid an option can be a bare name with no tick box: clicking the name
  // ticks it there. (isApplied checks the URL afterwards, and the caller retries if it didn't.)
  else if (box && !input) {
    const name = [...box.querySelectorAll<HTMLElement>('div')].find((d) => !d.children.length && d.textContent?.trim() === c.option) ?? box
    name.click()
    await waitForUpdate(before)
  }
}
