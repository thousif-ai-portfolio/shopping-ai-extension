// Reads numbers, sizes, sorting and "remove" requests straight from the text. The small AI
// often gets these wrong ("under 2000" as a minimum, drops "size M"); simple patterns don't.
import type { Wanted } from './match'
import { SORT_GROUP, type FilterChoice } from '../adapters/types'

export type SortKey = 'price_asc' | 'price_desc' | 'newest' | 'popularity' | 'rating'

const amount = (s: string) => {
  const k = /k$/i.test(s)
  const n = Number(s.replace(/,/g, '').replace(/k$/i, ''))
  // Cents are kept ("$49.99"); whole amounts stay whole.
  return Math.round((k ? n * 1000 : n) * 100) / 100
}

// Hindi written in Devanagari → the English the rest of the code reads.
const DEVANAGARI: [RegExp, string][] = [
  // Brands first ("आईफोन" before "फोन")
  [/आईफ़?ोन/g, 'iphone'], [/सैमसंग/g, 'samsung'], [/एप्पल|ऐपल/g, 'apple'], [/नाइकी|नायकी/g, 'nike'], [/प्यूमा|पूमा/g, 'puma'],
  [/एडिडास|एडीडास/g, 'adidas'], [/रेडमी/g, 'redmi'], [/वीवो|विवो/g, 'vivo'], [/ओप्पो/g, 'oppo'], [/वनप्लस/g, 'oneplus'],
  [/मोटोरोला/g, 'motorola'], [/रियलमी/g, 'realme'],
  [/काल[ाीे]/g, 'black'], [/सफ़?े?द/g, 'white'], [/लाल/g, 'red'], [/नील[ाीे]/g, 'blue'], [/हर[ाीे]/g, 'green'],
  [/पील[ाीे]/g, 'yellow'], [/गुलाबी/g, 'pink'], [/भूर[ाीे]/g, 'brown'], [/जूत[ाेी]/g, 'shoes'], [/जैकेट/g, 'jacket'],
  [/कुर्त[ाी]/g, 'kurta'], [/फ़?ोन|मोबाइल/g, 'phone'], [/साइज़?/g, 'size'], [/पुरुष|आदमी|मर्द/g, 'men'], [/महिला|औरत/g, 'women'],
  [/से कम|के अंदर|तक|से नीचे/g, ' tak '], [/से ज़?्?यादा|से ऊपर/g, ' se upar '], [/सस्त[ाीे]/g, 'sasta'], [/रुपये|रु\.?/g, ' rs '],
]
// Rupees, and the currencies of shops elsewhere ("under $80", "€50 - €100").
const CUR = String.raw`(?:rs\.?|₹|inr|\$|usd|€|eur|£|gbp)?\s*`
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?k?)`
const MONEY = CUR + NUM + String.raw`\s*(?:rs\.?|rupees|₹|inr|dollars?|euros?|usd|eur)?`
// A number followed by one of these is not a price ("above 5000 mah", "4 star", "40%", "size 9").
const NOT_MONEY = String.raw`(?!\s*(?:%|star|★|gb|tb|mah|mp|ghz|hz|inch|cm|mm|uk|size|rating|\+\s*(?:star|rating))|\d|[,.]\d)` // "2k," is a price; "2,5" is not the end of one

/**
 * Rewrites everyday phrasing into forms the rest of the code understands:
 * "8/128" → "8gb ram 128gb storage", Hinglish price words → English, "L size" → "size L".
 */
export function normalizeQuery(query: string): string {
  let q = ` ${query.toLowerCase().replace(/[“”"!?]+/g, ' ').replace(/\s+/g, ' ')} `
  // Devanagari digits and words
  q = q.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966))
  for (const [re, to] of DEVANAGARI) q = q.replace(re, ` ${to} `)
  // Number words: "two thousand", "five hundred", "size nine"
  const NUM_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30, forty: 40, fifty: 50,
  }
  const NW = Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).join('|')
  q = q.replace(new RegExp(String.raw`\b(${NW})\s+(thousand|hazaa?r|hajaa?r|lakhs?|lacs?|hundred)\b`, 'g'), (_, w, u) => `${NUM_WORDS[w]} ${u}`)
  q = q.replace(new RegExp(String.raw`\bsize\s+(${NW})\b`, 'g'), (_, w) => `size ${NUM_WORDS[w]}`)
  q = q.replace(/(\d+)\s*hundred\b/g, (_, n) => String(Number(n) * 100))
  // "20 se 30 hazar", "20 to 30k": the unit belongs to both numbers
  q = q.replace(/\b(\d+(?:\.\d+)?)\s*(se|to|-)\s*(\d+(?:\.\d+)?)\s*(?:thousand|hazaa?r|hajaa?r|k)\b/g,
    (_, a, sep, b) => `${Math.round(Number(a) * 1000)} ${sep} ${Math.round(Number(b) * 1000)}`)
  // "1 lakh", "1.5 lac", "2 lakhs" → plain numbers
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/g, (_, n) => String(Math.round(Number(n) * 100000)))
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:thousand|hazaa?r|hajaa?r)\b/g, (_, n) => String(Math.round(Number(n) * 1000)))
  // Phone shorthand: "8/128", "8gb/128gb", "8+128"
  q = q.replace(/\b(\d{1,2})\s*(?:gb)?\s*[/+]\s*(\d{2,4})\s*(?:gb)?\b/g, ' $1gb ram $2gb storage ')
  // Hinglish price words
  q = q.replace(new RegExp(String.raw`${MONEY}\s*(?:ke andar|ke under|tak|se kam|ke neeche|se niche|ke niche)`, 'g'), ' under $1 ')
  q = q.replace(new RegExp(String.raw`${MONEY}\s*(?:se upar|se zyada|se jyada|ke upar)`, 'g'), ' above $1 ')
  q = q.replace(new RegExp(String.raw`${MONEY}\s*se\s*${MONEY}`, 'g'), ' between $1 and $2 ')
  // Hinglish negation comes after the word: "size 8 nahi 9 chahiye" → "9 instead of 8",
  // "nike nhi chahiye, adidas dikhao" → "not nike, adidas dikhao" (handled just below)
  q = q.replace(/(\S+)\s+(?:nahi|nhi|nahin|nai)\s+(\S+)\s+(?:chahiye|chaiye|chahie|dikhao|do)\b/g, ' $2 instead of $1 ')
  q = q.replace(/(\S+)\s+(?:nahi|nhi|nahin|nai|mat)\s+(?:chahiye|chaiye|chahie|dikhao|dikhana)\b/g, ' not $1 ')
  q = q.replace(/^\s*(.+?)\s+(?:hatao|hata do|hatado|nikalo)\s*,?\s*(?:aur\s+)?(.+?)\s+(?:dikhao|dikha do|lagao|chahiye)\s*$/, ' not $1, $2 ')
  q = q.replace(/^\s*(?:remove|drop)\s+([^,]+?)\s*(?:,|\band\b)\s*(?:show|add|get|give)\s+(?:me\s+)?(.+)$/, ' not $1, $2 ')
  q = q.replace(/^\s+/, ' ')
  // "he wears M", "she wears a size 8": a size
  q = q.replace(/\b(?:wears?|wearing)\s+(?:a\s+|an\s+|size\s+)*(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d{1,2}(?:\.5)?)\b/g, ' size $1 ')
  // "not black, navy" / "not puma but nike" → "navy instead of black" (a replacement, not a removal)
  q = q.replace(/^ ?not (?!(?:more|less|above|below|over|under|too|very|so|much|costly|expensive|cheap|exceeding)\b)([^,]+?)\s*(?:,|\bbut\b)\s*(?:but |rather |instead |show |give )?(.+?) ?$/, ' $2 instead of $1 ')
  // "9 number" (Hinglish for shoe size 9), "number 9"
  q = q.replace(/\b(\d{1,2}(?:\.5)?)\s*(?:number|no\.?)(?!\s*size)\b/g, ' size $1 ')
  // "size is 40", "my size is M", "size hai 9"
  q = q.replace(/\bsize\s+(?:is|hai|of)\s+/g, 'size ')
  // "5-star", "highest-rated", "out-of-stock", "sizes M and L"
  q = q.replace(/\b(\d)-star/g, '$1 star').replace(/\b(highest|best|top|most)-rated\b/g, '$1 rated').replace(/\b(in|out-of)-stock\b/g, (s) => s.replace(/-/g, ' ')).replace(/\bsizes\b/g, 'size')
  // "30 percent" → "30%"
  q = q.replace(/(\d{1,2})\s*(?:percent|per cent|pct)\b/g, '$1%')
  // "M or L size" → "size M or L" (before the single-size rewrite below)
  const SZ = String.raw`(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d{1,2}(?:\.5)?)`
  q = q.replace(new RegExp(String.raw`\b(${SZ}(?:\s*(?:,|or|and)\s*${SZ})+)\s*size\b`, 'g'), ' size $1 ')
  // "L size", "10 size", "size: M", "size no. 9"
  q = q.replace(new RegExp(String.raw`\b(${SZ})\s*(?:no\.?\s*)?size\b`, 'g'), ' size $1 ')
  q = q.replace(/\bsize\s*(?:[:=-]|no\.?|number)\s*/g, 'size ')
  return q.replace(/\s+/g, ' ').trim()
}

