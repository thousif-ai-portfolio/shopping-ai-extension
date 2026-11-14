import { ANY_AMOUNT, SORT_GROUP, SORT_LABELS, firstPrice, type FilterChoice, type FilterGroup, type Product, type SiteAdapter } from './types'

// How Amazon.in filters work (checked on the live page, Nov 2026):
// - Each filter group is <div id="filter-p_123"> and its heading is <div id="p_123-title">.
// - Each option is a link whose URL has  rh=p_123:363771  (group key : option id).
// - Several filters together:  rh=p_123:111|222,p_36:-200000
//   ("|" = more options in the same group, "," = another group).
// So we apply filters by building that rh value and loading one URL,
// instead of clicking checkboxes (each click reloads the page).

// Groups where only one option makes sense (price range, star rating, ...).
const SINGLE_CHOICE = new Set([
  'p_36', 'p_72', 'p_90', 'p_n_pct-off-with-tax', 'p_n_date_first_available_absolute',
])

type Option = { group: string; key: string; label: string; rh: string }

const MIN_PRICE = 'Min price'
const MAX_PRICE = 'Max price'
const PRICE_STEPS = [300, 500, 700, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000]

function readOptions(): Option[] {
  const out: Option[] = []
  for (const box of document.querySelectorAll<HTMLElement>('#s-refinements [id^="filter-p_"]')) {
    const key = box.id.slice('filter-'.length)
    // Price (p_36) has a slider instead of a title element.
    const group =
      document.getElementById(`${key}-title`)?.textContent?.trim() || (key === 'p_36' ? 'Price' : '')
    if (!group) continue

    for (const a of box.querySelectorAll<HTMLAnchorElement>('li a[href*="rh="]')) {
      const rh = new URL(a.href).searchParams.get('rh') ?? ''
      // The link's rh can also contain filters already active; keep only this group's part.
      // An option that is already active links to the page *without* it, so it may have no part
      // for its group; keep it anyway (with rh ''), so it can be named in "remove nike".
      const part = rh.split(',').find((p) => p.startsWith(`${key}:`)) ?? ''
      // Colour swatches have no text, only a title attribute.
      const label = (
        a.title ||
        a.querySelector('span.a-size-base')?.textContent ||
        a.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim()
      if (label) out.push({ group, key, label, rh: part })
    }
  }
  return out
}

// Amazon's sort values (the "Sort by" dropdown, s= in the URL).
const SORT: Record<string, string> = {
  [SORT_LABELS.price_asc]: 'price-asc-rank',
  [SORT_LABELS.price_desc]: 'price-desc-rank',
  [SORT_LABELS.newest]: 'date-desc-rank',
  [SORT_LABELS.rating]: 'review-rank',
  [SORT_LABELS.popularity]: 'exact-aware-popularity-rank',
}

// The filters already on the page: Map<groupKey, Set<optionId>> from rh=p_123:1|2,p_36:-200000
function currentRh(url: URL) {
  const rh = new Map<string, Set<string>>()
  for (const part of (url.searchParams.get('rh') ?? '').split(',').filter(Boolean)) {
    const [key, values] = part.split(':')
    rh.set(key, new Set(values?.split('|').filter(Boolean)))
  }
  return rh
}

// Option ids applied in this tab, by "Group|Label" (session storage survives page loads in the tab).
// Needed to remove a filter when its list is hidden, e.g. on a page with zero results.
const MEMORY_KEY = 'ai-shopping-filters-ids'
const memory = (): Record<string, string> => {
  try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) ?? '{}') } catch { return {} }
}
const rememberId = (group: string, label: string, keyAndId: string) => {
  try { sessionStorage.setItem(MEMORY_KEY, JSON.stringify({ ...memory(), [`${group}|${label}`]: keyAndId })) } catch { /* storage blocked */ }
}

