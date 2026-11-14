// Decides whether a request is for a different product than the page shows
// ("give me running shoes" on a jackets page), and what to search for then.

// Product words (singular). Words in one group mean the same product.
const PRODUCTS: string[][] = [
  ['shoe', 'sneaker', 'footwear', 'joota', 'joote', 'jutti'], ['sandal', 'slipper', 'flip flop', 'chappal'], ['boot'], ['heel'],
  ['jacket', 'coat', 'blazer'], ['hoodie', 'sweatshirt'], ['sweater', 'cardigan'],
  ['tshirt', 't shirt', 'tee'], ['shirt'], ['jean'], ['trouser', 'pant', 'chino'], ['track pant', 'jogger'],
  ['kurta', 'kurti'], ['saree', 'sari'], ['lehenga'], ['dress', 'gown'], ['skirt'], ['legging'],
  ['phone', 'mobile', 'smartphone', 'iphone'], ['laptop', 'notebook'], ['tablet', 'ipad'],
  ['watch', 'smartwatch'], ['headphone', 'earphone', 'earbud', 'headset'], ['speaker'], ['tv', 'television'],
  ['bag', 'backpack', 'handbag'], ['wallet'], ['belt'], ['sunglass'], ['perfume'], ['cap', 'hat'],
]

const norm = (s: string) =>
  s.toLowerCase().replace(/t-shirt/g, 'tshirt').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')

const has = (text: string, word: string) => ` ${text} `.includes(` ${word} `)

// One letter wrong, missing or extra ("shirst", "jaket", "sheos" is two, not caught).
function oneOff(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1 || a === b) return a === b
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}
// Real words that are one letter from a product word but mean something else.
const NOT_TYPO = new Set(['short', 'shorts', 'sheet', 'shift', 'sport', 'skirt', 'coach', 'boat', 'bat', 'beg', 'cat', 'hate', 'heal', 'jean', 'pent', 'paint', 'walet', 'bell', 'bolt', 'wash'])
/** Turns misspelt product words into the real ones: "white shirst" → "white shirt". */
export function fixProductTypos(text: string): string {
  const all = PRODUCTS.flat().filter((w) => w.length >= 4 && !w.includes(' '))
  return text.replace(/[a-z]+/gi, (w) => {
    const lower = w.toLowerCase()
    if (lower.length < 5 || NOT_TYPO.has(lower) || all.includes(lower) || all.includes(lower.replace(/s$/, ''))) return w
    const fix = all.find((p) => oneOff(lower, p) || oneOff(lower, p + 's'))
    return fix ?? w
  })
}

/** Does a product title name this kind of product? ("Nike Men Sliders" is not a running shoe.) */
export function titleIsProduct(title: string, group: string[]): boolean {
  const t = norm(title)
  return group.some((w) => has(t, w))
}

/** The product group the text mentions (e.g. ['shoe', 'sneaker', 'footwear']), if any. */
export function productIn(text: string): string[] | undefined {
  const t = norm(fixProductTypos(text))
  return PRODUCTS.find((group) => group.some((w) => has(t, w)))
}

// Colours, to notice "white shirt" asked on a "maroon shirt" page (same product, different colour).
const COLOURS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'beige',
  'maroon', 'merun', 'maroun', 'navy', 'olive', 'khaki', 'cream', 'gold', 'silver', 'peach', 'teal', 'mustard', 'lavender', 'wine']
const SAME_COLOUR: Record<string, string> = { merun: 'maroon', maroun: 'maroon', gray: 'grey', wine: 'maroon' }
const coloursIn = (text: string) => COLOURS.filter((c) => has(norm(text), c)).map((c) => SAME_COLOUR[c] ?? c)

// Words that only make the request polite or are read as filters, not search words.
const FILLER = new Set(
  (
    'give me show find get buy i want need looking look for some a an the please pls plz can could would will you u to see any ' +
    'something with in of and or open go take switch search check on at from which that what is are there do does have has ' +
    'i\'m im my also just now then hey hi hello bro bhai ji kindly mujhe chahiye dikhao do pe par mein site website app store ' +
    'rupees rupee rs inr only compare comparison better best all fo fr pls which whichever good nice is it this ' +
    'tell suggest recommend ' +
    // price and sort words: they become a sort order or a price filter, never search words
    'lower lowest low price prices cheap cheaper cheapest sasta saste sasti costly expensive high higher highest ' +
    'than across sites websites apps stores platforms every each both three teen teeno tino sab sabhi vs versus ' +
    // Hinglish joining and price words: "dono pe check karo", "sabse sasta", "1000 se kam"
    'karo kar karna karke dono aur sabse me main ke andar se kam tak wala wali wale hai hain ' +
    'amazon amzon amazone amazn amozon flipkart flipcart flipkrt filpkart flipkat myntra mintra myntr mynta'
  ).split(' '),
)

// The three supported sites, by the words people use for them.
export const SITES = [
  // (with common misspellings: "amzon", "flipkrt", "mintra")
  { name: 'Amazon', re: /\b(?:amazon|amzon|amazone|amazn|amozon)(?:\.in)?\b/, url: (t: string) => `https://www.amazon.in/s?k=${encodeURIComponent(t)}` },
  { name: 'Flipkart', re: /\b(?:flipkart|flipcart|flip kart|flipkrt|filpkart|flipkat)(?:\.com)?\b/, url: (t: string) => `https://www.flipkart.com/search?q=${encodeURIComponent(t)}` },
  {
    name: 'Myntra', re: /\b(?:myntra|mintra|myntr|mynta)(?:\.com)?\b/,
    url: (t: string) => `https://www.myntra.com/${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}?rawQuery=${encodeURIComponent(t)}`,
  },
]

