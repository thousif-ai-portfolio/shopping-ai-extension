// Comparing prices across shops (the named ones, or every well-known shop selling that kind of
// product, see compareTargets in product.ts): the panel runs the same search and the
// same filters on each site, sorted cheapest first, then calls summarize() on what it found.
// The sites share no product ids, so this compares the cheapest MATCHING item on each site,
// not the identical product.
import { SORT_GROUP, type FilterChoice, type Product } from '../adapters/types'
import { COLOURS, productIn, titleIsProduct } from './product'

export type SiteResult = {
  site: string
  /** Filters that really got applied on that site. */
  applied: FilterChoice[]
  /** The site's results page after filtering (to open the winner). */
  url: string
  products: Product[]
  error?: string
}

type Row = SiteResult & { cheapest?: Product; lacking: string[]; counted: boolean }
export type Summary = { rows: Row[]; winner?: Row; text: string }

// The kind of filter, to see whether every site got the same request.
const KINDS: [string, RegExp][] = [['brand', /brand/i], ['colour', /colou?r/i], ['size', /size/i], ['price', /price/i]]
const kindsOf = (applied: FilterChoice[]) =>
  KINDS.filter(([, re]) => applied.some((c) => !c.remove && c.group !== SORT_GROUP && re.test(c.group))).map(([k]) => k)

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const mentions = (title: string, name: string) => ` ${words(title)} `.includes(` ${words(name)} `)

// Words naming a kind of product that titles also use, by their stem ("running" → "run").
const KIND_STEMS: Record<string, string> = {
  running: 'run', walking: 'walk', formal: 'formal', casual: 'casual', sports: 'sport', sport: 'sport', trekking: 'trek',
  hiking: 'hik', gym: 'gym', training: 'train', party: 'party', wireless: 'wireless', bluetooth: 'bluetooth', smart: 'smart',
}

/** search: the words every site was searched for ("black shirt roadster"). */
export function summarize(results: SiteResult[], search = ''): Summary {
  // What any site managed to apply: a site missing one of these compared something else.
  const wanted = new Set(results.flatMap((r) => kindsOf(r.applied)))
  // A colour that is in the search words is already in every site's results ("black shirt …").
  const colourSearched = results.some((r) => r.applied.some((c) => /colou?r/i.test(c.group) && mentions(search, c.option.replace(/s$/i, ''))))
  // Brands any site ticked, to recognise them in product titles where the brand filter is missing.
  const brands = [...new Set(results.flatMap((r) => r.applied.filter((c) => !c.remove && /brand/i.test(c.group)).map((c) => c.option)))]
  const product = productIn(search)
  const kinds = words(search).split(' ').map((w) => KIND_STEMS[w]).filter(Boolean)
  // Search words naming the item (brand, material…): not the product word, a colour (a filter
  // covers those), a kind word (checked above) or a number. Matched by their start ("roadster"
  // also in "Roadsters"), so a plural or a different ending still counts.
  const productWords = new Set((product ?? []).flatMap((w) => [w, `${w}s`, `${w}es`]))
  const required = words(search).split(' ').filter((w) =>
    w.length >= 3 && !/^\d/.test(w) && !productWords.has(w) && !COLOURS.includes(w) && !KIND_STEMS[w]).map((w) => w.slice(0, Math.max(3, w.length - 2)))
  // The budget any site applied ("Max price: ₹2000"). Every product card shows its price, so a
  // site without a price filter (Myntra) is checked against the budget item by item instead.
  const amount = (re: RegExp) => results.flatMap((r) => r.applied.filter((c) => !c.remove && re.test(c.group)).map((c) => Number(c.option.replace(/[^\d]/g, '')))).filter((n) => n > 0)
  const max = Math.min(...amount(/max price/i), Infinity)
  const min = Math.max(...amount(/min price/i), 0)
  const rows: Row[] = results.map((r) => {
    const got = kindsOf(r.applied)
    let lacking = [...wanted].filter((k) => !got.includes(k) && !(k === 'colour' && colourSearched) && k !== 'price')
    // Only items of the asked product type: sites pad cheap results with other things ("sliders"),
    // and of the asked kind when one is named ("running" shoes, not court sneakers).
    let items = (product ? r.products.filter((p) => titleIsProduct(p.title, product)) : r.products)
      .filter((p) => p.price <= max && p.price >= min)
    if (kinds.length) items = items.filter((p) => kinds.every((k) => ` ${words(p.title)} `.match(new RegExp(`\\b${k}`))))
    // The other words searched for must be in the title too: shops pad cheap results with other
    // brands ("puma jacket" sorted cheapest shows a NEONOMAD jacket first).
    if (required.length) items = items.filter((p) => required.every((w) => ` ${words(p.title)} `.includes(` ${w}`)))
    // No brand filter here: keep the items whose title shows the brand instead.
    if (lacking.includes('brand') && brands.length) {
      const branded = items.filter((p) => brands.some((b) => mentions(p.title, b)))
      if (branded.length) { items = branded; lacking = lacking.filter((k) => k !== 'brand') }
    }
    // The first results are the cheapest (sorted); take the lowest among them in case of a stray card.
    const cheapest = items.slice(0, 10).sort((a, b) => a.price - b.price)[0]
    return { ...r, cheapest, lacking, counted: !r.error && !!cheapest && lacking.length === 0 }
  })
  const pool = rows.filter((r) => r.counted)
  const winner = [...pool].sort((a, b) => a.cheapest!.price - b.cheapest!.price)[0]

  const lines = rows.map((r) => {
    if (r.error) return `• ${r.site}: couldn't check (${r.error})`
    if (!r.cheapest) return `• ${r.site}: no matching products`
    const price = `${rupees(r.cheapest.price)}, ${r.cheapest.title}`
    if (!r.counted) return `• ${r.site}: ${price}. Not compared: its ${r.lacking.join(' and ')} filter couldn't be applied there, so this may be a different item`
    if (r === winner) return `• ${r.site}: ${price} ✅ cheapest`
    return `• ${r.site}: ${price} (${rupees(r.cheapest.price - winner!.cheapest!.price)} more)`
  })
  const others = pool.filter((r) => r !== winner)
  const why = !winner
    ? 'No site had a product matching everything, so nothing was picked.'
    : others.length
      ? `Picked ${winner.site}: ${rupees(winner.cheapest!.price)}, which is ` +
        others.map((r) => `${rupees(r.cheapest!.price - winner.cheapest!.price)} less than ${r.site}`).join(' and ') + '.'
      : `Picked ${winner.site}: the only site with a matching product (${rupees(winner.cheapest!.price)}).`
  return { rows, winner, text: `${why}\n${lines.join('\n')}` }
}
