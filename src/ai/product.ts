// Decides whether a request is for a different product than the page shows
// ("give me running shoes" on a jackets page), and what to search for then.
import { amazon } from '../adapters/amazon'
import { flipkart } from '../adapters/flipkart'
import { myntra } from '../adapters/myntra'
import { escapeRe } from '../adapters/types'
import { COMMON } from './common'

// Product words (singular). Words in one group mean the same product.
const PRODUCTS: string[][] = [
  ['shoe', 'sneaker', 'footwear', 'joota', 'joote', 'jutti'], ['sandal', 'slipper', 'flip flop', 'chappal'], ['boot'], ['heel'],
  ['jacket', 'coat', 'blazer'], ['hoodie', 'sweatshirt'], ['sweater', 'cardigan'],
  ['tshirt', 't shirt', 'tee'], ['shirt'], ['jean'], ['trouser', 'pant', 'chino'], ['track pant', 'jogger'],
  ['kurta', 'kurti'], ['saree', 'sari'], ['lehenga'], ['dress', 'gown'], ['skirt'], ['legging'],
  ['phone', 'mobile', 'smartphone', 'iphone'], ['laptop', 'notebook'], ['tablet', 'ipad'],
  ['watch', 'smartwatch'], ['headphone', 'earphone', 'earbud', 'headset'], ['speaker'], ['tv', 'television'],
  ['bag', 'backpack', 'handbag'], ['wallet'], ['belt'], ['sunglass'], ['perfume'], ['cap', 'hat'],
  // Common on other shops too (electronics, sport, home). Never typo targets (see HOME_PRODUCTS).
  ['mouse'], ['keyboard'], ['camera'], ['bicycle', 'cycle'], ['dumbbell'], ['mattress'], ['sofa'], ['chair'], ['table'],
  ['lamp'], ['bottle'], ['toy'], ['plant'], ['board'],
]
// Short, common-looking product words from other shops: a word one letter off is usually another
// real word ("cable" ≠ table, "chain" ≠ chair, "beard" ≠ board, "house" ≠ mouse), so never corrected.
const HOME_PRODUCTS = new Set(['mouse', 'keyboard', 'camera', 'bicycle', 'cycle', 'dumbbell', 'mattress', 'sofa', 'chair', 'table', 'lamp', 'bottle', 'toy', 'plant', 'board'])

