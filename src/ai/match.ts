// Turns the user's request into real filter options on the page.
// Two sources, checked the same way:
//  1. Every option name on the page is looked for directly in the sentence ("red tape", "navy blue").
//  2. The words the AI picked out, plus sizes and numbers read by rules.ts.
// Only options that exist on the page can ever be chosen.
import { anyAmountCurrency, SORT_GROUP, SORT_LABELS, type FilterChoice, type FilterGroup } from '../adapters/types'
import { COMMON } from './common'
import { normalizeQuery, REMOVE, type SortKey } from './rules'

export type Wanted = {
  terms: string[]
  max_price: number | null
  min_price: number | null
  /** -1 = "on sale" without a number: the smallest discount the site offers. */
  min_discount: number | null
  min_rating: number | null
  sort?: SortKey | null
  /** "remove puma" / "clear all filters" (chat follow-ups) */
  remove?: boolean
  clearAll?: boolean
}

// Same meaning, different words. Applied to both the sentence and the option names.
const ALIASES: [RegExp, string][] = [
  [/&/g, ' and '],
  [/\bgr[ae]y(s)?\b/g, 'grey$1'],
  [/\bmulti[\s-]?colou?r(ed)?s?\b/g, 'multicolor'],
  [/\bcolou?rs?\b/g, 'color'],
  // (canon() strips apostrophes first: "men's" arrives as "mens".)
  [/\b(men|man)s\b/g, 'men'],
  [/\b(women|woman)s\b/g, 'women'],
  [/\b(ladies|lady|female|feminine)\b/g, 'women'],
  [/\b(gents|gent|male|gentlemen)\b/g, 'men'],
  [/\b(?:man|guy|gentleman)\b/g, 'men'], [/\bwoman\b/g, 'women'],
  // "big battery", "long battery life", "good battery backup" → Flipkart's "Long-Lasting Battery"
  [/\b(?:big|long|good|large|huge|best)(?:\s+lasting)?\s+battery(?:\s+(?:life|backup))?\b|\bbattery\s+backup\b/g, 'long lasting battery'],
  // Gifts: "for my wife" → women, "for my son" → boys.
  [/\bfor (?:my |your |our )?(wife|girlfriend|gf|mother|mom|mummy|mum|sister|her|aunt|bhabhi|didi)\b/g, 'for women'],
  [/\bfor (?:my |your |our )?(husband|boyfriend|bf|father|dad|papa|brother|him|uncle|bhai)\b/g, 'for men'],
  [/\bfor (?:my |your |our )?(son|nephew|little boy)\b/g, 'for boys'], [/\bfor (?:my |your |our )?(daughter|niece|little girl)\b/g, 'for girls'],
  [/\bone\s*plus\b/g, 'oneplus'], [/\bu\s*s\s*polo\b/g, 'us polo'],
  [/\bhood(ed|ie|y)\b/g, 'with hood'],
  [/\b3\/4(th)?\b/g, 'three quarter'],
  [/\biphones?\b/g, 'apple'], [/\bmoto\b/g, 'motorola'], [/\b(?:google )?pixel\b/g, 'google'],
  // "delivered today", "same day delivery" → Amazon's "Get It Today"
  [/\b(?:deliver(?:ed|y)?|arriv\w*|get it|reach\w*)\s+(?:by\s+)?today\b|\btodays?\s+delivery\b|\bsame[\s-]day delivery\b|\b(?:available for )?(?:immediate|instant|express|quick|fast)\s+delivery\b/g, 'get it today'],
  [/\b(?:remove|hide|exclude|without|no|skip)\s+(?:the\s+|all\s+)?out[\s-]of[\s-]stock\b/g, 'exclude out of stock'],
  // Phone features in everyday words
  [/\bface\s*(?:unlock|lock|id)\b/g, 'face recognition'],
  [/\b(?:usb[\s-]?)?type[\s-]?c\b/g, 'usb type c'],
  [/\b(?:keypad|button|basic|feature)\s+(?:mobile|phone)s?\b/g, 'feature phone keypad'],
  [/\bwashable\b/g, 'wash'],
  [/\b(cash on delivery|cod)\b/g, 'pay on delivery'],
  [/\bfree (delivery|shipping)\b/g, 'free shipping'],
  // "in stock only" = Flipkart's "Exclude Out of Stock" (Amazon hides out-of-stock items already).
  [/\b(?:in[\s-]?stock|available(?! in\b| for\b))(?: only| items| products)?\b|\bonly (?:in[\s-]?stock|available)\b/g, 'exclude out of stock'],
  // "no hood" / "non-hooded" mean the same as "without hood", so options named
  // "Without …" match. It is still a negation, so "no puma" still excludes PUMA.
  [/\b(no|non)[\s-]+(?=[a-z])/g, 'without '],
  // A few common Hindi colour words.
  [/\bkaa?l[ai]\b/g, 'black'], [/\bsaf(?:e|ai|ae)d\b/g, 'white'], [/\blaa?l\b/g, 'red'], [/\bne+la\b|\bnila\b/g, 'blue'],
  [/\bhara\b|\bhari\b/g, 'green'], [/\bpe+la\b|\bpili\b/g, 'yellow'], [/\bgulabi\b/g, 'pink'], [/\bbhura\b/g, 'brown'],
  [/\bnarangi\b/g, 'orange'], [/\bbaingani\b/g, 'purple'],
]
// Near-synonyms, used only when the exact word is not an option on the page: "maroon" picks
// Maroon where a site has it, otherwise Red. Tried in order.
const SYNONYMS: Record<string, string[]> = {
  maroon: ['burgundy', 'red'], burgundy: ['maroon', 'red'], wine: ['maroon', 'burgundy', 'red'], crimson: ['red'],
  navy: ['navy blue', 'dark blue', 'blue'], golden: ['gold'], violet: ['purple'], voilet: ['purple'],
  multicolor: ['multi'], multi: ['multicolor'], cream: ['off white', 'beige', 'ivory'], ivory: ['off white', 'cream'],
  sky: ['light blue', 'blue'], tan: ['brown', 'camel'], camel: ['tan', 'brown'], khaki: ['beige', 'olive'],
  checked: ['checkered'], checkered: ['checked'], check: ['checkered', 'checked'],
  gym: ['training or gym', 'exercising'], tomorrow: ['get it by tomorrow'], velcro: ['hook and loop'],
}
// Equivalent size codes used by different sites. (Size words like "medium" → M are read by rules.ts.)
const SIZE_SAME: Record<string, string> = { XXS: '2XS', '2XS': 'XXS', XXL: '2XL', '2XL': 'XXL', XXXL: '3XL', '3XL': 'XXXL' }