/** "make it L", "nike instead of puma", "only adidas": the new choice replaces the old one in its group. */
function isReplaceRequest(query: string): boolean {
  return /\b(instead|replace|change|switch|make it|rather|only|just|same|actually)\b/.test(normalizeQuery(query))
}

/**
 * For a replace request, also takes off what this chat applied earlier in the same group
 * (not price or sort: the sites keep only one of those anyway).
 */
export function withReplacements(query: string, choices: FilterChoice[], remembered: FilterChoice[]): FilterChoice[] {
  if (!isReplaceRequest(query) || isRemoveRequest(query)) return choices
  const out = [...choices]
  for (const c of choices.filter((c) => !c.remove && c.group !== SORT_GROUP && !/price/i.test(c.group)))
    for (const r of remembered)
      if (r.group === c.group && r.option !== c.option && !out.some((x) => x.group === r.group && x.option === r.option))
        out.push({ ...r, remove: true })
  return out
}

// At the start ("remove puma"), Hindi-style at the end ("puma hatao"), or "… remove it".
export const REMOVE = /^(?:(?:please|pls|now|also|kindly|can you|could you|would you)\s+)*(remove|delete|clear|unselect|uncheck|drop|undo|take off|take out|get rid of|hatao|hata do|hata|cancel|not(?!\s+(?:more|less|above|below|over|under|too|very|so|much|costly|expensive|cheap|exceeding)\b)|no need (?:of|for)|no more|(?:i )?don'?t (?:want|need)|(?:i )?do not (?:want|need)|nahi chahiye)\b|\b(hatao|hata do|hatado|nikalo|remove (?:it|them|that|this|those)|remove)$/

// "remove products rated below 3 stars" = 3 stars and up; "remove out of stock" = in stock only.
const NOT_REMOVE = /\b(?:below|under|less than|lower than)\s*\d(?:\.\d)?\s*(?:stars?|★)|\bout of stock\b(?!.*\bfilter)/

const CLEAR_ALL =
  /\b(clear|remove|reset|delete|undo)\s+(?:all|every|the)?\s*(?:the\s+)?filters?\b|\b(clear all|reset all|start over|start again|start fresh|sab hatao|saare hatao|sab clear)\b|\b(?:saare|sare|saari|sari|sab|sabhi)\s+(?:filters?\s+)?(?:hata do|hatado|hatao|hata dijiye|hata|nikalo|remove|clear)\b|^(?:please\s+)?(?:reset|clear|clear it|reset it|(?:remove|clear|delete|reset|undo) (?:all|everything|all of them|it all))$/

/** "remove puma", "hatao puma", "clear all filters" — a request to take filters off. */
export function isRemoveRequest(query: string): boolean {
  const q = normalizeQuery(query)
  return (REMOVE.test(q) && !NOT_REMOVE.test(q)) || CLEAR_ALL.test(q)
}

export function applyRules(query: string, w: Wanted): Wanted {
  const q = normalizeQuery(query)
  const out: Wanted = { ...w, terms: [...w.terms] }
  let m: RegExpMatchArray | null

  // ---- Price
  const range =
    q.match(new RegExp(String.raw`(?:between|from)\s+${MONEY}\s+(?:and|to|-)\s+${MONEY}${NOT_MONEY}`)) ??
    q.match(new RegExp(String.raw`${CUR}(\d[\d,]*k?)\s*(?:-|–|to)\s*${CUR}(\d[\d,]*k?)${NOT_MONEY}`))
  // Small amounts only with a currency written ("$20 - $50"): "9 to 10" is a shoe size.
  const priced = (m: RegExpMatchArray, v: number) => v >= 100 || /[$€£]|usd|eur|gbp|dollar|euro/.test(m[0])
  if (range && priced(range, amount(range[1])) && amount(range[2]) > amount(range[1])) {
    out.min_price = amount(range[1])
    out.max_price = amount(range[2])
  } else if ((m = q.match(new RegExp(String.raw`(?:around|approx(?:imately)?|about|roughly|near|~)\s*${MONEY}${NOT_MONEY}`))) && priced(m, amount(m[1]))) {
    out.min_price = Math.round(amount(m[1]) * 0.75)
    out.max_price = Math.round(amount(m[1]) * 1.25)
  } else {
    const MAX = String.raw`(?:under|below|less than|lesser than|lower than|within|up ?to|max(?:imum)?|budget(?:\s+[a-z]+){0,3}?|(?:max |maximum )?price to|not more than|no more than|at most|till|cheaper than|<=?)`
    const MIN = String.raw`(?:above|over|more than|greater than|higher than|min(?:imum)?|at ?least|starting(?: from| at)?|>=?)`
    if ((m = q.match(new RegExp(String.raw`${MAX}\s*${MONEY}${NOT_MONEY}`)))) {
      out.max_price = amount(m[1])
    }
    if ((m = q.match(new RegExp(String.raw`${MIN}\s*${MONEY}${NOT_MONEY}`)))) out.min_price = amount(m[1])
    if ((m = q.match(/(?:rs\.?|₹)?\s*(\d[\d,]*k?)\s*\+(?!\s*(?:star|rating|★))/)) && amount(m[1]) >= 100 && !out.min_price)
      out.min_price = amount(m[1]) // "1000+"
    // A bare amount with a currency ("shoes ₹2000", "2000 rs") is a budget.
    // ("\brs": the "rs" at the end of "sneakers 50" is not rupees.)
    if (!out.max_price && !out.min_price && (m = q.match(/(?:\b(?:rs\.?|inr|usd|eur|gbp)|[₹$€£])\s*(\d[\d,]*(?:\.\d+)?k?)|(\d[\d,]*(?:\.\d+)?k?)\s*(?:rs\b|rupees|dollars?\b|euros?\b|₹|€)/)))
      out.max_price = amount(m[1] ?? m[2])
    // The whole message is just a budget-like amount ("2000", "1999", "2k"). Small numbers are
    // sizes ("9"); odd numbers like "12345" are junk, not a budget.
    if (!out.max_price && !out.min_price && (m = q.match(/^(?:rs\.?|₹)?\s*(\d[\d,]*k?)$/))) {
      const v = amount(m[1])
      if (v >= 100 && v <= 10_000_000 && (v % 100 === 0 || v % 100 === 99))out.max_price = v
    }
  }
  // "make it 1000", "change budget to 3000" (small numbers are sizes: "make it 9")
  if (!out.max_price && (m = q.match(/\b(?:make it|change (?:it |the budget |budget |the price |price )?to|set (?:it |budget |price )?to)\s*(?:rs\.?|₹)?\s*(\d[\d,]*k?)\b(?!\s*(?:gb|tb|mah|mp|%|size|uk))/)) && amount(m[1]) >= 100)
    out.max_price = amount(m[1])
  if (out.min_price && out.max_price && out.min_price >= out.max_price) out.min_price = null

  // ---- Discount: "40% off", "min 30% discount"; "on sale" / "with discount" = any discount
  if ((m = q.match(/(\d{1,2})\s*%/))) out.min_discount = Number(m[1])
  else if (/\b(sale|discounted|with discount|any discount|(?:good|great|big|best|nice|some|a) discounts?|offers?|deals?)\b/.test(q.replace(/\btoday'?s? deals?\b/g, ''))) out.min_discount = -1 // "today's deals" is its own option

  // ---- Rating: "4 star", "4+ rating", "rated 4", "good reviews"
  if ((m = q.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|★|rating|rated)/) ?? q.match(/rated\s*(?:above\s*)?(\d(?:\.\d)?)/)))
    out.min_rating = Number(m[1])
  else if (/\b(good|great|high|best|top|well|highly|achhe|acche|achhi|acchi|achha|accha|badhiya)\s*(?:rating|ratings|reviews?|rated)\b/.test(q))
    out.min_rating = 4

  // ---- Sorting
  if (/\bsort(?:ed)? by (?:the )?(?:customer )?(?:rating|ratings|reviews?|stars?)\b/.test(q)) out.sort = 'rating'
  else if (/\bsort(?:ed)? by (?:the )?popular(?:ity)?\b/.test(q)) out.sort = 'popularity'
  else if (/\b(most expensive|costliest|high to low|highest price|expensive to cheap\w*)\b/.test(q) && !/\bcheap\w*\b.*\bexpensive\b/.test(q)) out.sort = 'price_desc'
  else if (/\bsort(?:ed)? by (?:the )?price\b(?!\s*(?:high|desc|from high))|\b(cheapest|cheaper|cheap|lowest price|low to high|price low|sasta|saste|sasti|budget friendly|affordable|inexpensive|low price|kam (?:daam|price|keemat))\b/.test(q)) out.sort = 'price_asc'
  else if (/\b(most expensive|costliest|expensive|high to low|price high|highest price|mehenga|mehnga)\b/.test(q) && !/\bnot (?:too |very |so |that )?(?:expensive|costly|pricey|mehenga|mehnga)\b/.test(q)) out.sort = 'price_desc'
  else if (!out.max_price && /\bnot (?:too |very |so |that )?(?:expensive|costly|pricey|mehenga|mehnga)\b/.test(q)) out.sort = 'price_asc'
  else if (/\b(newest|latest|new arrivals?|recently (?:added|launched)|new launch(?:es)?|just launched)\b/.test(q)) out.sort = 'newest'
  else if (/\b(popular|best ?sell(?:ing|ers?)|trending|top selling|most bought|most sold)\b/.test(q)) out.sort = 'popularity'
  else if (/\b(top rated|best rated|highest rated|best reviews?|most rated)\b/.test(q)) out.sort = 'rating'
  // "which phone is best?", "recommend a jacket": best rated first (popularity where a site has no rating order).
  else if (/\b(best|recommend(?:ed|ation)?s?|accha wala|sabse accha|badhiya)\b/.test(q) && !/\bbest (?:price|deals?|offers?|discounts?)\b/.test(q)) out.sort = 'rating'

  // ---- Remove / clear (chat follow-ups)
  out.clearAll = CLEAR_ALL.test(q)
  out.remove = !out.clearAll && REMOVE.test(q) && !NOT_REMOVE.test(q)

  // ---- Sizes: "size M", "size 9.5", "uk 9", "9 uk", or unambiguous ones like XL / XXL / 3XL anywhere.
  const sizes = [
    ...q.matchAll(/\bsize\s+(?:uk\s*)?([a-z0-9/]+(?:\.5)?)/g),
    // More sizes after the first: "size 9 and 10", "size M or L", "size s, m"
    ...[...q.matchAll(/\b(?:size\s+(?:uk\s*)?|uk\s*)[a-z0-9/]+(?:\.5)?((?:\s*(?:,|or|and)\s*(?:uk\s*)?(?:x{0,3}s|m|x{0,3}l|\dxl|\d{1,2}(?:\.5)?)\b(?![/\w]))+)/g)] // not the "3" of "size M, 3/4 sleeves"
      .flatMap((x) => [...x[1].matchAll(/(?:,|or|and)\s*(?:uk\s*)?([a-z0-9]+(?:\.5)?)/g)]),
    ...q.matchAll(/\buk\s*(\d{1,2}(?:\.5)?)\b/g),
    ...q.matchAll(/\b(\d{1,2}(?:\.5)?)\s*uk\b/g),
    ...q.matchAll(/\b(x{1,3}s|x{1,3}l|\dxl|\dxs)\b/g),
    // A bare size letter at the end of a short follow-up: "make it L", "change to M", "in S please", "M".
    ...q.matchAll(/(?:^|\bmake it|\bto|\bin|\bget)\s*\b(s|m|l)\b(?:\s+(?:please|pls|size|instead|one))?$/g),
    // Just a small number on its own ("9", "10.5"): a shoe size, not a price.
    ...q.matchAll(/^(\d{1,2}(?:\.5)?)$/g),
    // A small number right after a footwear word: "nike sneakers 9", "shoes 10.5"
    ...q.matchAll(/\b(?:shoes?|sneakers?|joot[ae]|jooti|footwear|slippers?|sandals?|boots?|chappals?|loafers?)\s+(\d{1,2}(?:\.5)?)\b(?!\s*(?:%|k\b|gb|star|rs|rupees|\d))/g),
  ].map((x) => x[1].toUpperCase())
  // Size words: "medium jacket" → M.
  const SIZE_WORDS: Record<string, string> = { 'extra large': 'XL', 'extra small': 'XS', small: 'S', medium: 'M', large: 'L' }
  for (const [word, code] of Object.entries(SIZE_WORDS))
    if (new RegExp(String.raw`\b${word}\b`).test(q) && !(code === 'L' && /extra large/.test(q)) && !(code === 'S' && /extra small/.test(q)))
      sizes.push(code)
  for (const s of sizes) if (!out.terms.some((t) => t.toUpperCase() === s)) out.terms.push(s)

  return out
}
