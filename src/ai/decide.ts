// What to do with one chat message: answer it, or pick filters. The side panel and the tests
// (scripts/everyday.mjs, scripts/edge.mjs) all call this, so they run exactly the same steps.
import { SORT_GROUP, type FilterChoice, type FilterGroup, type Page } from '../adapters/types'
import { compareNote, missingColourNote, noMatchReply, quickReply } from './reply'
import { isRemoveRequest, withReplacements } from './rules'

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
  // Only for removing: never re-apply a remembered filter the page no longer offers.
  const removing = isRemoveRequest(query)
  const groups = removing ? withRemembered(page.filters, remembered) : page.filters
  let choices = groups.length ? await choose(query, groups) : []
  // "remove it", "undo": the last filter this chat added.
  const last = [...remembered].reverse().find((r) => r.group !== SORT_GROUP)
  if (!choices.length && last && removing && /\b(it|that|this|last|undo|previous)\b/i.test(query))
    choices = [{ group: last.group, option: last.option, remove: true }]
  if (!choices.length) return searched ? { choices } : { reply: noMatchReply(query, page), choices }
  // "make it L", "nike instead of puma": also take off the earlier choice in that group.
  // "compare nike and puma": show both, and say comparing isn't possible here.
  // Say what couldn't be done too: "compare …", or a colour the page can't filter by.
  const final = withReplacements(query, choices, remembered)
  // (Colours already applied or being removed — "change black to blue" — are not missing.)
  const notes = [compareNote(query), missingColourNote(query, [...final, ...remembered], page)].filter(Boolean)
  return { choices: final, reply: notes.join(' ') || undefined }
}
