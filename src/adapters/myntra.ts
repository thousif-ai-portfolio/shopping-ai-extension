import { SORT_GROUP, SORT_LABELS, firstPrice, type FilterChoice, type FilterGroup, type Product, type SiteAdapter } from './types'

// How Myntra filters work (checked on the live page, Nov 2026):
// - Left sidebar: each group is .vertical-filters-filters with a .vertical-filters-header
//   (CATEGORIES, BRAND, COLOR, DISCOUNT RANGE). Options are <label> with a checkbox/radio,
//   text like "Roadster(2805)".
// - Top bar (.atsa-filters): more groups (Size, Country of Origin, ...). Clicking a title opens
//   its options in a single shared .atsa-values dropdown; only one is open at a time.
// - Ticking an option updates the page in place (no reload) and closes the top dropdown.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clean = (t: string) => t.replace(/\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim()
const optionLabels = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLLabelElement>('label')].filter((l) => l.querySelector('input'))

function sidebarGroups() {
  return [...document.querySelectorAll('.vertical-filters-filters')]
    .map((f) => ({
      name: f.querySelector('.vertical-filters-header')?.textContent?.trim() ?? '',
      labels: optionLabels(f),
      // Brand and Color show ~8 options plus "+ 272 more", which opens a list of all of them.
      more: f.querySelector<HTMLElement>('.brand-more, .colour-more, [class$="-more"]'),
    }))
    .filter((g) => g.name && g.labels.length)
}

// Opens the "+ N more" list for a sidebar group and returns its option labels.
async function openMore(more: HTMLElement) {
  more.click()
  await wait(800)
  return optionLabels(document.querySelector('.FilterDirectory-panel') ?? document.createElement('div'))
}
async function closeMore() {
  document.querySelector<HTMLElement>('.FilterDirectory-close')?.click()
  await wait(300)
}

const topTitles = () =>
  [...document.querySelectorAll<HTMLLabelElement>('.atsa-filters label')].filter((l) =>
    l.querySelector('.atsa-title'),
  )
// The top bar shows ~7 groups plus "+ 20 more"; click it so every group is listed.
async function showAllTop() {
  const more = document.querySelector<HTMLElement>('.atsa-more')
  if (more) {
    more.click()
    await wait(400)
  }
}

const topValues = () => optionLabels(document.querySelector('.atsa-values') ?? document.createElement('div'))

// Opens one top-bar group and returns its option labels.
async function openTop(title: HTMLLabelElement) {
  title.click()
  await wait(350)
  // If it was already open, that click closed it; click again.
  if (!topValues().length) {
    title.click()
    await wait(350)
  }
  return topValues()
}

// Finds the option's label; `inMore` means it was found in the "+ more" list, to close afterwards.
async function findOption(c: FilterChoice): Promise<{ label?: HTMLLabelElement; inMore?: boolean }> {
  const byText = (l: HTMLLabelElement) => clean(l.textContent ?? '') === c.option
  const side = sidebarGroups().find((g) => g.name === c.group)
  if (side) {
    const label = side.labels.find(byText)
    if (label || !side.more) return { label }
    const fromMore = (await openMore(side.more)).find(byText)
    if (!fromMore) await closeMore()
    return { label: fromMore, inMore: true }
  }
  await showAllTop()
  const title = topTitles().find((t) => t.textContent?.trim() === c.group)
  if (title) return { label: (await openTop(title)).find(byText) }
  return {}
}