/**
 * "can you open amazon, i need a blue shirt", "show this on myntra": the site the user asks to
 * go to, when it isn't the current one. Only when a product or a "go there" word is given, so
 * "is this cheaper than amazon?" does not jump to Amazon.
 */
export function otherSite(query: string, currentSite: string) {
  const q = query.toLowerCase()
  const named = SITES.filter((s) => s.re.test(q))
  // "compare amazon, flipkart and myntra": it works on one site at a time, so stay (see compareNote).
  if (named.length !== 1) return null
  const site = named[0]
  if (site.name.toLowerCase() === currentSite.toLowerCase()) return null
  const goThere = /\b(open|go(?: to)?|take me|switch|search|check|look|find|show|on|in|from|at|par|pe|mein)\b/.test(q)
  return goThere || productIn(query) ? site : null
}

/**
 * "compare amazon, flipkart and myntra", "lowest price on all 3 sites": check every site and
 * pick the cheapest. (Not "compare iphone and samsung": that is about products, not sites.)
 */
export function wantsCompare(query: string): boolean {
  const q = query.toLowerCase()
  return SITES.filter((s) => s.re.test(q)).length >= 2 ||
    /\b(?:all|every|each|both|teeno|tino|sab|sabhi)\s+(?:the\s+)?(?:3\s+|three\s+|teen\s+)?(?:sites?|websites?|apps?|stores?|platforms?|shops?)\b/.test(q) ||
    /\b(?:3|three|teen|teeno)\s+(?:sites?|websites?|apps?|stores?|platforms?)\b/.test(q) ||
    /\bacross\s+(?:the\s+)?(?:sites?|websites?|apps?|stores?|platforms?)\b/.test(q)
}

/** The request as search words: without filler, site names, prices, discounts, ratings and sizes. */
export function searchWords(query: string): string {
  return fixProductTypos(query)
    .toLowerCase()
    .replace(/\bsize\s+(?:is|hai|of|=|:)\s*/g, 'size ') // "size is 40"
    .replace(/\b(?:3|three|teen)\s+(?:sites?|websites?|apps?|stores?|platforms?)\b/g, ' ') // "all 3 sites"
    .replace(/\b(under|below|less than|within|up ?to|above|over|more than|between|budget(?: of)?)\s+(?:rs\.?|₹)?\s*[\d,]+k?(?:\s*(?:and|to|-)\s*(?:rs\.?|₹)?\s*[\d,]+k?)?/g, ' ')
    // Hinglish and "2000 rupees" style prices: "₹2000 ke andar", "2000 tak", "500 rupees se kam"
    .replace(/(?:\brs\.?\s*|₹\s*)?[\d,]+k?\s*(?:rupees?\s*|rs\b\s*)?(?:ke andar|ke under|tak|se kam|ke neeche|ke niche|se niche|se upar|se zyada|se jyada|ke upar)/g, ' ')
    .replace(/[\d,]+k?\s*(?:rupees?|rs\b)/g, ' ')
    .replace(/(?:\brs\.?|₹)\s*[\d,]+k?/g, ' ') // "\brs": not the end of "sneake-rs 50"
    .replace(/\d+\s*%\s*(?:off|discount)?/g, ' ')
    .replace(/\d(?:\.\d)?\s*\+?\s*(?:stars?|★)(?:\s*(?:and|&)\s*(?:above|up))?/g, ' ')
    .replace(/\bsize\s+(?:uk\s*)?[a-z0-9./]+/g, ' ')
    .replace(/\buk\s*\d+(?:\.5)?\b/g, ' ')
    .replace(/[^a-z0-9\s&'-]/g, ' ')
    .split(/\s+/)
    // each word once ("shirt … shirt"); no lone symbols ("&", "-")
    .filter((w, i, all) => w && /[a-z0-9]/.test(w) && !FILLER.has(w) && all.indexOf(w) === i)
    .join(' ')
}

/**
 * If the request names a product that the current search doesn't, returns what to search for
 * (prices, sizes etc. are applied as filters afterwards). Otherwise returns null and the
 * current page is just filtered.
 */
export function searchFor(query: string, currentSearch: string): string | null {
  const wanted = productIn(query)
  if (!wanted) return null
  const current = norm(currentSearch)
  // Same product as the page: just filter. Unless the page was searched for another colour
  // ("white shirt" on a "maroon shirt" page): its colour filter may not even offer white.
  const asked = coloursIn(query)
  const shown = coloursIn(currentSearch)
  const otherColour = asked.length > 0 && shown.length > 0 && !asked.some((c) => shown.includes(c))
  if (wanted.some((w) => has(current, w)) && !otherColour) return null
  return searchWords(query) || wanted[0]
}

/** What to search for on another site: the product asked for, else what the current page shows. */
export const searchOnOtherSite = (query: string, currentSearch: string) =>
  (productIn(query) && searchWords(query)) || currentSearch.trim() || 'trending'