// Which option ids an active option has. An active option's link is the URL *without* it,
// so the ids it adds are the ones in the current URL but not in its link.
function activeIds(group: string, label: string, rh: Map<string, Set<string>>): [string, string[]] | null {
  for (const box of document.querySelectorAll<HTMLElement>('#s-refinements [id^="filter-p_"]')) {
    const key = box.id.slice('filter-'.length)
    const name = document.getElementById(`${key}-title`)?.textContent?.trim() || (key === 'p_36' ? 'Price' : '')
    if (name !== group) continue
    for (const a of box.querySelectorAll<HTMLAnchorElement>('li a[href*="rh="], li a')) {
      const text = (a.title || a.querySelector('span.a-size-base')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim()
      if (text !== label) continue
      const linkIds = currentRh(new URL(a.href, location.href)).get(key) ?? new Set()
      return [key, [...(rh.get(key) ?? [])].filter((id) => !linkIds.has(id))]
    }
  }
  return null
}

export const amazon: SiteAdapter = {
  name: 'Amazon',
  matches: (url) => url.hostname.endsWith('amazon.in'),
  searchTerm: () => new URL(location.href).searchParams.get('k') ?? '',
  searchUrl: (text) => `https://www.amazon.in/s?k=${encodeURIComponent(text)}`,
  // Result cards; sponsored ones are skipped (they ignore the sort order).
  products: (): Product[] =>
    [...document.querySelectorAll<HTMLElement>('[data-component-type="s-search-result"]')]
      .filter((c) => !/\bSponsored\b/.test(c.innerText))
      .map((c) => ({
        title: (c.querySelector('[data-cy="title-recipe"]') ?? c.querySelector('h2'))?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        price: firstPrice(c.querySelector('.a-price .a-offscreen')?.textContent ?? ''),
        url: new URL(c.querySelector('h2 a, a.a-link-normal')?.getAttribute('href') ?? '', location.href).href,
      }))
      .filter((p) => p.title && p.price > 0),

  async extractFilters(): Promise<FilterGroup[]> {
    const groups = new Map<string, Set<string>>()
    for (const o of readOptions()) {
      if (!groups.has(o.group)) groups.set(o.group, new Set())
      groups.get(o.group)!.add(o.label)
    }
    // Amazon's own price buttons are fixed ranges, but its URL accepts any range
    // (p_36:<min>-<max> in paise), so offer exact min/max steps too. ANY_AMOUNT tells the
    // matcher that any amount works here ("under 1800" → exactly ₹1800).
    return [
      ...[...groups].map(([name, options]) => ({ name, options: [...options] })),
      { name: MIN_PRICE, options: [...PRICE_STEPS.map((n) => `₹${n}`), ANY_AMOUNT] },
      { name: MAX_PRICE, options: [...PRICE_STEPS.map((n) => `₹${n}`), ANY_AMOUNT] },
      { name: SORT_GROUP, options: Object.keys(SORT) },
    ]
  },

  // Everything (adding, removing, price, sort) goes into one new URL, loaded once.
  async applyFilters(choices: FilterChoice[]) {
    const go = (href: string) => setTimeout(() => location.assign(href), 50) // after the reply is sent
    if (choices.some((c) => c.group === '*')) {
      go(amazon.searchUrl(amazon.searchTerm())) // "clear all filters"
      return []
    }
    const url = new URL(location.href)
    const rh = currentRh(url)
    const options = readOptions()
    const missing: FilterChoice[] = []
    // Keep the other side of an existing price range ("under 2000", then "above 1000").
    const [min0 = '', max0 = ''] = [...(rh.get('p_36') ?? [])][0]?.split('-') ?? []
    const price = { min: min0, max: max0 }

    for (const c of choices) {
      if (c.group === SORT_GROUP) {
        if (SORT[c.option]) url.searchParams.set('s', SORT[c.option])
      } else if (c.group === MIN_PRICE || c.group === MAX_PRICE || (c.group === 'Price' && c.remove)) {
        const side = c.group === MIN_PRICE ? 'min' : 'max'
        if (c.group === 'Price') price.min = price.max = ''
        else price[side] = c.remove ? '' : String(Number(c.option.replace(/\D/g, '')) * 100)
      } else if (c.remove && c.option === '*') {
        const key =
          options.find((o) => o.group === c.group)?.key ??
          Object.entries(memory()).find(([k]) => k.startsWith(`${c.group}|`))?.[1].split(':')[0]
        if (key) rh.delete(key)
      } else if (c.remove) {
        const found = activeIds(c.group, c.option, rh)
        if (found?.[1].length) for (const id of found[1]) rh.get(found[0])?.delete(id)
        else {
          // The list is hidden (zero results): use the id remembered when it was applied.
          const [key, id] = memory()[`${c.group}|${c.option}`]?.split(':') ?? []
          if (key && id) rh.get(key)?.delete(id)
        }
      } else {
        const o = options.find((o) => o.group === c.group && o.label === c.option)
        if (!o) { missing.push(c); continue }
        if (!o.rh || activeIds(c.group, c.option, rh)?.[1].length) continue // already applied
        const id = o.rh.slice(o.key.length + 1)
        for (const one of id.split('|')) rememberId(c.group, c.option, `${o.key}:${one}`)
        if (SINGLE_CHOICE.has(o.key) || !rh.has(o.key)) rh.set(o.key, new Set([id]))
        else rh.get(o.key)!.add(id)
      }
    }
    if (price.min || price.max) rh.set('p_36', new Set([`${price.min}-${price.max}`]))
    else rh.delete('p_36')

    const parts = [...rh].filter(([, ids]) => ids.size).map(([k, ids]) => `${k}:${[...ids].join('|')}`)
    if (parts.length) url.searchParams.set('rh', parts.join(','))
    else url.searchParams.delete('rh')
    for (const junk of ['qid', 'rnid', 'ref', 'ds']) url.searchParams.delete(junk)
    if (url.toString() !== location.href) go(url.toString())
    return missing
  },
}