// Never matched from free text: too common, or handled by rules (numbers, sizes).
export const STOP = new Set(['no', 'yes', 'all', 'max', 'min', 'free', 'any', 'the', 'one', 'get', 'buy', 'new', 'top', 'made', 'pack', 'special', 'include', 'eligible', 'single', 'regular', 'standard', 'extra', 'with', 'for', 'by', 'and', 'or', 'off', 'up', 'in', 'on', 'not', 'without', 'except', 'non'])
const NEGATORS = new Set(['not', 'no', 'without', 'except', 'excluding', 'avoid', 'non', 'dont', 'never', 'nahi', 'nahin', 'instead', 'replace', 'change', 'rather'])

const canon = (s: string) => {
  let t = s.toLowerCase().replace(/([a-z])\.(?=[a-z])/g, '$1').replace(/'/g, '') // "u.s." → "us"
  for (const [re, to] of ALIASES) t = t.replace(re, to)
  return t
}
// Words without punctuation, singular ("reds" → "red") so plurals match.
const words = (s: string) =>
  canon(s).replace(/[^a-z0-9,\s]/g, ' ').replace(/,/g, ' , ').split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

const numbers = (s: string) => (s.replace(/,/g, '').match(/\d+(\.\d+)?/g) ?? []).map(Number)

// Best option in groups whose name matches `groupRe`, scoring each by its numbers.
function bestNumeric(
  groups: FilterGroup[],
  groupRe: RegExp,
  score: (nums: number[], text: string) => number | null,
): FilterChoice | null {
  let best: { c: FilterChoice; s: number } | null = null
  for (const g of groups.filter((g) => groupRe.test(g.name))) {
    for (const o of g.options) {
      const s = score(numbers(o), o)
      if (s !== null && (!best || s > best.s)) best = { c: { group: g.name, option: o }, s }
    }
  }
  return best?.c ?? null
}

// ---- Numbers with units: "8gb ram", "128 gb storage", "5000mah", "64mp", "120hz", "6.5 inch"
const UNIT = /\d[\d,.]*\s*(gb|tb|mah|mp|ghz|hz|inch|cm)\b/i
const RANGE = /\d\s*(-|to)\s*\d|&|above|below|up to|less than|%|₹|\d\s*x\s*\d/i
const UNIT_WORDS: Record<string, RegExp> = { hz: /hz|hertz|refresh/i, inch: /inch|screen|display size/i }
// Words near the number that say which group is meant (both RAM and storage use GB).
const CONTEXT: [RegExp, RegExp][] = [
  [/\bram\b/, /\bram\b/i],
  [/\b(storage|rom|memory|internal|space)\b/, /storage|rom|memory|capacity/i],
  [/\b(front|selfie)\b/, /front|secondary|selfie/i],
  [/\b(rear|back|main|primary)\b/, /rear|primary|back|main/i],
  [/\bbattery\b/, /battery/i],
]
const toNum = (s: string) => Number(s.replace(/,/g, ''))

// Does an option like "128 - 255.9 GB", "Up to 1.9 GB", "6000 mAh & Above", "8 GB" contain v?
function optionHolds(option: string, v: number) {
  const o = option.toLowerCase().replace(/,/g, '')
  let m: RegExpMatchArray | null
  if ((m = o.match(/(\d+(?:\.\d+)?)\s*[a-z]*\s*(?:-|to)\s*(\d+(?:\.\d+)?)/))) return v >= +m[1] && v <= +m[2]
  if ((m = o.match(/(?:up to|less than|below|under)\s*(\d+(?:\.\d+)?)/))) return v <= +m[1]
  if ((m = o.match(/(\d+(?:\.\d+)?)\s*[a-z]*\s*(?:&|and)\s*below/))) return v <= +m[1]
  if ((m = o.match(/(\d+(?:\.\d+)?)\s*[a-z]*\s*(?:&|and)\s*above/))) return v >= +m[1]
  if ((m = o.match(/^(\d+(?:\.\d+)?)\s*[a-z]*$/))) return v === +m[1]
  return false
}

// q: the normalized (lowercase) query.
function unitChoices(q: string, groups: FilterGroup[]): FilterChoice[] {
  const out: FilterChoice[] = []
  for (const m of q.matchAll(/(\d+(?:[.,]\d+)?)\s*(gb|tb|mah|mp|ghz|hz|inch(?:es)?|cm)\b/g)) {
    let v = toNum(m[1])
    let unit = m[2].replace(/es$/, '')
    if (unit === 'tb') { unit = 'gb'; v *= 1024 }
    const re = new RegExp(String.raw`\d\s*${unit}\b`, 'i')
    const fits = groups.filter(
      (g) => g.options.some((o) => re.test(o)) || UNIT_WORDS[unit]?.test(g.name),
    )
    if (!fits.length) continue
    // Pick the group from nearby words ("8gb ram", "128gb storage"), else a sensible default.
    // The word right after the number counts first ("8gb ram and 128gb storage").
    const after = q.slice(m.index! + m[0].length, m.index! + m[0].length + 15)
    const before = q.slice(Math.max(0, m.index! - 15), m.index!)
    const byContext = (text: string) =>
      CONTEXT.map(([word, name]) => (word.test(text) ? fits.find((g) => name.test(g.name)) : undefined)).find(Boolean)
    let group = byContext(after) ?? byContext(before)
    if (!group && unit === 'gb') group = fits.find((g) => (v <= 24 ? /\bram\b/i : /storage|rom|memory|capacity/i).test(g.name))
    if (!group && unit === 'mp') group = fits.find((g) => /rear|primary|back/i.test(g.name))
    group ??= fits[0]
    const option = group.options.find((o) => optionHolds(o, v))
    if (option) out.push({ group: group.name, option })
  }
  return out
}

type Candidate = { group: string; option: string; seq: string[] }

export function matchFilters(w: Wanted, groups: FilterGroup[], rawQuery = ''): FilterChoice[] {
  // "clear all filters" → one special choice the adapters understand.
  if (w.clearAll) return [{ group: '*', option: '*', remove: true }]
  const query = normalizeQuery(rawQuery)
  const out: FilterChoice[] = []
  const add = (c: FilterChoice | null | undefined) => {
    if (c && !out.some((x) => x.group === c.group && x.option === c.option)) out.push(c)
  }
  // Categories are skipped: the search already picks the product type. Sorting is separate.
  // (Whole words: "Operating System" contains "rating" but is not a rating group.)
  const textGroups = groups.filter(
    (g) => g.name !== SORT_GROUP && !/\b(price|discount|ratings?|reviews?|categor\w*)\b/i.test(g.name),
  )
  // Sub-categories with a distinctive word ("Nehru Jackets") are still worth matching;
  // plain ones ("Jackets") are not, since every jacket request would pick them.
  const categoryGroups = groups.filter((g) => /\bcategor\w*\b/i.test(g.name))

  // Word sequences each option can be recognised by.
  const all: Candidate[] = []
  for (const g of categoryGroups)
    for (const o of g.options) {
      const seq = words(o)
      const own = seq.filter((x) => !COMMON.has(x) && !STOP.has(x))
      if (own.length) all.push({ group: g.name, option: o, seq }, ...(seq.length > 1 && own[0] === seq[0] && /^[a-z]{3,}/.test(seq[0]) ? [{ group: g.name, option: o, seq: [seq[0]] }] : []))
    }
  for (const g of textGroups)
    for (const o of g.options) {
      // Yes/No groups ("Reversible: Yes", "GPS Navigation: True"): the group's name means Yes.
      if (/^(yes|true)$/i.test(o) && g.options.length <= 3) {
        const seq = words(g.name)
        if (seq.length && !seq.every((x) => COMMON.has(x))) all.push({ group: g.name, option: o, seq })
        continue
      }
      // Options with numbers: only simple codes like "5G", "4K", "2XL", "Android 14".
      // Plain numbers and ranges (sizes, pack sizes) are handled by rules.ts, and number+unit
      // values ("8 GB", "5000 - 5999 mAh") by unitChoices below.
      if (/\d/.test(o) && (!/[a-z]/i.test(o) || RANGE.test(o) || UNIT.test(o))) continue
      // ("Products", "Items" alone: page junk, and every request says "show products".)
      if (/^(?:all )?(?:products?|items?|results?)$/i.test(o)) continue
      const seq = words(o)
      if (!seq.length || (seq.length === 1 && (seq[0].length < (/\d/.test(seq[0]) ? 2 : 3) || STOP.has(seq[0])))) continue
      // Brands made only of everyday words ("Classic", "Good One", "Stylish Kurta") are too risky.
      if (/brand|seller/i.test(g.name) && seq.every((w) => COMMON.has(w))) continue
      all.push({ group: g.name, option: o, seq })
      // "Biker/Riding Jacket" is also "biker jacket" and "riding jacket" (beats a brand named "Biker").
      const alt = o.match(/^([^/\s]+)\/(\S+)(.*)$/)
      if (alt) for (const a of [alt[1], alt[2]]) { const s = words(a + alt[3]); if (s.length > 1) all.push({ group: g.name, option: o, seq: s }) }
      if (seq[0] === 'the' && seq.length > 2) all.push({ group: g.name, option: o, seq: seq.slice(1) }) // "north face"
      // "Eligible for Pay On Delivery" / "Eligible for Free Delivery": "pay on delivery", "free delivery"
      if (seq[0] === 'eligible' && seq[1] === 'for' && seq.length > 3) all.push({ group: g.name, option: o, seq: seq.slice(2) })
    }
  // Short forms of long names: "us polo" for "U.S. POLO ASSN.", "hrx" for "HRX by Hrithik Roshan".
  const firstWordUsedElsewhere = (c: Candidate) =>
    all.some((x) => x.option !== c.option && x.seq.includes(c.seq[0]))
  for (const c of [...all]) {
    // (Not when both words are everyday words: "The White Pole" must not match "the white sneakers".)
    // (Not two bare numbers: "2,5-seat mod sofa" is not "2 5", which a price "₹2,500" also says.)
    if (c.seq.length >= 3 && !c.seq.slice(0, 2).every((w) => COMMON.has(w) || STOP.has(w)) && c.seq.slice(0, 2).some((w) => /[a-z]/.test(w)))
      all.push({ ...c, seq: c.seq.slice(0, 2) })
    if (c.seq.length >= 2 && c.seq[0].length >= 3 && !STOP.has(c.seq[0]) && !COMMON.has(c.seq[0]) && !firstWordUsedElsewhere(c))
      all.push({ ...c, seq: [c.seq[0]] })
  }
  all.sort((a, b) => b.seq.length - a.seq.length) // longest first: "red tape" before "red"

  // 1. Look for option names in the sentence itself.
  const q = words(query)
  const used = new Array(q.length).fill(false)
  // Words right after "not/no/without/except" (up to a comma or "and/but") are excluded.
  const negated = new Array(q.length).fill(false)
  // An option whose name starts with the negator ("Without Hood", "No Cleats") is the thing asked
  // for, not a negation: "jacket without hood in black" still wants Black.
  const isOptionAt = (i: number) =>
    all.some((c) => c.seq[0] === q[i] && c.seq.length > 1 && c.seq.every((s, k) => q[i + k] === s))
  // In a remove request the negated words are what to remove ("don't want black, remove it").
  for (let i = 0; i < q.length && !w.remove; i++)
    if (NEGATORS.has(q[i]) && !isOptionAt(i))
      for (let j = i + 1; j < q.length && j <= i + 3; j++) {
        // "instead of puma show nike" ends at "show"; "don't want puma" / "don't show puma" do not.
        if ([',', 'and', 'but', 'with', 'to'].includes(q[j]) || (j > i + 1 && ['show', 'give', 'want', 'get'].includes(q[j]))) break
        negated[j] = true
      }

  const hits: (Candidate & { at: number })[] = []
  const tryMatch = (same: (a: string, b: string) => boolean) => {
    for (const c of all)
      for (let i = 0; i + c.seq.length <= q.length; i++) {
        if (c.seq.some((s, k) => used[i + k] || !same(q[i + k], s))) continue
        c.seq.forEach((_, k) => (used[i + k] = true))
        // Several groups can have the same option ("High" in Arch Type and Cushioning). If the
        // word next to it names a group ("high cushioning"), use that group and consume the word.
        // (Everyday words like "shoes" don't count: "mesh shoes" is not a hint for "Shoe Material".)
        const end = i + c.seq.length
        const namesGroup = (j: number, group: string) =>
          j >= 0 && j < q.length && !COMMON.has(q[j]) && words(group).includes(q[j])
        const named = all.find(
          (x) => x.seq.join(' ') === c.seq.join(' ') && [i - 1, end].some((j) => !used[j] && namesGroup(j, x.group)),
        )
        const pick = named ?? c
        if (named) [i - 1, end].forEach((j) => { if (namesGroup(j, named.group)) used[j] = true })
        if (!negated[i]) hits.push({ ...pick, at: i })
        break
      }
  }
  tryMatch((a, b) => a === b)
  // Typos: one letter off ("pumma" → "puma", "blak" → "black"). Both words must be 4+ letters
  // and one 5+, so short everyday words don't turn into brands ("nice" ≠ "nike").
  // Real typos are not dictionary words, so everyday words are never "corrected" ("light" ≠ "right").
  // A misspelt everyday word is that word, not a brand: "jackt" is "jacket", not "Jack & Jones".
  const nearCommon = new Map<string, string[]>()
  const misspeltCommon = (a: string, b: string) => {
    if (!nearCommon.has(a)) nearCommon.set(a, [...COMMON].filter((c) => c.length >= 4 && Math.abs(c.length - a.length) <= 1 && editDistance(a, c) <= 1))
    const near = nearCommon.get(a)!
    return near.length > 0 && !near.includes(b)
  }
  tryMatch((a, b) => !COMMON.has(a) && Math.min(a.length, b.length) >= 4 && Math.max(a.length, b.length) >= 5 && editDistance(a, b) <= 1 && !misspeltCommon(a, b))
  // Synonyms for words that matched nothing ("maroon" → Red when the site has no Maroon).
  for (let i = 0; i < q.length; i++) {
    if (used[i] || negated[i] || !SYNONYMS[q[i]]) continue
    for (const target of SYNONYMS[q[i]]) {
      const t = words(target).join(' ')
      const c = all.find((x) => x.seq.join(' ') === t)
      if (c) { used[i] = true; hits.push({ ...c, at: i }); break }
    }
  }
  hits.sort((a, b) => a.at - b.at)
  // Two colours right next to each other ("olive green") describe one colour: keep the first.
  // (Only colours: "lightweight breathable" really is two features.)
  hits.forEach((h, i) => {
    const prev = hits[i - 1]
    const oneColour = prev && prev.group === h.group && /colou?r/i.test(h.group) && prev.at + prev.seq.length === h.at
    if (!oneColour) add({ group: h.group, option: h.option })
  })

  // 2. The AI's words and rule-detected sizes. Skip words the user negated, and words already
  //    explained by a longer name above ("red" in "red tape" must not also add colour Red).
  const negatedWords = new Set(q.filter((_, i) => negated[i]))
  const usedWords = new Set(q.filter((_, i) => used[i]))
  for (const term of w.terms) {
    const t = words(term)
    if (!t.length || t.every((x) => negatedWords.has(x) || usedWords.has(x))) continue
    // Shoe sizes are "9" on some sites and "UK9" on others (Myntra).
    const codes = [term.toUpperCase(), SIZE_SAME[term.toUpperCase()], /^\d/.test(term) ? `UK${term}` : ''].filter(Boolean)
    // A size ("9", "M") on a page with a size filter is looked for there only, never in another
    // group that happens to have an option read as "9" (Tata Cliq) or "M".
    const sizeShaped = /^(?:\d+(?:\.\d+)?|x{0,3}[sl]|m|\d?x{1,3}l)$/i.test(term)
    const sizeGroups = sizeShaped ? textGroups.filter((g) => /size/i.test(g.name)) : []
    // Exact option name ("Black", "M"), else an equivalent size code ("XXL" ↔ "2XL").
    for (const g of sizeGroups.length ? sizeGroups : textGroups) {
      const o =
        g.options.find((o) => words(o).join(' ') === t.join(' ')) ??
        // ("UK 10" with a space on some shops = "UK10"; Tata Cliq's "UK/IND-9" = "UK9")
        g.options.find((o) => [o.toUpperCase(), o.toUpperCase().replace(/\s+/g, ''), o.toUpperCase().replace(/^(?:UK|IND)(?:\s*\/\s*(?:UK|IND))?\s*[-:]?\s*/, 'UK')].some((x) => codes.includes(x))) ??
        // Sizes in two systems ("8 - eu 42", "9 (EU 43)", Zara "M (UK M)"): the first one is the size asked for.
        (/^(?:\d+(?:\.\d+)?|x{0,3}[sl]|m|\d?x{1,3}l)$/i.test(term) && /size/i.test(g.name)
          ? g.options.find((o) => o.match(/^(\d+(?:\.\d+)?|x{0,3}[sl]|m|\d?x{1,3}l)\s*[-–(/]\s*[a-z]/i)?.[1]?.toUpperCase() === term.toUpperCase())
          : undefined)
      if (o) { add({ group: g.name, option: o }); break }
    }
  }

  unitChoices(query, textGroups).forEach(add)

  // "pack of 2", "3 pack", "2 pcs"
  const pack = query.match(/\bpack of (\d+)\b|\b(\d+)\s*(?:pack|pcs|pieces)\b/)
  if (pack) {
    const v = Number(pack[1] ?? pack[2])
    const g = textGroups.find((g) => /^(pack of|number of items)$/i.test(g.name))
    const o = g?.options.find((o) => optionHolds(o, v))
    if (g && o) add({ group: g.name, option: o })
  }

  const max = w.max_price
  const min = w.min_price
  // Sites whose price takes any amount (Amazon, price boxes on other shops): use exactly what was
  // asked, in the page's currency ("₹1800", "$80").
  const exact = (re: RegExp, v: number | null) => {
    const g = v ? groups.find((g) => re.test(g.name) && g.options.some((o) => anyAmountCurrency(o) !== null)) : undefined
    const currency = g?.options.map(anyAmountCurrency).find((c) => c !== null)
    // Rupee amounts are whole (Amazon reads "₹499.50" as 49950): down for a maximum, up for a minimum.
    const amount = v && currency === '₹' ? (re.source.includes('max') ? Math.floor(v) : Math.ceil(v)) : v
    return g ? { group: g.name, option: `${currency}${amount}` } : null
  }
  // A price range option has only amounts and range words ("₹500 - ₹999", "Under Rs.500"): not a
  // product name with numbers that slipped into the list (IKEA: "2,5-seat mod sofa").
  const priceLike = (o: string) =>
    !/[a-z]{2,}/i.test(o.replace(/\b(?:and above|and below|or more|or less|under|below|above|over|up ?to|upto|rs|inr|less|more|than|and|between|to|k)\b/gi, ''))
  const exactMin = exact(/min price/i, min)
  const exactMax = exact(/max price/i, max)
  add(exactMax)
  add(exactMin)
  const minChoice = exactMin ? null : min ? bestNumeric(groups, /min price/i, (n) => (n.length && n[0] <= min ? n[0] : null)) : null
  const minValue = minChoice ? numbers(minChoice.option)[0] : 0
  // A budget above every value in the dropdown ("under 1 lakh", top value ₹30000+) means no upper limit:
  // pick the "₹30000+" option instead of cutting the results at ₹30000.
  const top = groups.find((g) => /max price/i.test(g.name))?.options.filter((o) => !o.includes('+')).map((o) => numbers(o)[0] ?? 0)
  const aboveAll = !!max && !!top?.length && max > Math.max(...top)
  if (max && !exactMax && aboveAll) add(bestNumeric(groups, /max price/i, (_, o) => (o.includes('+') ? 1 : null)))
  else if (max && !exactMax) {
    // "Max price" dropdown (Flipkart): highest value not above the limit; if that is
    // not above the chosen minimum, the next value up (so the range is never empty).
    const c =
      bestNumeric(groups, /max price/i, (n, o) => (n.length && !o.includes('+') && n[0] <= max && n[0] > minValue ? n[0] : null)) ??
      (minChoice ? bestNumeric(groups, /max price/i, (n, o) => (n.length && !o.includes('+') && n[0] > minValue ? -n[0] : null)) : null)
    if (c) add(c)
    // A list of price ranges ("500 & Below", "₹1,000 - ₹1,800", "Up to ₹500"): every range that fits
    // the budget (and the minimum, if one was asked). Ticking only the top one would hide everything
    // cheaper.
    else
      for (const g of groups.filter((g) => /^price$/i.test(g.name)))
        for (const o of g.options) {
          const n = numbers(o)
          if (n.length && priceLike(o) && !/over|above|\+/i.test(o) && n[n.length - 1] <= max && (!min || n[0] >= min - 1)) add({ group: g.name, option: o })
        }
  }
  add(minChoice)
  // Only a minimum ("above 3000", "over $150") and a list of ranges: every range from there up.
  if (min && !max && !exactMin && !minChoice && !groups.some((g) => /min price/i.test(g.name)))
    for (const g of groups.filter((g) => /^price$/i.test(g.name)))
      for (const o of g.options) {
        const n = numbers(o)
        if (n.length && priceLike(o) && n[0] >= min - 1 && !/below|under|up ?to|less/i.test(o)) add({ group: g.name, option: o })
      }
  const disc = w.min_discount
  const below = /below|under|up ?to|less|</i
  // A list of discount ranges ("0 - 10", "30 - 40": Snapdeal; "20% To 40%": Croma): every range
  // starting at the asked minimum or higher (any range above 0 for "on sale"), so nothing shown
  // has less discount than asked.
  const rangeList = (g: FilterGroup) => /discount/i.test(g.name) && g.options.filter((o) => /\d\s*%?\s*(?:[-–]|to)\s*\d/i.test(o)).length >= 2
  if (disc && groups.some(rangeList)) {
    for (const g of groups.filter(rangeList))
      for (const o of g.options) {
        const n = numbers(o)
        if (n.length && !below.test(o) && (disc === -1 ? n[0] > 0 : n[0] >= disc)) add({ group: g.name, option: o })
      }
  }
  // "40% and above" / "40% Off or more": highest threshold not above what was asked.
  // -1 ("on sale"): the smallest discount the site offers.
  else if (disc === -1) add(bestNumeric(groups, /discount/i, (n, o) => (o.includes('%') && n.length && !below.test(o) ? -n[0] : null)))
  else if (disc) add(bestNumeric(groups, /discount/i, (n, o) => (o.includes('%') && n.length && n[0] <= disc && !below.test(o) ? n[0] : null)))
  const rating = w.min_rating
  if (rating) add(bestNumeric(groups, /\b(ratings?|reviews?)\b/i, (n) => (n.length && n[0] <= rating ? n[0] : null)))

  if (w.remove) {
    // "remove the brand filter", "remove price": a whole group, when no single option was named.
    const named = new Set(q.filter((x) => x.length >= 3 && !['the', 'all', 'filter'].includes(x)))
    // "remove synthetic material": a word besides the group's name means one option, not the group.
    const other = [...named].some((x) => !/^(?:products?|items?|filters?|please|pls|price|them|that|this|those|also|now|chahiye|need|want|dont|rid|take|out|can|you|could|would|kindly|off)$/.test(x) &&
      !REMOVE.test(x) && !STOP.has(x) && !NEGATORS.has(x) && !groups.some((g) => words(g.name).includes(x)))
    for (const g of other ? [] : groups) {
      if (g.name === SORT_GROUP || out.some((c) => c.group === g.name)) continue
      const isPrice = /price/i.test(g.name) && named.has('price')
      if (isPrice || words(g.name).some((x) => named.has(x))) add({ group: g.name, option: '*' })
    }
    return out.map((c) => ({ ...c, remove: true }))
  }

  // Sorting ("cheapest", "newest"…), if the site offers that order.
  const sortGroup = groups.find((g) => g.name === SORT_GROUP)
  const sort = w.sort === 'rating' && !sortGroup?.options.includes(SORT_LABELS.rating) ? 'popularity' : w.sort
  if (sort && sortGroup?.options.includes(SORT_LABELS[sort])) add({ group: SORT_GROUP, option: SORT_LABELS[sort] })
  return out
}
