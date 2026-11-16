// One filter section on a page, e.g. { name: "Brand", options: ["Puma", "Nike"] }
export type FilterGroup = { name: string; options: string[] }

// One filter the AI picked, e.g. { group: "Brand", option: "Puma" }.
// remove: take it off instead ("remove puma"). option "*" = the whole group; group "*" = all filters.
// The group "Sort by" sets the order ("Price: Low to High").
export type FilterChoice = { group: string; option: string; remove?: boolean }

// A "Min price" / "Max price" option meaning "any amount can be set" (Amazon's URL takes any price).
export const ANY_AMOUNT = '₹…'

// Sort options use the same labels on every site; each adapter maps them to its own URL value.
export const SORT_GROUP = 'Sort by'
export const SORT_LABELS = {
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  newest: 'Newest First',
  popularity: 'Popularity',
  rating: 'Customer Rating',
} as const

// Every site (Amazon, Flipkart, Myntra) implements this same shape.
export interface SiteAdapter {
  name: string
  matches(url: URL): boolean
  extractFilters(): Promise<FilterGroup[]>
  /** Clicks the filters; returns the ones it could not find. */
  applyFilters(choices: FilterChoice[]): Promise<FilterChoice[]>
  /** What the page is currently showing results for, e.g. "jacket men". */
  searchTerm(): string
  /** The site's search page for some text. */
  searchUrl(text: string): string
  /** The products listed on the page, in page order (for comparing prices across sites). */
  products(): Product[]
}

// One product card on a results page.
export type Product = { title: string; price: number; url: string }

// "₹1,299", "Rs. 319Rs. 999" → 1299, 319 (the first amount: the selling price, before the struck-out MRP)
export const firstPrice = (text: string): number => {
  const m = text.replace(/\s+/g, ' ').match(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/)
  return m ? Number(m[1].replace(/,/g, '')) : NaN
}

// What the content script reports about the page (the reply to GET_FILTERS).
export type Page = { site: string; filters: FilterGroup[]; searchTerm: string }

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Navigate a moment later, so the reply to the side panel is sent first.
export const navigateSoon = (href: string) => setTimeout(() => location.assign(href), 50)
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Messages between the side panel and the content script.
export type Message =
  | { type: 'GET_FILTERS' }
  | { type: 'APPLY_FILTERS'; choices: FilterChoice[] }
  | { type: 'SEARCH'; text: string }
  | { type: 'NO_RESULTS' }
  | { type: 'GET_PRODUCTS' }
