// On-device AI: Chrome's built-in Gemini Nano (Prompt API, Chrome 138+) when this PC supports it.
// The AI only picks out descriptive words; the tested rules (rules.ts, match.ts) turn the message
// into filters. Without Gemini Nano those rules work alone: prices, sizes, sorting and any filter
// named in the message still apply, only vaguer wording is missed.
import { escapeRe, type FilterChoice, type FilterGroup } from '../adapters/types'
import { matchFilters, STOP, type Wanted } from './match'
import { EXAMPLE_IN, EXAMPLE_OUT, SYSTEM } from './prompt'
import { applyRules } from './rules'

// Set when Gemini Nano fails once: from then on the rules answer straight away.
let nanoFailed = false

async function nanoUsable() {
  if (nanoFailed) return false
  try {
    return typeof LanguageModel !== 'undefined' && (await LanguageModel.availability()) === 'available'
  } catch {
    return false
  }
}

export async function aiStatus(): Promise<string> {
  return (await nanoUsable()) ? 'Gemini Nano (Chrome built-in)' : 'Rules only (Gemini Nano is not available on this PC)'
}

async function askNano(query: string, onProgress: (msg: string) => void): Promise<string> {
  onProgress('AI is reading your request…')
  const session = await LanguageModel!.create({
    initialPrompts: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: EXAMPLE_IN },
      { role: 'assistant', content: EXAMPLE_OUT },
    ],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  })
  try {
    return await session.prompt(query)
  } finally {
    session.destroy()
  }
}

export async function chooseFilters(
  query: string,
  groups: FilterGroup[],
  onProgress: (msg: string) => void = () => {},
): Promise<FilterChoice[]> {
  // Gemini Nano could not be tested on the dev laptop, so any failure (API differences, model
  // still downloading, …) falls back to the rules alone instead of breaking the extension.
  let reply = ''
  if (await nanoUsable()) {
    try {
      reply = await askNano(query, onProgress)
    } catch (e) {
      console.warn('[ai] Gemini Nano failed, using the rules alone:', e)
      nanoFailed = true
    }
  }
  const fromAi: Wanted = {
    terms: reply.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
    max_price: null, min_price: null, min_discount: null, min_rating: null,
  }
  // Small models sometimes repeat words from the prompt's example ("running", "women");
  // keep only words the user actually typed. Numbers and filler words ("40", "no") are
  // dropped too: rules.ts reads numbers and sizes properly, in context.
  // Whole words only ("red" is inside "delivered" but was not typed); a plural still counts.
  const q = query.toLowerCase()
  const typed = (w: string) =>
    new RegExp(String.raw`(?<![\p{L}\p{N}])${escapeRe(w)}(?:s|es)?(?![\p{L}\p{N}])`, 'u').test(q)
  fromAi.terms = fromAi.terms.filter((t) => {
    const lower = t.toLowerCase()
    return typed(lower) && !/\d/.test(lower) && lower.length >= 3 && !STOP.has(lower)
  })
  const wanted = applyRules(query, fromAi)
  console.log('[ai] model', JSON.stringify(fromAi), '→ after rules', JSON.stringify(wanted))
  return matchFilters(wanted, groups, query)
}