export const myntra: SiteAdapter = {
  name: 'Myntra',
  matches: (url) => url.hostname.endsWith('myntra.com'),
  // Category pages ("/men-sports-shoes") may have no ?rawQuery=, so fall back to the path.
  searchTerm: () => new URL(location.href).searchParams.get('rawQuery') ?? location.pathname.replace(/[/-]/g, ' '),
  searchUrl: (text) =>
    `https://www.myntra.com/${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}?rawQuery=${encodeURIComponent(text)}`,
  // Result cards: brand + name, and the first "Rs." amount (the selling price).
  products: (): Product[] =>
    [...document.querySelectorAll<HTMLElement>('li.product-base')]
      .map((c) => ({
        title: `${c.querySelector('.product-brand')?.textContent ?? ''} ${c.querySelector('.product-product')?.textContent ?? ''}`.trim(),
        price: firstPrice(c.querySelector('.product-price, .product-discountedPrice')?.textContent ?? ''),
        url: new URL(c.querySelector('a')?.getAttribute('href') ?? '', location.href).href,
      }))
      .filter((p) => p.title && p.price > 0),

  async extractFilters(): Promise<FilterGroup[]> {
    const groups: FilterGroup[] = []
    for (const g of sidebarGroups()) {
      const options = g.labels.map((l) => clean(l.textContent ?? ''))
      if (g.more) {
        for (const l of await openMore(g.more)) {
          const o = clean(l.textContent ?? '')
          if (o && !options.includes(o)) options.push(o)
        }
        await closeMore()
      }
      groups.push({ name: g.name, options })
    }
    await showAllTop()
    for (const title of topTitles()) {
      const options = (await openTop(title)).map((l) => clean(l.textContent ?? ''))
      if (options.length) groups.push({ name: title.textContent!.trim(), options })
    }
    groups.push({ name: SORT_GROUP, options: Object.keys(SORT) })
    return groups
  },

  async applyFilters(all: FilterChoice[]) {
    if (all.some((c) => c.group === '*')) {
      setTimeout(() => location.assign(myntra.searchUrl(myntra.searchTerm())), 50) // "clear all filters"
      return []
    }
    const choices = all.filter((c) => !c.remove && c.group !== SORT_GROUP)
    const missing = await applyAdds(choices)
    // Removing and sorting: edit the URL and reload once.
    const removes = all.filter((c) => c.remove)
    const sort = all.find((c) => c.group === SORT_GROUP && !c.remove)
    if (removes.length || sort) {
      const url = new URL(location.href)
      const f = (url.searchParams.get('f') ?? '').split('::').filter(Boolean).map((part) => {
        const [key, values = ''] = part.split(/:(.*)/)
        return { key, values: values.split(',').filter(Boolean) }
      })
      const sameGroup = (key: string, group: string) =>
        key.toLowerCase().replace(/_facet$/, '') === group.toLowerCase().replace(/s$/, '') ||
        key.toLowerCase() === group.toLowerCase()
      for (const c of removes) {
        if (/discount/i.test(c.group)) { url.searchParams.delete('rf'); continue }
        for (const part of f) {
          if (c.option === '*') { if (sameGroup(part.key, c.group)) part.values = [] }
          else part.values = part.values.filter((v) => v.replace(/_[0-9a-f]{6}$/i, '').toLowerCase() !== c.option.toLowerCase())
        }
      }
      const kept = f.filter((p) => p.values.length).map((p) => `${p.key}:${p.values.join(',')}`).join('::')
      if (kept) url.searchParams.set('f', kept)
      else url.searchParams.delete('f')
      if (sort && SORT[sort.option]) url.searchParams.set('sort', SORT[sort.option])
      if (url.toString() !== location.href) setTimeout(() => location.assign(url.toString()), 50)
    }
    return missing
  },
}

// Myntra's sort values (sort= in the URL).
const SORT: Record<string, string> = {
  [SORT_LABELS.price_asc]: 'price_asc',
  [SORT_LABELS.price_desc]: 'price_desc',
  [SORT_LABELS.newest]: 'new',
  [SORT_LABELS.popularity]: 'popularity',
  [SORT_LABELS.rating]: 'Customer Rating',
}

async function applyAdds(choices: FilterChoice[]) {
  // Apply, then check the page really kept each one; retry the ones it dropped (2 more rounds).
  for (let round = 0; round < 3; round++) {
    const todo = choices.filter((c) => !isApplied(c))
    if (!todo.length) break
    for (const c of todo) {
      const { label, inMore } = await findOption(c)
      if (!label || label.querySelector('input')?.checked) { if (inMore) await closeMore(); continue }
      // Myntra changes the URL at once but loads results later; clicking again before
      // that loses the earlier filter. So wait until the product list has changed (max 8s).
      const results = () => document.querySelector('.results-base')?.innerHTML
      const before = results()
      label.click()
      for (let i = 0; i < 80 && results() === before; i++) await wait(100)
      await wait(700)
      if (inMore) await closeMore()
    }
  }
  return choices.filter((c) => !isApplied(c))
}

// Is this filter really applied? Myntra lists active filters in the URL:
// f=Brand:ADIDAS,Puma::Color:Pink_f1a9c4::size_facet:UK9 and rf=Discount Range:40.0_100.0_…
function isApplied(c: FilterChoice) {
  const url = decodeURIComponent(location.href).replace(/\+/g, ' ')
  if (/discount/i.test(c.group)) {
    const n = c.option.match(/\d+/)?.[0]
    return !!n && url.includes(`Discount Range:${n}.0_`)
  }
  const option = c.option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Colours carry a code after the name ("Black_36454f").
  return new RegExp(String.raw`[:,]${option}(_[0-9a-f]{6})?(::|,|&|$)`, 'i').test(url)
}
