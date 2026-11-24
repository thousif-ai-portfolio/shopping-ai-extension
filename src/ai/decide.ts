// What to do with one chat message: answer it, or pick filters. The side panel and the tests
// (scripts/everyday.mjs, scripts/edge.mjs) all call this, so they run exactly the same steps.
import { SORT_GROUP, type FilterChoice, type FilterGroup, type Page } from '../adapters/types'
import { cantNote, compareNote, missingColourNote, missingSizePriceNote, noMatchReply, quickReply } from './reply'
import { isRemoveRequest, normalizeQuery, withReplacements } from './rules'
import { filterWords, productIn, searchWords } from './product'

// reply alone: answer, apply nothing. reply + choices: apply, and show the reply as a note.
type Decision = { reply?: string; choices: FilterChoice[] }
type Choose = (query: string, groups: FilterGroup[]) => Promise<FilterChoice[]>

// The page's filter list plus anything this chat applied that the page no longer shows
// (a page with zero results can hide its whole filter list, so "remove nike" must still find Nike).
function withRemembered(groups: FilterGroup[], remembered: FilterChoice[]): FilterGroup[] {
  const out = groups.map((g) => ({ ...g, options: [...g.options] }))
  for (const r of remembered) {
    if (r.group === SORT_GROUP) continue
    const g = out.find((x) => x.name === r.group) ?? (out.push({ name: r.group, options: [] }), out[out.length - 1])
    if (!g.options.includes(r.option)) g.options.push(r.option)
  }
  return out
}

/**
 * remembered: what this chat already applied on this page.
 * searched: the site was just searched for this request (then the search itself is an answer).
 */
export async function decide(query: string, page: Page, remembered: FilterChoice[], choose: Choose, searched = false): Promise<Decision> {
  // Greetings, questions ("what brands are there?"), "what did you apply?": answer, apply nothing.
  const reply = searched ? null : quickReply(query, page, remembered)
  if (reply) return { reply, choices: [] }
  // Only for removing (or swapping: "nike instead of puma"): never re-apply a remembered filter
  // the page no longer offers. (A filtered page may not list the ticked brand any more.)
  const removing = isRemoveRequest(query) || /instead of/.test(normalizeQuery(query))
  const groups = removing ? withRemembered(page.filters, remembered) : page.filters
  let choices = groups.length ? await choose(query, groups) : []
  // Just searched for the product: a filter that only narrows it to a sub-type ("perfume" →
  // "Perfumed Cream & Solid Perfume") is not what was asked. Kept: options that are exactly
  // searched words ("Black", "Running") and ones matching words asked as filters ("size L").
  // The same when the product named is the one the page already shows ("any headphones on sale?"
  // on headphones results): "Device Type: Headphone" would hide the wireless ones.
  const pageProduct = productIn(page.searchTerm ?? '')
  if (searched || (pageProduct && productIn(query) === pageProduct)) {
    const plain = (w: string) => (/(?:ss|sh|ch|x|z)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w)
    // ("Men's Running Shoes" → men, running, shoe: the possessive is not a word of its own.)
    const toWords = (t: string) => t.toLowerCase().replace(/'s\b/g, '').split(/[^a-z0-9.]+/).map((w) => w.replace(/^\.+|\.+$/g, '')).filter(Boolean).map(plain)
    const sought = new Set(toWords(searchWords(query)))
    const asFilters = new Set(toWords(filterWords(query)))
    // The product itself ("Chair", "Headphones", "Shirts" as a category): the search did that already.
    const product = new Set((productIn(searchWords(query)) ?? []).map(plain))
    choices = choices.filter((c) => {
      const o = toWords(c.option)
      if (c.remove) return true
      if (o.length && o.every((w) => product.has(w) || product.has(plain(w)))) return false
      // ("T-SHIRT" as a brand: the product word written with a hyphen.)
      if ([...product].some((p) => p.replace(/[^a-z0-9]/g, '') === plain(o.join('')))) return false
      if (!searched) return true // same product as the page: only the product word itself is dropped
      return !o.some((w) => sought.has(w)) || o.every((w) => sought.has(w)) || o.some((w) => asFilters.has(w))
    })
  }
  // "nike instead of puma" where Nike isn't listed (a page filtered by Puma may show no other
  // brands): still take Puma off. The panel reads the page again for what is left (Nike).
  const swapped = normalizeQuery(query).match(/\binstead of (.+)$/)?.[1]
  if (!choices.length && swapped)
    choices = remembered.filter((r) => r.group !== SORT_GROUP && ` ${swapped} `.includes(` ${r.option.toLowerCase()} `)).map((r) => ({ ...r, remove: true }))
  // "remove it", "undo": the last filter this chat added.
  const last = [...remembered].reverse().find((r) => r.group !== SORT_GROUP)
  if (!choices.length && last && removing && /\b(it|that|this|last|undo|previous)\b/i.test(query))
    choices = [{ group: last.group, option: last.option, remove: true }]
  // Just searched: the search was the answer, unless filters were asked for too and none exist
  // on the new results ("brown shirt size L": say "size l" could not be applied, never stay silent).
  if (!choices.length && searched) {
    // The size/budget note says most ("No size 12 on this page (sizes here: …)"), else the words left.
    const rest = filterWords(query)
    return { choices, reply: missingSizePriceNote(query, choices, page) ?? (rest ? `No filter for "${rest}" on these results.` : undefined) }
  }
  if (!choices.length) return { reply: noMatchReply(query, page), choices }
  // "make it L", "nike instead of puma": also take off the earlier choice in that group.
  // "compare nike and puma": show both, and say comparing isn't possible here.
  // Say what couldn't be done too: "compare …", or a colour the page can't filter by.
  const final = withReplacements(query, choices, remembered)
  // (Colours already applied or being removed — "change black to blue" — are not missing.)
  const notes = [compareNote(query), cantNote(query, page), missingColourNote(query, [...final, ...remembered], page), missingSizePriceNote(query, [...final, ...remembered], page)].filter(Boolean)
  return { choices: final, reply: notes.join(' ') || undefined }
}
