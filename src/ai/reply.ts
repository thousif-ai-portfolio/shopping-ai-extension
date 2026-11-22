// Answers messages that are not filter requests: greetings, thanks, "help", "what brands are
// there?", "what did you apply?", returns/delivery questions. Plain rules, so these answers are
// instant (no AI call) and never apply a filter by mistake.
// Returns null when the message should go on to the filter step.
import { SORT_GROUP, type FilterChoice, type Page } from '../adapters/types'
import { COLOURS, productIn } from './product'
import { applyRules, isRemoveRequest, normalizeQuery } from './rules'

const EXAMPLE = 'e.g. "black puma jacket under 2000", "size M", "cheapest first" or "remove puma"'

const clean = (q: string) =>
  q.toLowerCase().replace(/[^\p{L}\p{N}₹%&'\s.+-]/gu, ' ').replace(/\s+/g, ' ').trim()

// The whole message is only these words (a greeting, a thank-you, …).
const only = (words: string) => new RegExp(String.raw`^(?:(?:${words})\s*)+$`)
const GREETING = only(String.raw`hi+|hello+|hey+|heya|hlo|helo|yo|hola|namaste|namaskar|sup|good (?:morning|afternoon|evening|night)|there|bro|buddy|ji|sir|madam|dear|guys|all|everyone|again`)
const THANKS = only(String.raw`thanks?|thank you|thank u|thanku|thankyou|thx|thnx|thnks|thanx|tq|ty|bhai|bro|yaar|dude|that helped|it helped|helped|helpful|very helpful|that worked|it worked|worked|ok+|okay|k|cool|great|nice|good|awesome|perfect|super|done|fine|got it|bye|goodbye|see you|shukriya|dhanyavaa?d|dhanyawaa?d|dhanyabad|accha|acha|theek hai|thik hai|sahi|so much|very much|a lot|lot|alright|wow|amazing|it works|works|working|yes|yeah|yup|no|nope|nah|great job|well done|good job|right|sure|hmm+|lol`)
const HELP = /^(?:help|help me|how (?:do i|to|can i|does (?:this|it)) (?:use|work)\b.*|what (?:can|do|should) (?:you|i) (?:do|type|say|ask|write)\b.*|what (?:is|are) (?:this|you)\b.*|who are you\b.*|how (?:does|do) (?:this|it|you) work\b.*|what all can you do.*|kya kar sakte ho.*|how to use.*|how (?:do i|to|can i|should i) (?:search|filter|find|ask)\b.*|(?:mujhe )?(?:madad|help) (?:chahiye|karo|kijiye|kar do)|madad|(?:ye |yeh |isko |ise )?(?:kaise use (?:kare|karu|karein|karen|karna hai|kar[eu]n?)|use kaise (?:kare|karu|karein|karen|karna hai)|kaise chala(?:ye|un|na hai|te hai))\b.*|instructions|guide|menu|start|commands?)$/

// Shop questions this extension cannot answer (it only filters, sorts and searches).
const OFF_TOPIC: [RegExp, string][] = [
  [/\b(gift wrap(?:ping)?|gift pack(?:ing)?)\b/, 'gift wrapping'],
  [/\b(prime|membership|subscription|plus member|insider)\b/, 'memberships'],
  [/\bexchange (?:my|old|offer|value)\b|\bexchange offer\b|\bold phone\b/, 'exchange offers'],
  [/\b(return policy|returns?|returnable|refunds?|replacement|exchange policy|exchange it|exchange this|wapas)\b/, 'returns, refunds or exchanges'],
  [/\b(track|tracking|where is my|order status|my order|cancel (?:my |the |this )?order|order cancel|cancel it)\b/, 'your orders'],
  [/\b(when will .* (?:deliver\w*|arriv\w*|come|reach\w*|ship\w*)|delivery (?:time|date|charges?)|how (?:many|long) days|kab (?:aayega|ayega|milega)|shipping (?:time|charges?|cost))\b/, 'delivery times or charges'],
  [/\b(warranty|guarantee)\b/, 'warranty'],
  [/\b(emi|no cost emi|credit card|debit card|upi|payment|pay later|bank offer|cash on delivery|pay on delivery|cod)\b/, 'payments, EMI or bank offers'],
  [/\b(customer (?:care|care number|support|service)|helpline|contact (?:number|seller|amazon|flipkart|myntra|support|you)|complain|complaint)\b/, 'customer support'],
  [/\b(coupon|promo code|voucher|gift card|cashback)\b/, 'coupons, vouchers or cashback'],
  [/\b(login|log in|sign in|signup|sign up|password|my account|address|pincode|pin code)\b/, 'your account or address'],
  [/\b(add (?:it |this |them )?to (?:my )?cart|add to cart|buy (?:it|this|now) for me|place (?:the |an |my )?order|checkout|order (?:it|this) for me|purchase (?:it|this) for me)\b/, 'buying or adding to the cart'],
  [/\b(weather|news|joke|song|movie|cricket|score|recipe|translate|your name|how are you|kaise ho|kaisa hai|who made you|are you (?:a )?(?:bot|human|ai|real)|i love you|love you|marry me|miss you|poem|poetry|story|essay|homework|write me|what time|time is it|what day|today'?s date)\b/, 'that'],
]

// "what brands are there?", "which colours do you have", "list sizes", "konse brand hai"
const QUESTION = /\b(what|which|list|kaun ?se|konse|kon se|kaun ?sa|konsa|kon sa|kaun ?si|konsi|kon si|kya kya|other)\b/
const ASK = /\b(show|tell|available|options?|have|there|got)\b/
// [words in the message, filter group names, label]. The (s) capture marks a plural ("brands").
const TOPICS: [RegExp, RegExp, string][] = [
  [/\bbrand(s)?\b/, /^brands?$/i, 'Brands'],
  [/\bcolou?r(s)?\b|\brang\b/, /colou?r/i, 'Colours'],
  [/\bsize(s)?\b/, /^(?!screen|display).*size/i, 'Sizes'], // not a phone's "Screen Size"
  [/\b(?:material|fabric)(s)?\b/, /material|fabric/i, 'Materials'],
  [/\bdiscount(s)?\b/, /^discount/i, 'Discounts'],
  [/\bram\b()/, /\bram\b/i, 'RAM'],
  [/\bstorage\b()/, /storage/i, 'Storage'],
  [/\b(?:type|style|kind)(s)?\b/, /^(type|type of shoes|shoe type|shape|lifestyle|sport)$/i, 'Types'],
]

const listOf = (options: string[], n = 12) =>
  options.slice(0, n).join(', ') + (options.length > n ? ` and ${options.length - n} more` : '')

export const label = (c: FilterChoice) => (c.option === '*' ? `${c.group}: all` : `${c.group}: ${c.option}`)

/** An instant answer for a message that isn't a filter request, or null. */
export function quickReply(query: string, page: Page, applied: FilterChoice[]): string | null {
  const q = clean(query)
  const site = page.site

  // Empty, emoji-only or punctuation-only messages.
  if (!/[\p{L}\p{N}]/u.test(q)) return `Tell me what you're looking for, ${EXAMPLE}.`
  if (GREETING.test(q)) return `Hi! 👋 Tell me what you're looking for on ${site}, ${EXAMPLE}.`
  if (THANKS.test(q)) return `You're welcome! Tell me if you want to change anything, ${EXAMPLE}.`
  // "Hi! Can you help me?": the greeting doesn't matter, the question does.
  const rest = q.replace(/^(?:(?:hi+|hello+|hey+|hlo|namaste|good (?:morning|afternoon|evening))\b[\s,.]*)+/, '').trim()
  if (HELP.test(rest) || /^(?:can|could|will) you help(?: me)?$|^i need help$/.test(rest))
    return `I filter, sort and search ${site} for you. Type what you want in your own words, ${EXAMPLE}. ` +
      `Ask "what brands are there?" to see the options, or "what did you apply?" to see the filters.`

  // "what filters did you apply?", "current filters", "kya lagaya"
  if (/\b(what|which|show|current|active|applied|selected)\b.*\b(filters?)\b.*\b(applied|apply|on|selected|active|added|now|used|set)\b|\bwhat (?:did|have) you (?:apply|applied|select|selected|add|added|do|done)\b|\b(current|active|applied|selected) filters?\b|\bkya (?:lagaya|apply kiya)\b|\bkya filters? (?:laga|lage|lagaya)\b|\b(?:konse|kaunse|kon se|kaun se) filters? (?:laga|lage|lagaye)\b/.test(q)) {
    const list = applied.filter((c) => c.group !== SORT_GROUP)
    const sort = applied.find((c) => c.group === SORT_GROUP)
    if (!list.length && !sort) return 'No filters from this chat are on the page right now.'
    return 'Applied in this chat: ' + [...list.map(label), ...(sort ? [`sorted by ${sort.option}`] : [])].join(', ') + '.'
  }

  // "what filters are there / can I use?"
  if ((/\b(what|which|list|show|available)\b.*\bfilters?\b|\bfilters?\b.*\b(available|there|can i use|do you have)\b|^(?:all |the )?filters?(?: list| options)?$/.test(q)) && !/\b(apply|add|remove|clear)\b/.test(q)) {
    const names = page.filters.filter((g) => g.name !== SORT_GROUP && g.options.length).map((g) => g.name)
    if (!names.length) return `I can't see any filters on this ${site} page. Search for a product first.`
    return `Filters on this page: ${listOf(names, 15)}. Tell me what you want, ${EXAMPLE}.`
  }

  // Questions about the options in one group: "what brands are there", "show me all sizes".
  // Not when an option is named ("show me size M", "which puma colours…" still filter).
  if (!/\d/.test(q)) {
    for (const [word, groupRe, name] of TOPICS) {
      const m = q.match(word)
      // A question, "show me all brands", or just the plural word alone ("sizes", "brands?").
      // "discount options?", "colour options pls" count too.
      if (!m || !(QUESTION.test(q) || ((m[1] !== undefined || /\boptions?\b/.test(q)) && (ASK.test(q) || q === m[0])))) continue
      const g = page.filters.find((x) => groupRe.test(x.name) && x.options.length)
      if (!g) return `This ${site} page has no ${name.toLowerCase()} filter.`
      // (Any option of the page named in full counts: "show only top brands" is Amazon's "Top Brands".)
      const named = page.filters.some((x) => x.options.some((o) => (x === g ? o.length > 1 : o.length > 4) && ` ${q} `.includes(` ${o.toLowerCase()} `))) || /\bsizes?\s+(?:x{0,3}[sml]|\dxl)\b/.test(q)
      if (named) break
      return `${name} on this page: ${listOf(g.options)}. Say one, e.g. "${g.options[0]}".`
    }
    // "price range?", "how much do these cost"
    if (/\b(price range|how much|kitne ka|kitna|how (?:expensive|costly|pricey))\b|\bwhat (?:is|are) the (?:price|prices|cost)\b|^(?:price|prices|cost|budget|rate|daam)$/.test(q))
      return `Tell me your budget, e.g. "under 2000", "between 1000 and 3000" or "cheapest first".`
  }

  // "cash on delivery" is a real filter on Amazon ("Pay On Delivery"): let the filter step apply it.
  const codFilter = page.filters.some((g) => g.options.some((o) => /pay on delivery/i.test(o)) || /pay on delivery/i.test(g.name))
  if (codFilter && /\b(cash on delivery|pay on delivery|cod)\b/.test(q)) return null

  // "next page", "show more": scrolling and pages are the site's job.
  if (/^(?:please |pls )?(?:next page|previous page|prev page|page \d+|go to page \d+|show more|load more|more|more results|more products|more options|aur dikhao|aur dikhao na)$/.test(q))
    return `Sorry, I can't change pages. Scroll down on ${site} to see more products, or tell me a filter to narrow them down.`
  // Frustration: "you are useless", "stupid bot", "not working". Apologise and show how to ask.
  if (/^(?:(?:you|u|this|this bot|bot|it)(?: are| r| is)? )?(?:so |very |really )?(?:useless|stupid|dumb|idiot|bakwas|bekar|bekaar|worst|rubbish|trash|bad bot|not working|doesn'?t work|not helpful|no use)(?: bot| app| extension)?$|^(?:stupid|dumb|useless|bad|worst) (?:bot|app|extension|ai)$/.test(q))
    return `Sorry, I can only filter, sort and search ${site}, and I may have misread you. Try saying it another way, ${EXAMPLE}.`

  for (const [re, topic] of OFF_TOPIC)
    if (re.test(q))
      return topic === 'that'
        ? `Sorry, I can only help with shopping on ${site}: filtering, sorting and searching. Try ${EXAMPLE}.`
        : `Sorry, I can't help with ${topic}. I only filter, sort and search products. Please check ${site}'s Help page for that.`

  return null
}

/** "compare iphone and samsung", "is this jacket good?": a note that this can't be judged here. */
// (Comparing prices across sites never reaches here: the panel runs compareSites for that.)
export function compareNote(query: string): string | null {
  const q = clean(query)
  const asks =
    /\b(compare|comparison|difference|vs|versus|better than|which is better|worth|should i buy|review of|specs?|specifications?)\b/.test(q) ||
    /\b(?:is|are) (?:it|this|that|these|those|the)\b.*\b(good|nice|worth|ok|okay|original|genuine|durable|reliable)\b/.test(q)
  return asks
    ? `I can't compare or review products, but I can show the best rated first (say "top rated") or filter by brand, price and more.`
    : null
}

/** "White isn't a colour filter on this page": colours asked for that no applied filter covers. */
export function missingColourNote(query: string, choices: FilterChoice[], page: Page): string | null {
  const q = ` ${clean(query)} `
  const chosen = choices.map((c) => c.option.toLowerCase()).join(' | ')
  // The real colour list ("Color"), not "Colour Family" (Pastel, Earthy…).
  const colourGroup = page.filters.find((g) => /^colou?rs?$/i.test(g.name)) ?? page.filters.find((g) => /colou?r/i.test(g.name) && !/family/i.test(g.name))
  const searched = ` ${(page.searchTerm ?? '').toLowerCase()} `
  const missing = COLOURS.filter((c) =>
    q.includes(` ${c} `) &&
    !searched.includes(` ${c} `) && // the search itself already asked for it ("pink cotton kurta")
    !new RegExp(String.raw`\b(?:not|no|without|except|remove|hatao)\s+(?:\w+\s+)?${c}\b|\b${c}\s+(?:hatao|nahi|nhi)\b`).test(q) &&
    !chosen.includes(c === 'gray' ? 'grey' : c) &&
    !(c === 'navy' && chosen.includes('blue')),
  )
  if (!missing.length) return null
  const names = missing.map((c) => c[0].toUpperCase() + c.slice(1)).join(' and ')
  return colourGroup
    ? `Not on this page: ${names} (colours here: ${listOf(colourGroup.options, 8)}). Search the site for it to see more colours.`
    : `Not on this page: ${names} (this page has no colour filter).`
}

/**
 * "No size L here", "no price filter here": a size or budget asked for that nothing applied
 * covers, so it is never dropped silently (the page may not offer it, or set prices by a slider).
 */
export function missingSizePriceNote(query: string, choices: FilterChoice[], page: Page): string | null {
  if (isRemoveRequest(query)) return null
  const q = normalizeQuery(query)
  const notes: string[] = []
  const size = q.match(/\bsize\s+(?:is\s+|of\s+|=\s*)?(uk\s*\d+(?:\.5)?|\d+(?:\.5)?|x{0,3}[sl]|m|\d?x{1,3}l)\b/)
  if (size && !choices.some((c) => /size/i.test(c.group))) {
    const g = page.filters.find((g) => /size/i.test(g.name))
    notes.push(g ? `No size ${size[1].toUpperCase()} on this page (sizes here: ${listOf(g.options, 8)}).` : "I couldn't find a size filter on this page.")
  }
  const w = applyRules(query, { terms: [], max_price: null, min_price: null, min_discount: null, min_rating: null })
  if ((w.max_price || w.min_price) && !choices.some((c) => /price/i.test(c.group)))
    // (A page with a price list where nothing fits is not "no price filter".)
    notes.push(page.filters.some((g) => /price/i.test(g.name))
      ? 'No price option on this page fits that budget, so it was not applied.'
      : "I couldn't find a price filter I can set on this page, so the budget was not applied.")
  // Rating, discount and sorting asked for but nothing on the page fits.
  for (const [n, re, what] of [[w.min_rating, /\b(ratings?|reviews?)\b/i, 'rating'], [w.min_discount, /discount/i, 'discount']] as const)
    if (n && n > 0 && q.includes(String(n)) && !choices.some((c) => re.test(c.group))) {
      const g = page.filters.find((g) => re.test(g.name) && g.name !== SORT_GROUP)
      notes.push(g ? `No ${what} option on this page fits that (options here: ${listOf(g.options, 6)}).` : `I couldn't find a ${what} filter on this page.`)
    }
  if (w.sort && !choices.some((c) => c.group === SORT_GROUP))
    notes.push(page.filters.some((g) => g.name === SORT_GROUP) ? "This page can't be sorted that way." : "I couldn't find a sort option on this page.")
  return notes.join(' ') || null
}

/** Things shops rarely offer, said plainly: sorting by discount, an in-stock filter. */
export function cantNote(query: string, page: Page): string | null {
  const q = normalizeQuery(query)
  if (/\b(?:most|highest|biggest|max(?:imum)?) discount(?:ed|s)?\b|\bdiscount (?:high to low|first)|\bsort(?:ed)? by discount/.test(q))
    return "I can't sort by discount; use a discount filter instead."
  if (/\b(?:in stock|out of stock)\b/.test(q) && !page.filters.some((g) => g.options.some((o) => /exclude out of stock|in stock|availab/i.test(o))))
    return page.filters.some((g) => g.options.some((o) => /include out of stock/i.test(o)))
      ? 'Out-of-stock items are already hidden on this page.'
      : 'No in-stock filter on this page.'
  // "remove all adidas products": filters only show things, so an unticked brand can't be hidden.
  if (isRemoveRequest(query) && /\b(?:products|items)\b/.test(q))
    return "Shops can't hide just one brand, colour or material from the results; I can only take off a filter that is ticked."
  return null
}

/** Shown when no filter could be matched, so the user always learns what to do next. */
export function noMatchReply(query: string, page: Page): string {
  const product = productIn(query)
  const note = compareNote(query) ?? cantNote(query, page) ?? missingColourNote(query, [], page) ?? missingSizePriceNote(query, [], page) ??
    (product?.some((w) => ` ${(page.searchTerm ?? '').toLowerCase()} `.includes(` ${w}`)) ? `These results are already "${page.searchTerm}".` : null)
  if (note) return note
  const names = page.filters.filter((g) => g.name !== SORT_GROUP && g.options.length).map((g) => g.name)
  return `No matching filters for "${query.trim()}" on this page. ` +
    (names.length ? `This page has filters for ${listOf(names, 6)}. ` : '') +
    `Try ${EXAMPLE}.`
}