const norm = (s: string) =>
  s.toLowerCase().replace(/t-shirt/g, 'tshirt').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    .map((w) => (w.endsWith('sses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')

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
// (Words under 5 letters are never corrected anyway.)
const NOT_TYPO = new Set(['short', 'shorts', 'sheet', 'shift', 'sport', 'coach', 'paint', 'walet',
  // real words one letter from a product word ("grown" is not gown, "beans" are not jeans)
  'grown', 'packet', 'racket', 'press', 'beans', 'means', 'deans', 'leans', 'match', 'prone', 'shone', 'mallet',
  'pallet', 'scandal', 'skipper', 'sweeter', 'begging', 'pegging', 'logger', 'trouper', 'walled', 'glazer'])
/** Turns misspelt product and colour words into the real ones: "broen shirst" → "brown shirt". */
function fixProductTypos(text: string): string {
  const all = PRODUCTS.flat().filter((w) => w.length >= 4 && !w.includes(' ') && !HOME_PRODUCTS.has(w))
  // Colours of 5+ letters only: "red", "blue", "pink" are too close to other words.
  const colours = COLOURS.filter((c) => c.length >= 5)
  return text.replace(/[a-z]+/gi, (w) => {
    const lower = w.toLowerCase()
    const known = PRODUCTS.flat()
    if (lower.length < 5 || NOT_TYPO.has(lower) || known.includes(lower) || known.includes(lower.replace(/s$/, ''))) return w
    if (colours.includes(lower)) return w
    const fix = all.find((p) => oneOff(lower, p) || oneOff(lower, p + 's')) ??
      // (Everyday words near a colour stay: "while" is not white, "greek" is not green.)
      (COMMON.has(lower) ? undefined : colours.find((c) => oneOff(lower, c)))
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

// Colours people ask for (also used by reply.ts to say when a page can't filter by one).
export const COLOURS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray',
  'beige', 'maroon', 'navy', 'olive', 'khaki', 'cream', 'gold', 'silver', 'peach', 'teal', 'mustard', 'lavender']
// To notice "white shirt" asked on a "maroon shirt" page (same product, different colour), misspellings included.
const SAME_COLOUR: Record<string, string> = { merun: 'maroon', maroun: 'maroon', gray: 'grey', wine: 'maroon' }
function coloursIn(text: string) {
  const t = norm(text)
  return [...COLOURS, 'merun', 'maroun', 'wine'].filter((c) => has(t, c)).map((c) => SAME_COLOUR[c] ?? c)
}

// Words that only make the request polite or are read as filters, not search words.
const FILLER = new Set(
  (
    'give me show find get buy i want need looking look for some a an the please pls plz can could would will you u to see any ' +
    'something with in of and or open go take switch search check on at from which that what is are there do does have has ' +
    'i\'m im my also just now then hey hi hello bro bhai ji kindly mujhe chahiye dikhao pe par mein site website app store ' +
    'rupees rupee rs inr only compare comparison better best all fo fr whichever good nice it this ' +
    'tell suggest recommend visit order goto everywhere anywhere elsewhere other shops ' +
    // price and sort words: they become a sort order or a price filter, never search words
    'lower lowest low price prices cheap cheaper cheapest sasta saste sasti costly expensive high higher highest ' +
    'than across sites websites apps stores platforms every each both three teen teeno tino sab sabhi vs versus ' +
    // Hinglish joining and price words: "dono pe check karo", "sabse sasta", "1000 se kam"
    'karo kar karna karke dono aur sabse main ke andar se kam tak wala wali wale hai hain kahan kaha kidhar milega milegi milenge ya konsa kaunsa ' +
    'amazon amzon amazone amazn amozon flipkart flipcart flipkrt filpkart flipkat myntra mintra myntr mynta'
  ).split(' '),
)

// The shops with their own adapter (every other shop uses the generic one), by the words people use for them.
export const SITES = [
  // (with common misspellings: "amzon", "flipkrt", "mintra")
  { name: 'Amazon', home: 'https://www.amazon.in/', re: /\b(?:amazon|amzon|amazone|amazn|amozon)(?:\.in)?\b/, url: amazon.searchUrl },
  { name: 'Flipkart', home: 'https://www.flipkart.com/', re: /\b(?:flipkart|flipcart|flip kart|flipkrt|filpkart|flipkat)(?:\.com)?\b/, url: flipkart.searchUrl },
  { name: 'Myntra', home: 'https://www.myntra.com/', re: /\b(?:myntra|mintra|myntr|mynta)(?:\.com)?\b/, url: myntra.searchUrl },
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

// Well-known shops by name → their official address (each checked to load, 17 Nov 2026).
// Only these open by name; any other name gets an answer, never a guessed address.
const KNOWN_SHOPS: [string[], string][] = [
  [['ajio'], 'www.ajio.com'], [['nykaa'], 'www.nykaa.com'], [['nykaa fashion', 'nykaafashion'], 'www.nykaafashion.com'],
  [['blinkit', 'grofers'], 'blinkit.com'], [['zepto', 'zeptonow'], 'www.zeptonow.com'],
  [['instamart', 'insta mart', 'swiggy instamart', 'swiggy insta mart', 'swiggy'], 'www.swiggy.com/instamart'],
  [['bigbasket', 'big basket'], 'www.bigbasket.com'], [['meesho'], 'www.meesho.com'], [['tatacliq', 'tata cliq', 'cliq'], 'www.tatacliq.com'],
  [['croma'], 'www.croma.com'], [['reliance digital', 'reliancedigital'], 'www.reliancedigital.in'], [['decathlon'], 'www.decathlon.in'],
  [['snapdeal'], 'www.snapdeal.com'], [['jiomart', 'jio mart'], 'www.jiomart.com'], [['firstcry', 'first cry'], 'www.firstcry.com'],
  [['lenskart'], 'www.lenskart.com'], [['pepperfry'], 'www.pepperfry.com'], [['ikea'], 'www.ikea.com/in'], [['bewakoof'], 'www.bewakoof.com'],
  [['souled store', 'the souled store', 'thesouledstore'], 'www.thesouledstore.com'], [['westside'], 'www.westside.com'],
  [['lifestyle', 'lifestyle stores'], 'www.lifestylestores.com'], [['max fashion', 'maxfashion'], 'www.maxfashion.in'],
  [['shoppers stop', 'shoppersstop'], 'www.shoppersstop.com'], [['udemy'], 'www.udemy.com'], [['urbanic'], 'www.urbanic.com'],
  [['h&m', 'hm', 'h and m', 'h & m'], 'www2.hm.com/en_in'], [['zara'], 'www.zara.com/in'], [['uniqlo'], 'www.uniqlo.com/in'],
  [['puma'], 'in.puma.com'], [['adidas'], 'www.adidas.co.in'], [['nike'], 'www.nike.com/in'], [['boat', 'boat lifestyle'], 'www.boat-lifestyle.com'],
  [['vijay sales', 'vijaysales'], 'www.vijaysales.com'], [['purplle'], 'www.purplle.com'], [['mamaearth'], 'mamaearth.in'],
  [['vastrado'], 'www.vastrado.com'],
]
// Letters swapped, one wrong, missing or extra ("vastardo" → vastrado, "blinkt" → blinkit).
function nearlySame(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length] <= 1
}
// Shop names that are also brands or everyday words: only "open puma" on its own goes there.
const BRAND_SHOPS = new Set(['puma', 'adidas', 'nike', 'boat', 'boat lifestyle', 'zara', 'uniqlo', 'h&m', 'hm', 'h and m', 'h & m',
  'lifestyle', 'cliq'])
/** The official address of a well-known shop named (or nearly named) like this, if any. */
function knownShop(name: string): string | null {
  const full = name.toLowerCase().trim()
  const n = full.replace(/\s+(?:website|web site|site|app|online|store|india)$/, '').trim()
  // As typed first ("souled store" is the shop's name), then without "website"/"app"/"store".
  for (const [names, domain] of KNOWN_SHOPS) if (names.includes(full) || names.includes(n)) return domain
  // Typos only for names of 5+ letters ("zepto" yes, "hm" never).
  // (Never from a colour, a product or an everyday word: "open purple" is not Purplle.)
  if (n.length >= 5 && !COLOURS.includes(n) && !FILLER.has(n) && !productIn(n))
    for (const [names, domain] of KNOWN_SHOPS) if (names.some((x) => x.length >= 5 && nearlySame(n, x))) return domain
  return null
}

// Words that can stand before "site"/"website" without naming a shop ("this site", "same app").
const NOT_A_SHOP = new Set(['this', 'that', 'the', 'same', 'your', 'my', 'their', 'other', 'another', 'any', 'official', 'shopping',
  'online', 'a', 'an', 'which', 'what', 'whole', 'entire', 'web', 'mobile', 'its', 'our', 'every', 'each', 'one', 'some'])
const TLD = String.raw`(?:com|in|co\.in|net|org|shop|store|co|io|co\.uk|uk|de|fr|ae|us|ca|au|sg)`

/**
 * A shop named in the request that is not Amazon, Flipkart or Myntra, and not the one open:
 * "open vastardo website", "go to nykaa.com", "show this on ajio site". domain: the address the
 * user typed ("nykaa.com"), or null when only a name was given: addresses are never guessed
 * (a misspelt name could lead to a wrong or fake site).
 */
export function unknownSite(query: string, currentSite: string, currentHost: string, options: string[] = []): { name: string; domain: string | null } | null {
  const q = query.toLowerCase()
  const here = (name: string) => {
    const n = name.replace(/^www\./, '')
    return n === currentSite.toLowerCase() || currentHost.toLowerCase().replace(/^www\./, '').startsWith(n.split('.')[0] + '.') ||
      SITES.some((s) => s.re.test(n))
  }
  // An address: "nykaa.com", "www.vastrado.in/shirts"
  const address = q.match(new RegExp(String.raw`\b((?:www\.)?(?:[a-z0-9-]+\.)+${TLD})(?![a-z0-9.-])`))
  if (address && !here(address[1])) return { name: address[1].replace(/^www\./, ''), domain: address[1].replace(/^www\./, '') }
  // A name with "website" / "site" / "app": "open vastardo website", "on nykaa app"
  const named =
    q.match(/\b(?:open|go to|goto|visit|switch to|take me to|on|from|at|in|check)\s+(?:the\s+)?([a-z0-9][a-z0-9&'-]{1,30})\s+(?:website|web site|site|app)\b/) ??
    // Hinglish order: "tatacliq website pe dikhao", "nykaa app par"
    q.match(/(?:^|\b(?:and|aur|then)\s+)([a-z0-9][a-z0-9&'-]{1,30})\s+(?:website|web site|site|app)\s+(?:pe|par|mein|me)\b/)
  const name = named?.[1]
  if (name && !NOT_A_SHOP.has(name) && !FILLER.has(name) && !here(name) && !productIn(name) && !COLOURS.includes(name)) return { name, domain: knownShop(name) }
  // "i need hrx white shirt from ajio", "kurta on meesho", "ajio pe white shirt dikhao": a known
  // shop's exact name after "from/on/at/in" or before "pe/par/se/mein". (Not names that are also
  // brands: "shoes from puma" is the brand.)
  for (const [names, domain] of KNOWN_SHOPS)
    for (const n of names) {
      if (n.length < 3 || BRAND_SHOPS.has(n) || here(n)) continue
      const e = n.replace(/[&]/g, '\\$&')
      if (new RegExp(String.raw`\b(?:from|on|at|in|via)\s+(?:the\s+)?${e}(?![a-z0-9])|(?:^|\s)${e}\s+(?:pe|par|se|mein|me)\b`).test(q)) return { name: n, domain }
    }
  // "open h and m": a shop whose name has "and" / "&" in it, before "and" is read as joining two asks.
  const opener = String.raw`^(?:(?:hey|hi|hello|can you|could you|will you|would you|please|pls|plz|kindly|just)\s+)*(?:open|go to|goto|visit|take me to)\s+(?:the\s+)?`
  for (const [names, domain] of KNOWN_SHOPS)
    for (const n of names.filter((x) => /\sand\s|&/.test(x)))
      if (!here(n) && new RegExp(`${opener}${n.replace(/&/g, '\\&')}(?![a-z0-9])`).test(q.trim())) return { name: n, domain }
  // "open insta mart i need egg", "go to udemy", "pls open bigbasket": the message starts by asking
  // to go somewhere, and that somewhere is not a product, a colour, a part of the page ("open the
  // cart") or a filter on this page ("open toe" sandals).
  const going = q.trim().match(
    /^(?:(?:hey|hi|hello|can you|could you|will you|would you|please|pls|plz|kindly|just)\s+)*(?:open|go to|goto|visit|take me to)\s+(?:the\s+)?([a-z0-9][a-z0-9&'-]*(?:\s+[a-z0-9][a-z0-9&'-]*){0,2}?)\s*(?:$|[,.;!?]|\s(?:and|then|aur|i need|i want|i'm looking|im looking|need|want|for me|to buy|mujhe|show|find|search|buy|get|order|please|pls)\b)/,
  )
  const place = going?.[1].replace(/\s+(?:website|web site|site|app)$/, '')
  if (!place) return null
  const placeWords = place.replace(/'s\b/g, '').split(/\s+/)
  const onPage = options.some((o) => {
    const opt = o.toLowerCase().replace(/'s\b/g, '')
    return opt === place || opt === `open ${place}` || placeWords.some((w) => w.length > 2 && ` ${opt} `.includes(` ${w} `))
  })
  // A well-known shop wins even when its name has a common word in it ("souled store", "max fashion").
  const known = here(place) ? null : knownShop(place)
  if (known) return { name: place, domain: known }
  // "open ajio red kurta": a shop-only name first, the product after it. (Not names that are also
  // brands or words: "open boat neck kurta", "open puma shoes" stay requests for this page.)
  for (let n = Math.min(3, placeWords.length - 1); n >= 1; n--) {
    const head = placeWords.slice(0, n).join(' ')
    const shop = KNOWN_SHOPS.find(([names]) => names.includes(head))
    if (shop && !BRAND_SHOPS.has(head) && !here(head)) return { name: head, domain: shop[1] }
  }
  if (onPage || here(place) || productIn(place) || placeWords.some((w) => NOT_A_SHOP.has(w) || PAGE_PART.has(w) || COLOURS.includes(w) || FILLER.has(w)))
    return null
  return { name: place, domain: null }
}
// Parts of a shop page: "open the cart" is not another shop.
const PAGE_PART = new Set(['cart', 'bag', 'basket', 'checkout', 'wishlist', 'account', 'orders', 'order', 'profile', 'login', 'page',
  'tab', 'menu', 'filter', 'filters', 'link', 'details', 'detail', 'product', 'products', 'item', 'items', 'it', 'next', 'previous',
  'home', 'homepage', 'settings', 'help', 'top', 'bottom', 'reviews', 'review', 'sale', 'offers', 'deals', 'coupons', 'images', 'image', 'photo', 'photos', 'size', 'chart'])

// Which well-known shops sell a kind of product ("compare puma jacket" checks the fashion shops).
const SHOPS_FOR: [string[], string[]][] = [
  [['shoe', 'sandal', 'boot', 'heel', 'jacket', 'hoodie', 'sweater', 'tshirt', 'shirt', 'jean', 'trouser', 'track pant', 'kurta',
    'saree', 'lehenga', 'dress', 'skirt', 'legging', 'bag', 'wallet', 'belt', 'sunglass', 'cap', 'watch'],
    ['ajio', 'snapdeal', 'tatacliq', 'shoppers stop', 'westside', 'meesho']],
  [['phone', 'laptop', 'tablet', 'headphone', 'speaker', 'tv', 'camera', 'mouse', 'keyboard'], ['croma', 'reliance digital', 'vijay sales', 'tatacliq']],
  [['perfume'], ['nykaa', 'purplle']],
  [['sofa', 'chair', 'table', 'lamp', 'mattress', 'bottle', 'plant', 'board'], ['ikea', 'pepperfry']],
  [['bicycle', 'dumbbell'], ['decathlon']],
  [['toy'], ['firstcry']],
]

/** A shop to compare: one of the three with its own search address, or another by its address. */
export type CompareTarget = { name: string; url?: (text: string) => string; domain?: string }

/**
 * Which shops a comparison checks. Named shops when the message names them ("on ajio and
 * snapdeal"; one name = that shop and this one); "all 3 sites" = Amazon, Flipkart and Myntra;
 * otherwise every well-known shop selling that kind of product. The shop open now is always in.
 */
export function compareTargets(query: string, currentSite: string, currentHost: string): CompareTarget[] {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9&.\s]/g, ' ').replace(/\s+/g, ' ')} `
  const big: CompareTarget[] = SITES.map((s) => ({ name: s.name, url: s.url }))
  const known = (names: string[], domain: string): CompareTarget => ({ name: names[0].replace(/\b[a-z]/g, (c) => c.toUpperCase()), domain })
  const host = currentHost.toLowerCase().replace(/^www\d?\./, '')
  // Named: the three by name, well-known shops by name (not those that are also brands: "puma
  // shoes" names a brand, "on puma website" a shop), and typed addresses.
  const named: CompareTarget[] = [
    ...big.filter((t) => SITES.find((s) => s.name === t.name)!.re.test(q)),
    ...KNOWN_SHOPS.filter(([names]) => names.some((n) => q.includes(` ${n} `) &&
      (!BRAND_SHOPS.has(n) || new RegExp(String.raw`\b${escapeRe(n)}\s+(?:website|site|app)\b`).test(q)))).map(([names, d]) => known(names, d)),
    ...[...q.matchAll(new RegExp(String.raw`(?<![a-z0-9.-])((?:[a-z0-9-]+\.)+${TLD})(?![a-z0-9.-])`, 'g'))].map((m) => ({ name: m[1], domain: m[1] })),
  ]
  const here = (t: CompareTarget) => t.name.toLowerCase() === currentSite.toLowerCase() ||
    (!!t.domain && host.startsWith(t.domain.replace(/^www\d?\./, '').split('/')[0]))
  // The shop open now, unless it is one of the three (they have their own entries).
  const current: CompareTarget | null = !host || SITES.some((s) => s.name.toLowerCase() === currentSite.toLowerCase())
    ? null
    : { name: currentSite || host, domain: host }
  let out: CompareTarget[]
  if (named.length >= 2) out = named
  else if (named.length === 1) out = [named[0], ...(current ? [current] : big.filter((t) => t.name.toLowerCase() === currentSite.toLowerCase()))]
  else if (/\b(?:3|three|teen|teeno|tino)\s+(?:sites?|websites?|apps?|stores?|platforms?|shops?)\b/.test(q)) out = big
  else {
    const product = productIn(searchWords(query))
    const extra = SHOPS_FOR.find(([kinds]) => product?.some((p) => kinds.includes(p)))?.[1] ?? []
    out = [...big, ...extra.map((n) => KNOWN_SHOPS.find(([names]) => names.includes(n))!).map(([names, d]) => known(names, d)), ...(current ? [current] : [])]
  }
  // Each shop once (the open one may also be named or listed).
  return out.filter((t, i) => out.findIndex((x) => x.name.toLowerCase() === t.name.toLowerCase() || (!!x.domain && x.domain === t.domain) || (here(x) && here(t))) === i)
}

/**
 * "compare amazon, flipkart and myntra", "lowest price on all 3 sites", "compare on ajio and
 * snapdeal", "compare all": check every shop and pick the cheapest. (Not "compare iphone and
 * samsung": that is about products, not shops.)
 */
export function wantsCompare(query: string): boolean {
  const q = query.toLowerCase()
  const shopsNamed = SITES.filter((s) => s.re.test(q)).length +
    KNOWN_SHOPS.filter(([names]) => names.some((n) => !BRAND_SHOPS.has(n) && ` ${q.replace(/[^a-z0-9&.\s]/g, ' ')} `.includes(` ${n} `))).length
  return SITES.filter((s) => s.re.test(q)).length >= 2 ||
    // "compare with ajio", "nykaa vs purplle", "cheapest on ajio or snapdeal" (not "is myntra cheaper
    // than usual": a question about one shop)
    (!/\b(?:open|go to|visit|take me to)\b/.test(q) &&
      ((/\b(?:compare|comparison|vs|versus)\b/.test(q) && shopsNamed >= 1) || (/\b(?:cheaper|cheapest|lowest price|best price)\b/.test(q) && shopsNamed >= 2))) ||
    // "compare all", "compare everywhere", "compare on other sites"
    /\bcompare\b.*\b(?:everywhere|other (?:sites?|shops?|websites?|stores?))\b|\bcompare (?:it |them |prices? )?(?:on |across |in )?all\b(?!\s+(?:colou?rs?|sizes?|brands?|models?|variants?|types?))/.test(q) ||
    /\b(?:all|every|each|both|teeno|tino|sab|sabhi)\s+(?:the\s+)?(?:3\s+|three\s+|teen\s+)?(?:sites?|websites?|apps?|stores?|platforms?|shops?)\b/.test(q) ||
    /\b(?:3|three|teen|teeno)\s+(?:sites?|websites?|apps?|stores?|platforms?)\b/.test(q) ||
    /\bacross\s+(?:the\s+)?(?:sites?|websites?|apps?|stores?|platforms?)\b/.test(q)
}

/** The request as search words: without filler, site names, prices, discounts, ratings and sizes. */
export function searchWords(query: string): string {
  return fixProductTypos(query)
    .toLowerCase()
    .replace(/\bsize\s+(?:is|hai|of|=|:)\s*/g, 'size ') // "size is 40"
    .replace(/\b(x{0,3}[sl]|m|\d?x{1,3}l|\d+(?:\.5)?)\s+size\b/g, 'size $1') // "L size kurta" → "size l kurta"
    .replace(/\b(?:3|three|teen)\s+(?:sites?|websites?|apps?|stores?|platforms?)\b/g, ' ') // "all 3 sites"
    .replace(/\b(under|below|less than|within|up ?to|above|over|more than|between|budget(?: of)?)\s+(?:rs\.?|[₹$€£])?\s*[\d,.]+k?(?:\s*(?:and|to|-)\s*(?:rs\.?|[₹$€£])?\s*[\d,.]+k?)?(?:\s*(?:rupees?|rs\b|dollars?|euros?|usd|eur|inr)\b)?/g, ' ')
    // Hinglish and "2000 rupees" style prices: "₹2000 ke andar", "2000 tak", "500 rupees se kam"
    .replace(/(?:\brs\.?\s*|₹\s*)?[\d,]+k?\s*(?:rupees?\s*|rs\b\s*)?(?:ke andar|ke under|tak|se kam|ke neeche|ke niche|se niche|se upar|se zyada|se jyada|ke upar)/g, ' ')
    .replace(/[\d,]+k?\s*(?:rupees?|rs\b|dollars?\b|euros?\b)/g, ' ')
    .replace(/(?:\brs\.?|[₹$€£])\s*[\d,.]+k?/g, ' ') // "\brs": not the end of "sneake-rs 50"
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

/** What to search for on a shop opened by its typed address: the request without the address
 * ("https://www.decathlon.in running shoes under 3000" → "running shoes"), or null. */
export const searchAt = (query: string, domain: string, name = ''): string | null => searchWords(withoutShop(query, domain, name)) || null

/** The request without the shop it names, as address or name ("open ajio, red kurta" → "open , red kurta"). */
export function withoutShop(query: string, domain: string, name = ''): string {
  const host = domain.replace(/^www\d?\./, '')
  const q = query.replace(new RegExp(String.raw`(?:https?://)?(?:www\d?\.)?${escapeRe(host)}(?:/\S*)?`, 'gi'), ' ')
  return name && name !== domain ? q.replace(new RegExp(String.raw`\b${escapeRe(name)}\b(?:\s+(?:website|web site|site|app))?`, 'gi'), ' ') : q
}

/** The words of a request that are neither filler nor search words: what was meant as filters
 * ("i need brown shirt size L" → "size l"). */
export function filterWords(query: string): string {
  // Words cut the same way as searchWords ("men's" stays one word; "shoes." is "shoes").
  const words = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9₹$€£%.'\s-]/g, ' ').split(/\s+/).map((w) => w.replace(/^[.'-]+|[.'-]+$/g, '')).filter(Boolean)
  const search = new Set(words(searchWords(query)))
  return words(fixProductTypos(query)).filter((w) => /[a-z0-9]/.test(w) && !FILLER.has(w) && !search.has(w)).join(' ')
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
