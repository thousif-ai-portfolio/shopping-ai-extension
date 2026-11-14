// On-device AI. Uses Chrome's built-in Gemini Nano (Prompt API, Chrome 138+) when this PC
// supports it; otherwise a small model run with Transformers.js (see fallback.ts).
// Either way the AI only picks out descriptive words; the same tested code (rules.ts, match.ts)
// turns them into filters, so both AIs behave the same way.
import type { FilterChoice, FilterGroup } from '../adapters/types'
import { extractWanted, preload } from './fallback'
import { matchFilters, STOP, type Wanted } from './match'
import { EXAMPLE_IN, EXAMPLE_OUT, SYSTEM } from './prompt'
import { applyRules } from './rules'

// The Prompt API is newer than @types/chrome, so declare the bits we use.
type Session = { prompt(text: string): Promise<string>; destroy(): void }
declare const LanguageModel:
  | {
      availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
      create(opts?: object): Promise<Session>
    }
  | undefined

// Set when Gemini Nano fails once: from then on the backup AI answers straight away (no ~20 s
// failed try per message) and the panel says so.
let nanoFailed = false

async function nanoUsable() {
  // ?ai=backup forces the backup AI (used by tests).
  if (nanoFailed || new URLSearchParams(location.search).get('ai') === 'backup') return false
  try {
    return typeof LanguageModel !== 'undefined' && (await LanguageModel.availability()) === 'available'
  } catch {
    return false
  }
}

export async function aiStatus(): Promise<string> {
  if (nanoFailed) return 'Qwen2.5-0.5B (backup: Gemini Nano did not work here)'
  return (await nanoUsable()) ? 'Gemini Nano (Chrome built-in)' : 'Qwen2.5-0.5B via Transformers.js'
}

/** Loads the backup model in the background right away (Gemini Nano needs no warm-up). */
export async function warmUp(onProgress: (msg: string) => void) {
  if (!(await nanoUsable())) await preload(onProgress)
}

async function nanoWanted(query: string, onProgress: (msg: string) => void): Promise<Wanted> {
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
    const reply = await session.prompt(query)
    const terms = reply.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)
    return { terms, max_price: null, min_price: null, min_discount: null, min_rating: null }
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
  // still downloading, …) falls back to the backup AI instead of breaking the extension.
  let fromAi: Wanted
  if (await nanoUsable()) {
    try {
      fromAi = await nanoWanted(query, onProgress)
    } catch (e) {
      console.warn('[ai] Gemini Nano failed, using backup AI:', e)
      nanoFailed = true
      fromAi = await extractWanted(query, onProgress)
    }
  } else {
    fromAi = await extractWanted(query, onProgress)
  }
  // Small models sometimes repeat words from the prompt's example ("running", "women");
  // keep only words the user actually typed. Numbers and filler words ("40", "no") are
  // dropped too: rules.ts reads numbers and sizes properly, in context.
  // Whole words only ("red" is inside "delivered" but was not typed); a plural still counts.
  const q = query.toLowerCase()
  const typed = (w: string) =>
    new RegExp(String.raw`(?<![\p{L}\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?(?![\p{L}\p{N}])`, 'u').test(q)
  fromAi.terms = fromAi.terms.filter((t) => {
    const lower = t.toLowerCase()
    return typed(lower) && !/\d/.test(lower) && lower.length >= 3 && !STOP.has(lower)
  })
  const wanted = applyRules(query, fromAi)
  console.log('[ai] model', JSON.stringify(fromAi), '→ after rules', JSON.stringify(wanted))
  return matchFilters(wanted, groups, query)
}
