import { anyAmount, SORT_GROUP, SORT_LABELS, navigateSoon, samePage, wait, type FilterChoice, type FilterGroup, type Product, type SiteAdapter } from './types'

// Any other shop. There is no site-specific knowledge here, only what most shops have in common:
// - Filters are checkboxes / radios (real <input>s or role="checkbox") under a heading
//   ("Brand", "Size"), often a <fieldset><legend>, an accordion button, or an <h3>.
// - Sort is a <select> whose name or label says "sort"; other <select>s are filters too.
// - Price is a pair of min/max boxes; typing an amount works (so any amount, like Amazon).
// - Search is a GET form with a text box, else most shops answer /search?q=.
// Clicking a filter may update the page in place or reload it; when it reloads, the choices
// still to apply are kept in sessionStorage and applied after the new page loads.

const MIN_PRICE = 'Min price'
const MAX_PRICE = 'Max price'
const PENDING = 'ai-shopping-filters:pending'

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
// Same text, ignoring case ("Black" = "black").
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
// "Nike (123)", "Men with 22,884 items" → "Nike", "Men" (only a count like that: "UK 9" stays)
const clean = (t: string) =>
  t.replace(/\s*(?:[([]\d[\d,]*(?:\s*(?:items?|products?|results?))?[)\]]|(?:with|,) [\d,]+ (?:items?|products?|results?))\s*$/i, '').replace(/\s+/g, ' ').trim()
// A group heading without what shops add to it: "Color(0) Clear" → "Color", "Size Filter" → "Size".
const cleanHeading = (t: string) =>
  clean(t).replace(/^\d{1,3}(?=[a-z])/i, '').replace(/\d+\s*products?\d*$/i, '').replace(/\s*\(\d+\)/g, ' ').replace(/(?:\s*(?:select all|clear(?: all)?|reset|×|✕|\|))+\s*$/i, '').replace(/\s+filters?$/i, '').replace(/\s+/g, ' ').trim()
// Text only screen readers get ("XS <span class=visually-hidden>XS (1000 products)</span>").
const SCREEN_READER_ONLY = '.sr-only, .visually-hidden, [class*="visually-hidden" i], [class*="sr-only" i], [class*="screen-reader" i], [class*="screenreader" i], [class*="a11y-hidden" i], [class*="sronly" i]'
const visible = (el: Element) => {
  const r = (el as HTMLElement).getBoundingClientRect?.()
  return !!r && (r.width > 0 || r.height > 0)
}
// Cookie banners, newsletter boxes, site menus: never filters. (Popups are not excluded as such:
// on many shops the filters themselves open in one.)
// (Not the page itself: a cookie script marks <html>/<body> "show--consent" while its banner shows.)
const MARKED = ['[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]', '[class*="newsletter" i]'].map((s) => `${s}:not(html, body)`).join(', ')
const NOT_FILTERS = `header, footer, nav, ${MARKED}`
// Site menus are skipped, but some shops put their filter bar in a <nav> or a sticky <header>
// (Puma): those count when they visibly hold filters.
const holdsFilters = (box: Element) =>
  /filter|facet|refine/i.test(`${box.id} ${box.getAttribute('class') ?? ''} ${box.getAttribute('aria-label') ?? ''}`) ||
  !!box.querySelector('[aria-controls*="filter" i], [aria-controls*="facet" i], [data-test-id*="filter" i], [data-testid*="filter" i]')
const skipped = (el: Element) => {
  // A consent dialog without "cookie" in its names (cookieconsent's "cm"/"pm" boxes, Lenskart).
  const dialog = el.closest('[role="dialog"], [aria-modal="true"], [role="alertdialog"]')
  if (dialog && /\bcookies?\b/i.test((dialog.textContent ?? '').slice(0, 1000))) return true
  const box = el.closest(NOT_FILTERS)
  return !!box && !(/^(NAV|HEADER)$/.test(box.tagName) && holdsFilters(box) && !el.closest(`footer, ${MARKED}`))
}

type Control = { group: string; label: string; el: HTMLElement }
const shownControl = (el: HTMLElement) => visible(el) || (el instanceof HTMLInputElement && [...(el.labels ?? [])].some(visible))

// --- Checkboxes and radios

const isOn = (el: HTMLElement) =>
  el instanceof HTMLInputElement
    ? el.checked
    : ['aria-checked', 'aria-pressed', 'aria-selected'].some((a) => el.getAttribute(a) === 'true') ||
      !!el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false' ||
      [...el.classList].some((c) => !c.includes(':') && (/^(?:[\w-]*[-_])?(?:active|selected|checked|is-on)$/i.test(c) || /[-_]item(?:active|selected)(?:$|[-_])/i.test(c)))
// Whether an option shows if it is ticked (a real box, or aria-checked/-pressed/-selected).
const canTell = (el: HTMLElement) =>
  el instanceof HTMLInputElement || ['aria-checked', 'aria-pressed', 'aria-selected'].some((a) => el.hasAttribute(a))
const isRadio = (el: HTMLElement) => (el instanceof HTMLInputElement && el.type === 'radio') || el.getAttribute('role') === 'radio' || el.getAttribute('role') === 'menuitemradio'
// A radio can't be unticked by clicking it; its group's "All" / "Any" option takes it off.
const ANY_OPTION = /^(all|any|none|everything|show all)\b/i

// Text that a number belongs to: "8 - eu 42", "UK 9", "128 GB" (the number is not a count).
// (No one-letter units: "L <span>15</span>" is size L with 15 items, not 15 litres.)
const NUMBER_IS_NAME = /(?:\b(?:eu|uk|us|size|cm|mm|inch|gb|tb|ml|kg|ltr|litre|liter|(?<!\b(?:and|or)\s)(?:under|over|above|below)|upto|up to|to|and)|[-–:/×&₹$€£])\s*$/i

// An option's text without a count shown in its own element at the end ("Men <span>143</span>"
// → "Men"; "Above <span>4</span>★ <span>78</span>" → "Above 4★"). Only when something is left: a
// size option "<span>9</span>" stays "9".
function optionText(e: Element | null | undefined): string {
  if (!e) return ''
  const copy = e.cloneNode(true) as Element
  // Drop screen-reader copies when visible text remains (else they are the only name there is).
  const hidden = [...copy.querySelectorAll(SCREEN_READER_ONLY)]
  if (hidden.length && hidden.reduce((n, h) => n + text(h).length, 0) < text(copy).length) hidden.forEach((h) => h.remove())
  // A row of star icons is the rating: "Above ★★★★☆" → "Above 4★" (filled stars share the first
  // star's look; the empty ones look different).
  for (const row of copy.querySelectorAll('*')) {
    const stars = [...row.children].filter((x) => x.tagName.toLowerCase() === 'svg' || x.tagName === 'I')
    if (stars.length < 3 || stars.length > 5 || stars.length !== row.children.length) continue
    const look = (x: Element) => `${x.getAttribute('class')} ${x.getAttribute('fill')}`
    row.replaceWith(` ${stars.filter((x) => look(x) === look(stars[0])).length}★ `)
  }
  const last = [...copy.querySelectorAll('*')].filter((x) => !x.children.length && text(x)).pop()
  const before = () => copy.textContent!.trim().slice(0, -last!.textContent!.trim().length).trim()
  if (last && /^\(?\d[\d,]*\)?$/.test(text(last)) && copy.textContent!.trim().endsWith(last.textContent!.trim()) &&
    !NUMBER_IS_NAME.test(before())) last.remove()
  return text(copy) || text(e)
}

// MUI: <div><span class=MuiCheckbox><span><input></span></span><h6>Beige (428)</h6></div>: the text is
// beside the box, in the smallest box around it that holds no other option.
function rowText(el: HTMLElement): string {
  for (let p = el.parentElement, i = 0; p && i < 4; i++, p = p.parentElement) {
    if (p.querySelectorAll(CHECKS).length > 1) return ''
    const t = optionText(p)
    if (t) return t
  }
  return ''
}

function labelOf(el: HTMLElement): string {
  const own =
    (el instanceof HTMLInputElement && el.labels?.[0] ? optionText(el.labels[0]) : '') ||
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') ? text(document.getElementById(el.getAttribute('aria-labelledby')!.split(' ')[0])) : '') ||
    optionText(el.closest('label')) ||
    (el instanceof HTMLInputElement ? '' : optionText(el)) ||
    // eBay-style: <a><span><input></span> Nike</a>, the text is a few levels up.
    optionText(el.parentElement) || optionText(el.parentElement?.parentElement) || optionText(el.closest('a, li')) || rowText(el) ||
    el.getAttribute('title') ||
    (el instanceof HTMLInputElement ? el.value : '')
  return clean(own)
}

const CHECKS = 'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="switch"]'
// Shops whose filters are plain links or buttons (no checkbox) still put them in a box called
// "filters" / "facets" / "refinements": only there are links read as options.
const FACET_BOX = '[class*="filter" i], [id*="filter" i], [class*="facet" i], [id*="facet" i], [class*="refine" i], [id*="refine" i], [aria-label*="filter" i]'
// Tailwind's CSS classes "filter", "backdrop-filter", "hover:filter" are not filter boxes.
const CSS_ONLY = /^(?:[\w-]+:)*(?:backdrop-)?filter(?:-none)?$/i
const facetBoxes = (): HTMLElement[] => {
  const named = namedFacetBoxes()
  // (Also when some unrelated box is named "filter": a "Hide Filters" button.)
  const side = priceSidebar().filter((p) => !named.some((n) => n.contains(p)))
  return [...named, ...side]
}
// No box named "filter"/"facet" (Nike: generated class names only): the box around the price
// inputs, grown while it holds no product cards (linked pictures).
function priceSidebar(): HTMLElement[] {
  const box = [...document.querySelectorAll<HTMLInputElement>('input[type="number"], input[type="text"], input:not([type])')].find((i) =>
    /min|max|price|amount/i.test(`${i.name} ${i.id} ${i.placeholder} ${i.getAttribute('aria-label') ?? ''}`) && !skipped(i))
  if (!box) return []
  let side: HTMLElement | null = null
  for (let p = box.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.querySelectorAll('img').length > 8 || p.querySelector('a[href] img')) break
    side = p
  }
  return side ? [side] : []
}
const namedFacetBoxes = () =>
  [...document.querySelectorAll<HTMLElement>(FACET_BOX)].filter(
    (b) => (b.id || b.getAttribute('aria-label') || [...b.classList].some((c) => /filter|facet|refine/i.test(c) && !CSS_ONLY.test(c))) &&
      // "collection-with-filters" around the product grid: its product links are not options.
      b.querySelectorAll('img').length <= 8 &&
      !b.querySelector('[class*="product-card" i], [class*="productcard" i], [class*="product-tile" i], [class*="product-grid" i], [class*="product-list" i], [class*="productlist" i]'),
  )
const FACET_LINKS = 'li a[href], li button, a[role="option"], [role="option"]'
// "Show more", "+ 25 more", "Clear", "Apply": buttons in a filter list, not options.
const NOT_AN_OPTION = /^(show|view|see|load) (more|less|all)\b|^[-–]\s*less$|^\+?\s*\d*\s*more$|^(clear|reset|apply|done|close|cancel|ok|select|deliver to)\b|^(?:go|submit|compare)$|^option:|^(?:all )?(?:products?|items?|results?)$|^(?:view|show|see) (?:\d+ )?results?\b/i
const HEADING = 'legend, h1, h2, h3, h4, h5, h6, [role="heading"], summary, button[aria-expanded], [class*="title" i], [class*="header" i], [class*="heading" i], ' +
  '[class*="filter-name" i], [class*="filtername" i], [class*="filter_name" i], [class*="facet-name" i], [class*="facetname" i], [class*="filter-head" i], [class*="facet-head" i], [class*="filter-label" i], [class*="facet-label" i]'
// Headings that name the whole filter panel or the results, not one group.
const GENERIC_HEADING = /^(?:filters?|filter by|refine(?: by| results)?|narrow (?:by|results)|shop by|sort (?:&|and) filter|filter (?:&|and) sort|search results.*|showing .*|\d[\d,]* (?:items|products|results).*|all filters|clear all|skip to (?:main )?(?:content|results)|less|more|(?:view|show|see) (?:d+ )?results?)$/i
// A checkbox's own name used as its group ("gender", "size_ind" → "Size") when the heading doesn't say.
const groupFromName = (el: HTMLElement) => {
  const name = el instanceof HTMLInputElement ? el.name : ''
  if (!/^[a-z][a-z0-9_ .-]{1,30}$/i.test(name) || /^(?:filters?|check(?:box)?|options?|values?|on|items?|selected|facets?|f|q|search|terms?|agree)$/i.test(name)) return ''
  const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').replace(/\b(?:ind|id|v\d|facet|filter|attr|attribute|s)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : ''
}
// Text inside an option row ("<li><input> <span class=title>Nike</span></li>") is not a group
// heading: some box around it, below the part shared with the control, holds a checkbox.
function inOptionRow(h: Element, el: Element) {
  for (let p = h.parentElement; p && !p.contains(el); p = p.parentElement) if (p.querySelector(CHECKS)) return true
  return false
}
// The name of the filter group a control is in: a <fieldset> legend or a labelled group around it,
// else the nearest heading above it (walking back through the page) that is not itself an option.
function groupOf(el: HTMLElement, known?: Map<Element, string>): string {
  for (let node = el.parentElement, depth = 0; node && depth < 10; depth++, node = node.parentElement) {
    if (node instanceof HTMLFieldSetElement && node.querySelector('legend')) return cleanHeading(text(node.querySelector('legend')))
    const named = node.getAttribute('aria-label') && /^(group|region|radiogroup|listbox)$/.test(node.getAttribute('role') ?? '') && !/filter|refine/i.test(node.getAttribute('aria-label')!)
    if (named) return clean(node.getAttribute('aria-label')!)
    // A region named by its accordion header (Tata Cliq: aria-labelledby="accordion-header-Heel Type").
    const by = /^(group|region|radiogroup|listbox)$/.test(node.getAttribute('role') ?? '') && node.getAttribute('aria-labelledby')
    const byText = by ? cleanHeading(optionText(document.getElementById(by) ?? document.getElementById(by.split(' ')[0]))) : ''
    if (byText && byText.length <= 40 && !GENERIC_HEADING.test(byText)) return byText
  }
  // A section made of a title and a body (Nike: generated class names, no heading tags): the title.
  // Only for plain clickable options: real checkboxes have proper headings (Ajio, Snapdeal), found below.
  if (!el.matches(CHECKS))
    for (let node = el.parentElement, depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const [head, body] = [...node.children]
      if (node.children.length === 2 && body.contains(el) && !head.contains(el) && !head.querySelector(CHECKS) && head.className !== body.className) {
        // (The title part of a header that also holds buttons: "Gender" + an arrow, not "Select All".)
        const t = head.children.length > 1 && text(head.children[0]).length > 1 ? text(head.children[0]) : text(head)
        if (t.length > 1 && t.length <= 30) return cleanHeading(t)
      }
    }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  walker.currentNode = el
  // (A long brand list puts a few thousand elements between an option and its heading.)
  for (let i = 0, h: Node | null; i < 5000 && (h = walker.previousNode()); i++) {
    // Reached an earlier option with no heading in between: same group (a big speed-up on long lists).
    if (known?.has(h as Element) && !(h as Element).contains(el)) return known.get(h as Element)!
    if (h instanceof HTMLElement && h.matches('a, button, [role="button"]') && !h.querySelector(CHECKS) && h.nextElementSibling?.contains(el)) {
      const first = [...h.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : n instanceof HTMLElement ? n.childNodes[0]?.textContent : '') ?? '').map((t) => t.trim()).find(Boolean)
      if (first && first.length <= 40) return cleanHeading(first)
    }
    if (!(h instanceof HTMLElement) || h.contains(el) || !h.matches(HEADING) || h.childElementCount > 10) continue
    // (Nor an option's own label: a row holding exactly one box, Snapdeal's brand links.)
    if (h.querySelector(CHECKS) || h.closest('label') || inOptionRow(h, el) || h.parentElement?.querySelectorAll(CHECKS).length === 1) continue
    const t = text(h)
    if (t.length > 1 && t.length <= 40) return cleanHeading(t)
  }
  return ''
}

// A control on a product card (IKEA: colour variants, "Compare" boxes): not a filter. A card is a small
// box holding a linked picture and a price.
function inProductCard(el: HTMLElement) {
  for (let p = el.parentElement, i = 0; p && i < 10; i++, p = p.parentElement) {
    const t = text(p)
    if (t.length > 600) return false
    // (A picture anywhere in it, not only inside the link: some pictures load late, outside it.)
    if (p.querySelector('img, picture') && p.querySelector('a[href]') && /(?:₹|rs\.?|\$|€|£)\s?\d/i.test(t)) return true
  }
  return false
}

// A comment, sign-up or checkout form ("Notify me", "I agree"): posted, or asks for text. Filter
// forms are plain GET forms or no form at all.
function inUserForm(el: HTMLElement) {
  const form = el.closest('form')
  return !!form && ((form.getAttribute('method') ?? 'get').toLowerCase() === 'post' ||
    !!form.querySelector('textarea, input[type="password"], input[type="email"], input[type="tel"]'))
}

function checkControls(): Control[] {
  const out: Control[] = []
  // Hidden ones count too (collapsed sections, inputs styled through their label); visible
  // ones come first, so a filter shown twice (desktop + mobile copy) is clicked where it is seen.
  // An ARIA checkbox wrapping a real one (Ajio) is the same option: counted through the real one.
  const checks = [...document.querySelectorAll<HTMLElement>(CHECKS)].filter((el) => el instanceof HTMLInputElement || !el.querySelector('input[type="checkbox"], input[type="radio"]'))
  // Facet links that wrap a checkbox are already counted through it.
  const links = [...new Set(facetBoxes().flatMap((b) => [...b.querySelectorAll<HTMLElement>(FACET_LINKS)]))].filter(
    // (A button that opens or collapses something is a toggle, not an option.)
    // (Nor a link inside a checkbox's own label: Snapdeal's rating rows.)
    (a) => !a.querySelector(CHECKS) && !a.closest(CHECKS) && !a.closest('label')?.querySelector(CHECKS) && !a.nextElementSibling?.querySelector(CHECKS) && !a.hasAttribute('aria-haspopup') && !a.hasAttribute('aria-controls') && !a.hasAttribute('aria-expanded'),
  )
  // A filter panel may use plain clickable rows ("White", "S", "M") instead of
  // checkboxes or links (Westside's drawer). Short pointer-cursor items count then.
  const plain: HTMLElement[] = []
  {
    const seen = new Set<string>()
    // (Only boxes holding no checkboxes or links of their own: elsewhere those are the options.)
    for (const box of facetBoxes().filter((b) => !b.querySelector(CHECKS) && !b.closest(CHECKS) && !b.closest(SCREEN_READER_ONLY) && !b.querySelector(FACET_LINKS) && !b.querySelector('select')))
      for (const el of [...box.querySelectorAll<HTMLElement>('div, span, li, p, button, a, label')].slice(0, 5000)) {
        const t = text(el)
        if (t.length < 1 || t.length > 40 || el.childElementCount > 3 || el.querySelector(CHECKS) || !visible(el) ||
          el.closest('[aria-expanded], [aria-haspopup], [aria-controls], [role="tab"]') || el.closest(SCREEN_READER_ONLY) ||
          el.closest('[class*="slider" i], [role="slider"]') || // a slider's scale marks ("0", "70")
          NOT_AN_OPTION.test(t) || GENERIC_HEADING.test(t) || el.matches(HEADING) || getComputedStyle(el).cursor !== 'pointer') continue
        // (Nor a section's title above its body of options: Nike's "Size" over its sizes.)
        if ([el, el.parentElement].some((p) => {
          const sec = p?.parentElement
          if (!p || !sec || sec.children.length !== 2 || sec.children[0] !== p) return false
          const body = sec.children[1] as HTMLElement
          return body.className !== p.className && body.querySelectorAll('*').length >= 4 && text(body).length > t.length
        })) continue
        // The outermost clickable box for this text only (not its inner <span>).
        if (el.parentElement && text(el.parentElement) === t && getComputedStyle(el.parentElement).cursor === 'pointer') continue
        const key = `${t}|${el.getBoundingClientRect().top}`
        if (!seen.has(key)) { seen.add(key); plain.push(el) }
      }
  }
  const els = [...checks, ...links, ...plain].sort((a, b) => Number(shownControl(b)) - Number(shownControl(a)))
  const known = new Map<Element, string>()
  // In page order for the group lookup (each one can stop at the option before it)…
  const order = [...els].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  for (const el of order) if (!skipped(el)) known.set(el, groupOf(el, known))
  // …and visible first for the result.
  for (const el of els) {
    if (skipped(el) || (el as HTMLInputElement).disabled || inUserForm(el) || inProductCard(el)) continue
    const label = labelOf(el)
    // "I agree to the terms and conditions…" is not a filter option.
    if (!label || label.length > 60 || NOT_AN_OPTION.test(label)) continue
    const heading = known.get(el) ?? groupOf(el)
    // A heading for the whole panel ("Filters") says nothing: the box's own name does ("gender").
    // (Only a panel heading and no name of its own: no real group, so not an option to offer.)
    const group = !heading || GENERIC_HEADING.test(heading) ? groupFromName(el) : heading
    // ("Black colour": a colour swatch named only for screen readers, Tata Cliq.)
    const name = /colou?r/i.test(group) ? label.replace(/^(\S+(?: \S+)?) colou?r$/i, '$1') : label
    if (group && group.toLowerCase() !== name.toLowerCase()) out.push({ group, label: name, el })
  }
  // Options that read the same in one group (Snapdeal's ratings: four "& Up" with star pictures):
  // their box's value tells them apart ("4.0 & Up").
  const count = new Map<string, number>()
  for (const c of out) count.set(c.group + '|' + c.label, (count.get(c.group + '|' + c.label) ?? 0) + 1)
  for (const c of out) {
    const twins = count.get(c.group + '|' + c.label) ?? 0
    const value = (c.el instanceof HTMLInputElement ? c.el : c.el.querySelector<HTMLInputElement>('input'))?.value
    if (twins > 1 && value && /^\d/.test(value)) c.label = `${value} ${c.label}`
  }
  // One heading over boxes with different names ("Filters" over gender, size, colour): those
  // names are the real groups.
  for (const name of new Set(out.map((c) => c.group))) {
    const list = out.filter((c) => c.group === name)
    const names = new Map<string, number>()
    for (const c of list) { const n = groupFromName(c.el); if (n) names.set(n, (names.get(n) ?? 0) + 1) }
    if ([...names.values()].filter((n) => n >= 2).length >= 2) for (const c of list) c.group = groupFromName(c.el) || c.group
  }
  // "Men 143", "Women 58": a count with no brackets. Dropped only when every option in the group
  // ends in one and the options stay different without it ("UK 9", "UK 10" keep theirs).
  for (const name of new Set(out.map((c) => c.group))) {
    const list = out.filter((c) => c.group === name)
    const bare = list.map((c) => c.label.replace(/\s+\d[\d,]*$/, ''))
    const counted = list.length > 1 && list.every((c, i) => bare[i] !== c.label && bare[i] && !NUMBER_IS_NAME.test(bare[i]))
    if (counted && new Set(bare.map((b) => b.toLowerCase())).size === new Set(list.map((c) => c.label.toLowerCase())).size)
      list.forEach((c, i) => (c.label = bare[i]))
  }
  return out
}

// --- Selects (sort and others)

// (Direction words in order: "Price: high to low" must not read as low-to-high, and Shopify's
// "Date, old to new" is not "newest".)
const SORT_PATTERNS: [string, RegExp][] = [
  // ("title-ascending" is A-Z: asc/desc only next to "price")
  [SORT_LABELS.price_asc, /\blow(?:est)? price(?!\W*(?:asc|desc))|lowest first|low\w*\s*(?:to|-|–|→|>)\s*high|price\W*asc|asc\w*\s+price|cheap|lowest|price\s*↑/i],
  [SORT_LABELS.price_desc, /\bhigh(?:est)? price(?!\W*(?:asc|desc))|highest first|high\w*\s*(?:to|-|–|→|>)\s*low|price\W*desc|desc\w*\s+price|expensive|highest|price\s*↓/i],
  [SORT_LABELS.newest, /newest|latest|latest arrival|recent|new arrivals?|new\s*(?:to|-|–|→)\s*old|what'?s new|date.*desc/i],
  [SORT_LABELS.rating, /rating|review|rated|star/i],
  [SORT_LABELS.popularity, /popular|best ?sell|best match|trending|featured|relevan|recommend/i],
]

function selectName(s: HTMLSelectElement) {
  return clean(
    (s.labels?.[0] ? text(s.labels[0]) : '') || s.getAttribute('aria-label') || groupOf(s) || s.name || s.id,
  )
}
const isSortSelect = (s: HTMLSelectElement) => /sort|order/i.test(`${selectName(s)} ${s.name} ${s.id}`) || [...s.options].filter((o) => sortOptionsLike(o.text)).length >= 2

function selects() {
  return [...document.querySelectorAll<HTMLSelectElement>('select')].filter(
    (s) => !s.disabled && !skipped(s) && !inUserForm(s) && s.options.length > 1 && s.options.length <= 200,
  )
}
const isSortGroup = (name: string) => /\bsort|^order(?: by)?$/i.test(name)
// An option that is a sort order ("Price (Lowest to Highest)", "New Arrivals", "Recommended").
const sortOptionsLike = (label: string) => SORT_PATTERNS.some(([, re]) => re.test(label)) || /^(recommended|relevance|relevancy|featured|best match|most relevant)$/i.test(label)
// Sort label → how to choose it: an <option> of the sort <select>, or a radio/link in a "Sort by" group.
function sortOptions(controls = checkControls()): Map<string, () => void> {
  const out = new Map<string, () => void>()
  const select = selects().find(isSortSelect)
  const choices: { text: string; choose: () => void }[] = select
    ? [...select.options].map((o) => ({ text: `${o.text} ${o.value}`, choose: () => setValue(select, o.value) }))
    : controls.filter((c) => isSortGroup(c.group)).map((c) => ({ text: c.label, choose: () => press(c.el) }))
  const used = new Set<string>()
  for (const [label, re] of SORT_PATTERNS) {
    const c = choices.find((c) => re.test(c.text) && !used.has(c.text))
    if (c) { used.add(c.text); out.set(label, c.choose) }
  }
  return out
}
// A sort button whose list only exists once it is clicked ("Most relevant ▾", Decathlon).
// Sort controls whose list only exists or shows once clicked: a menu button ("Most relevant ▾":
// Decathlon), a "Sort By" button with no menu markers (Nike, Reliance), or a custom select box
// showing the current order next to a "Sort" label (Croma "Relevancy", Snapdeal "Relevance").
// Whatever it is, the sort orders are the sort-like texts that appear after clicking it.
const sortContext = (e: Element) => {
  for (let p: Element | null = e, i = 0; p && i < 4; i++, p = p.parentElement)
    if (/sort/i.test(`${p.id} ${p.getAttribute('class') ?? ''} ${p.getAttribute('data-testid') ?? ''} ${p.getAttribute('data-test-id') ?? ''}`) || /^sort\b/i.test(text(p))) return true
  return false
}
const sortButton = () => {
  const all = [...document.querySelectorAll<HTMLElement>('button, [role="button"], [role="combobox"]')].filter((b) => visible(b) && !skipped(b) &&
    text(b).length <= 40 && !b.closest('[role="tab"], [role="tablist"]')) // (a "Sort By" tab of a filter panel: chosen there, then Apply)
  return all.find((b) => /^sort\b/i.test(text(b))) ??
    // A menu button showing the current order ("Most relevant ▾"), or one in a box named sort. (Not any
    // expand button there: Decathlon's filters and sort share one "…-filters-sort-row" box.)
    all.find((b) => b.matches('[aria-haspopup], [role="combobox"]') && (sortOptionsLike(text(b)) || sortContext(b))) ??
    all.find((b) => b.matches('[aria-expanded]') && sortOptionsLike(text(b)))
}
const sortTrigger = () => [...document.querySelectorAll<HTMLElement>('div, span, a, p, li')].find((e) => visible(e) && !skipped(e) &&
  e.childElementCount <= 2 && text(e).length <= 30 && sortOptionsLike(text(e)) &&
  (getComputedStyle(e).cursor === 'pointer' && sortContext(e) || e.matches('li[id*="filter" i]'))) // (Urbanic's "Recommended" in its filter bar)
// Short visible texts that name a sort order.
const sortTexts = () => [...document.querySelectorAll<HTMLElement>('body *')].filter((e) => {
  if (e.childElementCount > 2) return false
  const t = text(e)
  return t.length > 2 && t.length <= 40 && sortOptionsLike(t) && visible(e) && !skipped(e)
})
// The one to click among elements with the same text: a menu option / radio, else the clickable one.
const pick = (same: HTMLElement[]) =>
  same.find((e) => /^(option|menuitem|menuitemradio|radio)$/.test(e.getAttribute('role') ?? '')) ??
  same.find((e) => e.querySelector('input[type="radio"]')) ??
  same.find((e) => getComputedStyle(e).cursor === 'pointer') ?? same[same.length - 1]

async function sortMenu(): Promise<Map<string, () => Promise<void>>> {
  const out = new Map<string, () => Promise<void>>()
  const fill = (items: HTMLElement[], choose: (t: string) => Promise<void>) => {
    const used = new Set<string>()
    for (const [label, re] of SORT_PATTERNS) {
      const t = items.map(text).find((t) => re.test(t) && !used.has(t))
      if (t) { used.add(t); out.set(label, () => choose(t)) }
    }
  }
  let trigger = sortButton()
  if (!trigger) {
    // Sort orders as plain clickable text, no button ("Price - Low to High": Lifestyle). One stray
    // match ("Popularity") is not a sort list: then look for a custom select box instead.
    const plain = sortTexts().filter((e) => getComputedStyle(e).cursor === 'pointer' &&
      /low\w*\s*(?:to|-|–|→)\s*high|high\w*\s*(?:to|-|–|→)\s*low|^(?:newest|new arrivals?|latest|popularity|most popular|relevance|customer rating)/i.test(text(e)))
    fill(plain, async (t) => { pick(sortTexts().filter((e) => text(e) === t))?.click() })
    if (out.size >= 2) return out
    out.clear()
    trigger = sortTrigger()
    if (!trigger) return out
  }
  const button = trigger
  const before = new Set(sortTexts())
  const showing = (t: string) => sortTexts().some((e) => text(e) === t && !button.contains(e))
  button.click()
  await quiet(300, 2000)
  const items = sortTexts().filter((e) => !before.has(e) && !button.contains(e))
  fill(items, async (t) => {
    if (!showing(t)) { button.click(); await quiet(300, 2000) }
    pick(sortTexts().filter((e) => text(e) === t && !button.contains(e)))?.click()
  })
  // Close it again (a toggle; Escape for dialogs).
  if (items.some((e) => visible(e))) {
    if (button.getAttribute('aria-expanded') === 'true' || !button.hasAttribute('aria-haspopup')) button.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }
  return out
}

// Store pickers in the footer or a popup: never filters.
const NOT_A_FILTER = /country|language|currency|shipping to|region|locale|quantity|qty|cookie|consent|privacy|marketing|newsletter/i

// --- Price boxes

function priceBoxes() {
  const boxes = [...document.querySelectorAll<HTMLInputElement>('input[type="number"], input[type="text"], input:not([type])')].filter(
    // (Read-only boxes only show a slider's value: typing there does nothing.)
    // (Nor a "price alert" or gift-card form: those are posted or ask for an email.)
    (i) => !skipped(i) && visible(i) && !i.readOnly && !i.disabled && !inUserForm(i),
  )
  // The box's own words ("Min", "max_price", "Maximum"); the group heading only says "Price".
  const own = (i: HTMLInputElement) => `${i.name} ${i.id} ${i.placeholder} ${i.getAttribute('aria-label') ?? ''} ${text(i.labels?.[0])}`
  // (The currency sign is often beside the box: "<span>₹</span><input aria-label=minimum-input>".)
  // (Never a cart quantity, a pincode or a coupon box.)
  const priced = boxes.filter((i) => !/qty|quantity|zip|pin ?code|pincode|postal|coupon|promo|voucher/i.test(own(i)) &&
    /price|amount|₹|\$|€|£/i.test(`${own(i)} ${groupOf(i)} ${text(i.parentElement)}`))
  const min = priced.find((i) => /min|from|\blow|start|gte|lower/i.test(own(i))) ?? (priced.length === 2 ? priced[0] : undefined)
  const max = priced.find((i) => i !== min && (/max|\bto\b|\bhigh|end|lte|upper/i.test(own(i)) || /^to(?:[A-Z_-]|$)/.test(i.name))) ?? (priced.length === 2 ? priced[1] : undefined)
  return { min, max }
}

// --- Price slider: two handles on a bar and no boxes (Decathlon). Dragged the way a person
// would; the scale comes from the prices shown beside it ("From ₹699 to ₹19,999") and where the
// handles sit. shortcut: assumes an even (linear) scale, upgrade if a shop's slider uses steps.
const THUMB = '[role="slider"], [class*="thumb" i], [data-test-id*="thumb" i], [class*="handle" i]'
const MONEY_RANGE = /(?:₹|\$|€|£|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)\D{1,12}?(?:₹|\$|€|£|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)/i

function priceSlider() {
  for (const bar of document.querySelectorAll<HTMLElement>('[class*="slider" i], [data-test-id*="slider" i], [class*="range" i]')) {
    const all = [...bar.querySelectorAll<HTMLElement>(THUMB)]
    const thumbs = all.filter((t) => !all.some((o) => o !== t && o.contains(t)))
    if (thumbs.length !== 2 || !visible(bar) || skipped(bar)) continue
    let box: HTMLElement | null = bar, m: RegExpMatchArray | null = null
    for (let i = 0; box && i < 4 && !(m = text(box).match(MONEY_RANGE)); i++) box = box.parentElement
    if (!m) continue
    const rect = bar.getBoundingClientRect()
    const [lo, hi] = thumbs.map((t) => { const q = t.getBoundingClientRect(); return { t, f: (q.left + q.width / 2 - rect.left) / rect.width } }).sort((a, b) => a.f - b.f)
    if (rect.width < 40 || hi.f - lo.f < 0.05) continue
    const num = (x: string) => Number(x.replace(/,/g, ''))
    const per = (num(m[2]) - num(m[1])) / (hi.f - lo.f) // price across the whole bar
    const start = num(m[1]) - lo.f * per
    return { min: lo.t, max: hi.t, rect, at: (price: number) => (price - start) / per }
  }
}

// Drags a handle to a point on the bar (0 = left end, 1 = right end) with pointer and mouse events.
function drag(thumb: HTMLElement, f: number, rect: DOMRect, round: (n: number) => number) {
  const q = thumb.getBoundingClientRect()
  const y = q.top + q.height / 2, x0 = q.left + q.width / 2, x1 = round(rect.left + rect.width * f)
  const fire = (t: EventTarget, type: string, x: number) => {
    const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: window }
    t.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, o) : new MouseEvent(type, o))
  }
  fire(thumb, 'pointerdown', x0); fire(thumb, 'mousedown', x0)
  for (let i = 1; i <= 10; i++) { const x = x0 + ((x1 - x0) * i) / 10; fire(thumb, 'pointermove', x); fire(document, 'pointermove', x); fire(document, 'mousemove', x) }
  fire(thumb, 'pointerup', x1); fire(document, 'pointerup', x1); fire(document, 'mouseup', x1)
}

// Two native range inputs for one price, each telling its price in aria-valuetext ("₹ 1,650.00":
// Zara, stacked on one bar, with an uneven scale). Set by value, not dragged.
function priceRanges() {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')].filter((i) =>
    !skipped(i) && !i.disabled && money(i.getAttribute('aria-valuetext') ?? '') > 0)
  for (const a of inputs) {
    const box = a.parentElement?.parentElement?.parentElement
    const b = inputs.find((x) => x !== a && !!box?.contains(x))
    if (b) return Number(a.value) <= Number(b.value) ? { min: a, max: b } : { min: b, max: a }
  }
}

// Sets a range input to the step whose price is the closest inside the budget: the highest at or
// below it (max handle) or the lowest at or above it (min handle). The scale may be uneven, so the
// steps are tried (by halving) and the price each one shows is read back.
async function setRange(input: HTMLInputElement, which: 'min' | 'max', price: number | null, other?: HTMLInputElement): Promise<boolean> {
  let lo = Number(input.min || 0), hi = Number(input.max || 100)
  // (Never past the other handle: the slider refuses, or swaps the two.)
  // (Nor onto it: Zara refuses a handle on the other one.)
  if (other && which === 'max') lo = Math.max(lo, Number(other.value) + 1)
  if (other && which === 'min') hi = Math.min(hi, Number(other.value) - 1)
  // (The page may draw the inputs again after each change: find this handle again each time.)
  const live = () => { if (!input.isConnected) { const r = priceRanges(); if (r) input = r[which] } return input }
  const move = (v: number) => {
    const el = live()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true })) // (Zara reads change, not input)
  }
  const at = async (v: number) => { move(v); await wait(120); return money(live().getAttribute('aria-valuetext') ?? '') }
  let target = which === 'min' ? lo : hi
  if (price !== null) {
    if (which === 'max' ? (await at(lo)) > price : (await at(hi)) < price) return false // outside what the page sells
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      const p = await at(mid)
      if (which === 'max' ? p <= price : p < price) lo = mid
      else hi = mid
    }
    target = which === 'max' ? ((await at(hi)) <= price ? hi : lo) : ((await at(lo)) >= price ? lo : hi)
  }
  move(target)
  for (const type of ['pointerup', 'mouseup']) live().dispatchEvent(new MouseEvent(type, { bubbles: true }))
  await quiet()
  return true
}

// Moves the slider's min or max handle to a price (null = back to its end). False when the price
// is outside what the page sells ("under 500" where the cheapest item is 699).
// Two ARIA slider handles with their numbers (Westside: span[role=slider] aria-valuemin/max/now).
function ariaSliders() {
  const thumbs = [...document.querySelectorAll<HTMLElement>('[role="slider"][aria-valuemax]')].filter((t) => visible(t) && !skipped(t))
  if (thumbs.length !== 2) return
  const [a, b] = thumbs.sort((x, y) => Number(x.getAttribute('aria-valuenow')) - Number(y.getAttribute('aria-valuenow')))
  return { min: a, max: b }
}
// Moves an ARIA slider handle with the keys a keyboard user would press (Home/End, then arrows):
// sliders answer keys reliably, and aria-valuenow says where it is.
async function keySlide(first: HTMLElement, which: 'min' | 'max', price: number | null, shortcut = true): Promise<boolean> {
  // (The page may draw the slider again after each step: find the handle again each time.)
  let thumb = first
  const fresh = () => { const t = ariaSliders()?.[which]; if (t) thumb = t; return thumb }
  const now = () => Number(fresh().getAttribute('aria-valuenow'))
  const lo = Number(thumb.getAttribute('aria-valuemin')), hi = Number(thumb.getAttribute('aria-valuemax'))
  if (price !== null && (which === 'max' ? price < lo : price > hi)) return false
  const key = (k: string) => { fresh().focus(); for (const type of ['keydown', 'keyup']) thumb.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, bubbles: true, cancelable: true })) }
  thumb.focus()
  const target = price === null ? (which === 'min' ? lo : hi) : Math.min(hi, Math.max(lo, price))
  const settle = async (v: number) => { for (let t = 0; t < 12 && now() === v; t++) await wait(50) }
  // A shop that writes the slider's value into its address (Westside: "sellingPrice … lte 4940"):
  // one step to see where, then open that address with the budget instead. One page load instead
  // of hundreds of steps (it re-filters on every step).
  if (shortcut && price !== null && Math.abs(now() - target) > (hi - lo) / 50) {
    const before = decodeURIComponent(location.href), v0 = now()
    key(v0 < target ? 'ArrowRight' : 'ArrowLeft')
    await settle(v0)
    const v1 = now()
    await quiet(400, 3000)
    // (Some write it only once their panel's "Apply" is pressed: Westside.)
    const applied = decodeURIComponent(location.href) === before && applyPending
    if (applied) { pressApply(); await quiet(800, 5000) }
    const after = decodeURIComponent(location.href)
    const at = new RegExp(`([^\\d])${v1}((?:\\.0+)?[^\\d])`)
    if (after !== before && at.test(after)) {
      // (Then wait for the page to go: the other price end is set on the new page, see resume. Without
      // this it raced ahead and its own address replaced this one: only "lte 2000" stayed.)
      const href = after.replace(at, `$1${Math.round(target)}$2`)
      navigateSoon(href)
      await leaving(href)
      return true
    }
    // No address to use, and "Apply" closed the panel: open it again and move by keys.
    if (applied) {
      if (!fresh().isConnected || !visible(thumb)) return slidePrice(which, price, false)
      applyPending = true
    }
  }
  // Keys move these sliders by small steps (Westside: ₹10 a page key), and dragging needs a real
  // pointer. So: one page key to measure its step, then the rest of the way in one quick burst.
  const v0 = now()
  if (Math.abs(v0 - target) > (hi - lo) / 50) {
    key(v0 < target ? 'PageUp' : 'PageDown')
    await settle(v0)
    const page = Math.abs(now() - v0)
    if (page > 0) {
      const n = Math.floor(Math.abs(now() - target) / page)
      for (let k = 0; k < Math.min(n, 2000); k++) { key(v0 < target ? 'PageUp' : 'PageDown'); if (k % 25 === 24) await wait(16) }
      await quiet(300, 2000)
    }
  }
  // Each arrow press: wait until the value shows the step (up to 0.6 s).
  const arrow = async (up: boolean) => {
    const v = now()
    key(up ? 'ArrowRight' : 'ArrowLeft')
    for (let t = 0; t < 12 && now() === v; t++) await wait(50)
    return now() !== v
  }
  for (let i = 0; i < 80; i++) {
    const v = now()
    if (v === target) break
    if (!(await arrow(v < target))) break // the slider doesn't move by keys
    const w = now()
    if ((v < target) !== (w < target)) {
      if (which === 'max' ? w > target : w < target) await arrow(which === 'min')
      break
    }
  }
  thumb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  thumb.blur()
  await quiet()
  return price === null || (which === 'max' ? now() <= price : now() >= price)
}
// The tab of a tabbed filter panel that holds the price slider (Westside), found while reading.
let priceTab = ''

async function slidePrice(which: 'min' | 'max', price: number | null, shortcut = true): Promise<boolean> {
  // A price slider inside a closed tab: open that tab first (its "Apply" is pressed after this choice).
  if (priceTab && !priceSlider() && !priceRanges() && !ariaSliders()) {
    const list = tabList() ?? (filterButton()?.click(), await quiet(400, 2000), tabList())
    const tab = list && tabsOf(list).find((t) => cleanHeading(text(t)) === priceTab)
    if (list && tab) { await openTab(list, tab); applyPending = true }
  }
  // A slider inside a "Filters" drawer that is closed again (Zara): open the drawer.
  if (!priceSlider() && !priceRanges() && !ariaSliders()) { const drawer = filterButton(); if (drawer) { drawer.click(); await quiet(400, 2000) } }
  // Still none, in a tabbed panel: the "Price" tab (after a reload the tab found while reading is unknown).
  if (!priceSlider() && !priceRanges() && !ariaSliders()) {
    const list = tabList()
    const tab = list && tabsOf(list).find((t) => /price/i.test(text(t)))
    if (list && tab) { await openTab(list, tab); applyPending = true }
  }
  const aria = ariaSliders()
  if (aria && !priceSlider()) return keySlide(aria[which], which, price, shortcut)
  const s = priceSlider()
  if (!s) { const ranges = priceRanges(); return ranges ? setRange(ranges[which], which, price, ranges[which === 'min' ? 'max' : 'min']) : false }
  const f = price === null ? (which === 'min' ? 0 : 1) : s.at(price)
  if ((which === 'max' && f < 0) || (which === 'min' && f > 1)) return false
  const q = s[which].getBoundingClientRect()
  if (Math.abs((q.left + q.width / 2 - s.rect.left) / s.rect.width - Math.min(1, Math.max(0, f))) < 0.005) return true // already there
  // Inside the budget: the max handle rounds down, the min handle up.
  drag(s[which], Math.min(1, Math.max(0, f)), s.rect, which === 'max' ? Math.floor : Math.ceil)
  await quiet()
  return true
}

// --- Reading and changing the page

const BUTTONS = 'button, input[type="submit"], input[type="button"], a[role="button"]'

// Sets a value the way typing would (React and Vue listen for these events).
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function press(el: HTMLElement) {
  // A hidden input is ticked through its label, which is what a person clicks.
  const target = el instanceof HTMLInputElement && !visible(el) && el.labels?.[0] ? el.labels[0] : el
  target.click()
}

// Waits until the page stops changing (a filter click re-renders the results), max 5 s.
async function quiet(idle = 600, max = 5000) {
  let last = Date.now()
  const watcher = new MutationObserver(() => (last = Date.now()))
  // Content changes only: animations change attributes all the time.
  watcher.observe(document.body, { childList: true, subtree: true })
  const start = Date.now()
  while (Date.now() - last < idle && Date.now() - start < max) await wait(100)
  watcher.disconnect()
}

// A page that has just loaded may still be drawing its filters (Decathlon shows its filter list
// about 4 s after "load"). Wait until it is fully loaded and the filter list has stopped growing.
async function pageReady() {
  if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }))
  if (performance.now() > 30000) return // loaded a while ago: nothing still coming (heavy shops draw filters late)
  let count = -1
  for (let i = 0; i < 8; i++) {
    await quiet(800, 3000)
    const now = document.querySelectorAll(`${CHECKS}, select`).length + facetBoxes().reduce((n, b) => n + b.querySelectorAll('a[href]').length, 0)
    if (now === count) return // the same twice in a row (also 0: a page without filters)
    count = now
    if (performance.now() > 30000) return
  }
}

// Price boxes usually need an "Apply" / "Go" button, or Enter.
function submitPrice(box: HTMLInputElement) {
  let node: HTMLElement | null = box.parentElement
  for (let i = 0; node && i < 4; i++, node = node.parentElement) {
    const button = [...node.querySelectorAll<HTMLElement>(BUTTONS)].find((b) =>
      /^(apply|go|ok|set|filter|submit|search|update|›|>|→)$/i.test(text(b) || (b as HTMLInputElement).value || b.getAttribute('aria-label') || ''),
    )
    if (button) return button.click()
  }
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  box.form?.requestSubmit()
}

// Site search addresses for shops where neither the box nor ?q= works (each checked live).
const SITE_SEARCH: [RegExp, string][] = [
  [/(^|\.)ajio\.com$/, '/search/?text='],
  [/(^|\.)(lifestylestores\.com|maxfashion\.in)$/, '/in/en/search?q='],
]
const SEARCH_PARAMS = ['q', '_nkw', 'query', 'k', 'search', 's', 'keyword', 'keywords', 'searchTerm', 'search_query', 'term', 'text', 'w', 'st', 'Ntt', 'kw']
const searchBox = () =>
  [...document.querySelectorAll<HTMLInputElement>(
    'input[type="search"], input[name="q"], input[name*="search" i], input[id*="search" i], input[placeholder*="search" i], input[aria-label*="search" i]',
  // (Not a "search brand" box inside the filters.)
  )].find((i) => i.type !== 'hidden' && i.type !== 'checkbox' && visible(i) && !facetBoxes().some((b) => b.contains(i)))

// The search page for some text: the site's own search form when it is a plain GET form.
function formUrl(textValue: string): string | null {
  const box = searchBox()
  const form = box?.form
  if (!box?.name || !form || (form.method || 'get').toLowerCase() !== 'get') return null
  const url = new URL(form.action || location.href, location.href)
  url.search = ''
  for (const [k, v] of new FormData(form)) if (typeof v === 'string') url.searchParams.set(k, k === box.name ? textValue : v)
  url.searchParams.set(box.name, textValue)
  return url.href
}

// The filter choices left to apply after a click reloaded the page (see the top of this file),
// with what was missing so far. hops: how many reloads in a row this request has caused; capped,
// so a page that reloads on every click (or a filter that never reads as ticked) can't loop.
// RESULT: the final answer once nothing is left, for the panel to ask for (APPLY_RESULT).
const RESULT = 'ai-shopping-filters:result'
const MAX_HOPS = 6
type Pending = { at: number; choices: FilterChoice[]; hops: number; missing: FilterChoice[] }
const store = (key: string, value: unknown) => {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage blocked: the rest is just not applied after a reload */ }
}
function savePending(choices: FilterChoice[], hops: number, missing: FilterChoice[]) {
  if (!choices.length) return store(PENDING, null)
  // Past the cap the rest is given up, and said so.
  if (hops >= MAX_HOPS) {
    store(PENDING, null)
    return store(RESULT, { at: Date.now(), missing: [...missing, ...choices.filter((c) => c.group !== '*')] })
  }
  store(PENDING, { at: Date.now(), choices, hops, missing } satisfies Pending)
}

// "₹1,299", "Rs. 319", "$49.99", "€12,50", "1.299 €" → the amount (the first one: the selling price).
function money(t: string): number {
  const m = t.replace(/\s+/g, ' ').match(/(?:₹|\bRs\.?|\bINR|\$|\bUSD|€|\bEUR|£|\bGBP)\s*(\d[\d.,]*)|(\d[\d.,]*)\s*(?:₹|€|£)/i)
  const raw = (m?.[1] ?? m?.[2])?.replace(/[.,]$/, '')
  if (!raw) return NaN
  if (/,\d{2}$/.test(raw) && !/\.\d{2}$/.test(raw)) return Number(raw.replace(/\./g, '').replace(',', '.')) // "12,50"
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, '')) // "1.299"
  return Number(raw.replace(/,/g, ''))
}

// The page's currency, from the amounts it shows most ("" when it shows none).
function pageCurrency(): string {
  const body = document.body.innerText.slice(0, 200000)
  const count = (re: RegExp) => body.match(re)?.length ?? 0
  const found = ([['₹', /₹|\bRs\.?\s?\d/g], ['$', /\$\s?\d/g], ['€', /€\s?\d|\d\s?€/g], ['£', /£\s?\d/g]] as const)
    .map(([c, re]) => [c, count(re)] as const)
    .sort((a, b) => b[1] - a[1])[0]
  return found[1] ? found[0] : ''
}

// "Filters", "Show filters", "Filter & Sort (2)": the button that opens a hidden filter panel.
const filterButton = () =>
  [...document.querySelectorAll<HTMLElement>('button, [role="button"], a[href="#"], a:not([href]), [class*="filter" i]')].find(
    (b) => visible(b) && !skipped(b) && b.getAttribute('aria-expanded') !== 'true' && b.childElementCount <= 4 &&
      (b.matches('button, [role="button"], a') || getComputedStyle(b).cursor === 'pointer') &&
      // ("FiltersNONE APPLIED": Lenskart's two lines run together.)
      (/^(show |all |more )?filters?(?:none applied|(?![a-z])[^a-z]{0,6}(?:(?:&|and) sort(?: by)?)?[^a-z]{0,6}(?:none applied|\d+ applied)?)$/i.test(text(b)) ||
        /^(open|show) (all )?filters?$/i.test(b.getAttribute('aria-label') ?? '')),
  )

// Opens collapsed filter sections and "Show more" / "+ 12 more" lists: many shops put their
// options in the page only then (and close them again after every filter). Returns how many.
async function openSections(): Promise<number> {
  let opened = 0
  const boxes = [...facetBoxes(), ...document.querySelectorAll<HTMLElement>('aside')]
  for (const d of new Set(boxes.flatMap((b) => [...b.querySelectorAll<HTMLDetailsElement>('details:not([open])')]))) if (opened++ < 20) d.open = true
  for (const b of new Set(boxes.flatMap((b) => [...b.querySelectorAll<HTMLElement>('[aria-expanded="false"]')])))
    if (opened++ < 20 && !skipped(b) && text(b).length <= 40 && !/more filters|all filters/i.test(text(b))) b.click()
  // Icon toggles that say so only in their name (MUI "collapse-icon"), beside a heading whose section has no options yet.
  for (const b of new Set(boxes.flatMap((x) => [...x.querySelectorAll<HTMLElement>('button[aria-label*="collapse" i]:not([aria-expanded]), button[aria-label*="expand" i]:not([aria-expanded])')]))) {
    const row = b.parentElement?.closest<HTMLElement>(':has(> h1, > h2, > h3, > h4, > h5, > h6, > legend, > [role="heading"])')
    if (opened < 20 && row?.parentElement && !row.parentElement.querySelector(CHECKS) && !skipped(b)) { b.click(); opened++ }
  }
  // Collapsed "title + body" sections (Nike): click the title when its body has no height.
  for (const box of facetBoxes())
    for (const sec of [...box.querySelectorAll<HTMLElement>('div, section, li')].slice(0, 3000)) {
      if (opened >= 60 || sec.children.length !== 2) continue
      const [head, body] = [...sec.children] as HTMLElement[]
      const t = text(head)
      if (t.length > 1 && t.length <= 30 && body.childElementCount > 0 && body.getBoundingClientRect().height < 10 &&
        text(body).length > 0 && getComputedStyle(head).cursor === 'pointer' && !head.querySelector(CHECKS)) { head.click(); opened++ }
    }
  if (opened) await quiet()
  let more = 0
  for (const b of new Set(facetBoxes().flatMap((x) => [...x.querySelectorAll<HTMLElement>('button, a[role="button"], [role="button"]')])))
    if (more < 10 && /^(show|view|see) more\b|^\+\s*\d*\s*more$/i.test(text(b)) && !skipped(b)) { b.click(); more++ }
  if (more) await quiet()
  return opened + more
}

// The option asked for, as the page shows it now. Shops can rewrite a list after the first
// filters: Decathlon's sizes "8" become "8 - eu 42" once a brand is ticked.
function sameOption(label: string, option: string) {
  const l = label.toLowerCase(), o = option.toLowerCase()
  if (l === o) return true
  const first = (t: string) => t.match(/^(\d+(?:\.\d+)?)(?:\s*[-–(/]\s*[a-z].*)?$/i)?.[1]
  return !!first(l) && first(l) === first(o)
}

// A filter option by group and name, opening collapsed sections if it isn't in the page.
async function findControl(group: string, label: string): Promise<Control | undefined> {
  const find = () => checkControls().find((x) => same(x.group, group) && sameOption(x.label, label))
  const found = find() ?? ((await openSections()) ? find() : undefined)
  if (found) return found
  // Behind a "Filters" button that opens a drawer or dialog (Zara) without tabs.
  // (Not when a filter dialog is open already: pressing its button again would close it, Lenskart.)
  const dialogOpen = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')].some((d) => visible(d) && !!d.querySelector('input, [aria-controls], [role="checkbox"]'))
  const drawer = !tabList() && !dialogOpen && filterButton()
  if (drawer) {
    drawer.click()
    await quiet(400, 2000)
    const inDrawer = find()
    if (inDrawer) return inDrawer
  }
  // A "MORE" button under the group (Ajio) opens a pop-up with the whole list and an "Apply".
  const more = moreButtons().find((b) => same(groupOf(b), group))
  if (more) {
    const before = new Set(checkControls().map((c) => c.el))
    more.click()
    await quiet(400, 3000)
    const inside = checkControls().find((x) => !before.has(x.el) && x.el.closest(POPUP) && sameOption(x.label, label))
    applyPending = true // pressed after the pick (applyAll), or now to close the pop-up
    if (inside) return { ...inside, group }
    pressApply()
  }
  // In a filter bar the group is a dropdown button ("Size ▾"): open it, look inside.
  // (The last one: a shop may keep an old copy of its filter dialog in the page, Lenskart.)
  let button = dropdownButtons().filter((b) => same(barName(b), group)).pop()
  if (button) {
    let got = await openDropdown(button)
    // A group in a filter dialog that shows nothing when opened (Lenskart, after all its groups were
    // read): close the dialog and open it fresh, as a person would, and try once more.
    const dialog = button.closest<HTMLElement>('[role="dialog"], [aria-modal="true"]')
    if (!got.length && dialog) {
      const close = [...dialog.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) =>
        /close|cross|dismiss/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('class') ?? ''}`) || /^[×✕x]$/i.test(text(b)))
      if (close) close.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await quiet(400, 2000)
      filterButton()?.click()
      await quiet(600, 3000)
      button = dropdownButtons().filter((b) => same(barName(b), group)).pop()
      if (button) got = await openDropdown(button)
    }
    const inside = got.find((x) => sameOption(x.label, label))
    // (Ticked inside a dialog with its own "Apply": it counts once that is pressed, Lenskart.)
    const box = inside?.el.closest<HTMLElement>('[role="dialog"], [aria-modal="true"]')
    if (box && [...box.querySelectorAll<HTMLElement>('button, [role="button"]')].some((b) => /^apply(?: filters?)?$/i.test(text(b)))) applyPending = true
    // (Plain text options in a pop-up count once its "Apply" is pressed: applyAll does that.)
    if (inside && !inside.el.matches(CHECKS)) applyPending = true
    if (inside) return { ...inside, group }
  }
  // In a tabbed panel the group is a tab: open the panel if it is closed, click the tab, look there.
  let list = tabList()
  if (!list && !drawer) { filterButton()?.click(); await quiet(400, 2000); list = tabList() }
  const tab = list && tabsOf(list).find((t) => same(cleanHeading(text(t)), group))
  if (!list || !tab) return undefined
  const inside = (await openTab(list, tab)).find((x) => sameOption(x.label, label))
  if (inside) applyPending = true // the panel's "Apply" is pressed right after this choice (applyAll)
  return inside && { ...inside, group }
}

// Opens one dropdown of a filter bar and returns its options: the ones inside the panel it names,
// or else the ones that appeared when it opened (Puma draws the panel elsewhere, without that id).
async function openDropdown(button: HTMLElement): Promise<Control[]> {
  const before = new Set(checkControls().map((c) => c.el))
  const popsBefore = new Set(document.querySelectorAll(POPUP))
  if (button.getAttribute('aria-expanded') !== 'true') { button.click(); await quiet(400, 2000) }
  let panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
  // Says it is open but its panel is not there (Lenskart: one group open at a time, so after reading
  // the others its button still says "open"): close it and open it again.
  if (!panel && button.getAttribute('aria-expanded') === 'true')
    for (let i = 0; i < 2 && !panel; i++) {
      button.click(); await quiet(300, 1500)
      panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    }
  const found = checkControls().filter((c) => (panel ? panel.contains(c.el) : !before.has(c.el)))
  if (found.length || panel) return found
  // A pop-up of plain text options (Urbanic: "S", "M", "L" spans, then its "Apply").
  const pop = [...document.querySelectorAll<HTMLElement>(POPUP)].filter((p) => visible(p) && !popsBefore.has(p)).pop() ??
    [...document.querySelectorAll<HTMLElement>(POPUP)].filter(visible).pop()
  if (!pop) return []
  // (Real boxes in it, already there before the click: those are the options, not their text.
  // Their text would never read as ticked, and a second click on it would untick: Puma.)
  if (pop.querySelector(CHECKS)) return checkControls().filter((c) => pop.contains(c.el))
  const texts = [...pop.querySelectorAll<HTMLElement>('span, div, li, a, button')]
    .filter((e) => e.childElementCount === 0 && visible(e) && text(e).length >= 1 && text(e).length <= 30 && !NOT_AN_OPTION.test(text(e)) && !GENERIC_HEADING.test(text(e)))
    .map((e) => ({ group: '', label: text(e), el: e }))
  // Options that are only a picture (Urbanic's colour swatches), named by their attributes.
  const pictures = [...pop.querySelectorAll<HTMLElement>('*')]
    .filter((e) => !text(e) && e.querySelector('img') && visible(e) && pictureName(e))
    // (Clicked on the picture itself: the click then reaches whichever box listens for it.)
    .map((e) => ({ group: '', label: pictureName(e), el: e.querySelector<HTMLElement>('img') ?? e }))
  return [...texts, ...pictures.filter((p, i) => pictures.findIndex((q) => q.label === p.label) === i)]
}

// A picture-only option's name: its alt / title / aria-label, or a "name" inside a data attribute
// (Urbanic: data-bee-click='{… "extend": {"name": "Black"} }').
function pictureName(el: HTMLElement): string {
  for (const e of [el, el.querySelector('img')]) for (const a of ['alt', 'title', 'aria-label']) {
    const v = e?.getAttribute(a)?.trim()
    if (v && v.length <= 30) return v
  }
  for (const a of el.getAttributeNames()) {
    const m = (el.getAttribute(a) ?? '').match(/"name"\s*:\s*"([^"]{1,30})"/)
    if (m) return m[1]
  }
  return ''
}
// The dropdown of a filter bar that holds the price boxes, found while reading (Puma).
let priceDropdown = ''
// Names of a bar's filters as first read: Urbanic's "Size" shows "M" once M is picked.
const barNames = new Map<string, string>()
const barName = (b: HTMLElement) => {
  const key = b.id || ''
  if (key && !barNames.has(key)) barNames.set(key, cleanHeading(text(b)))
  return (key && barNames.get(key)) || cleanHeading(text(b))
}

// Filter bars made of dropdown buttons ("Price ▾", "Size ▾", "Colour ▾"), each opening its own
// panel of options (Puma). Found by what they control: "size_ind-filter-dropdown".
const dropdownButtons = () => [
  ...document.querySelectorAll<HTMLElement>('button[aria-controls], [role="button"][aria-controls]'),
  // A bar of filter names with no aria at all, each opening a pop-up (Urbanic: li#goods-filter-menu-3 "Color").
  ...[...document.querySelectorAll<HTMLElement>('li[id*="filter" i]')].filter((b) => !b.querySelector(CHECKS) && !sortOptionsLike(text(b))),
].filter(
    (b) => (!b.hasAttribute('aria-controls') || /filter|facet|refine/i.test(b.getAttribute('aria-controls') ?? '')) && !skipped(b) &&
      text(b).length > 1 && text(b).length <= 30 && visible(b),
  )
// Tabbed filter panels (Westside's drawer): a list of group tabs ("Price", "Size", "Color") and,
// beside it, the options of the selected tab, with an "Apply" button for the whole panel.
const OPTIONISH = 'button, [role="option"], [role="checkbox"], [role="radio"], [role="menuitemcheckbox"], input[type="checkbox"], input[type="radio"], li, a[href]'
// Only a list named for filters ("Filter categories") or a tablist inside a filter panel: a
// "Shop by category" bar of the site is not one.
const tabList = () =>
  // (A real tab list first: a dialog labelled "Filter" around it is not the list.)
  [...document.querySelectorAll<HTMLElement>('[role="tablist"]'), ...document.querySelectorAll<HTMLElement>('[aria-label]:not([role="tablist"])')].find((l) => {
    const name = l.getAttribute('aria-label') ?? ''
    const named = /filter|facet|refine/i.test(name) || (l.getAttribute('role') === 'tablist' && !!tabPanel(l))
    return named && !skipped(l) && visible(l) && tabsOf(l).length >= 3
  })
// The panel around a tab list (its options and its "Apply" button are inside), if any.
const tabPanel = (list: HTMLElement) => list.closest<HTMLElement>('[role="dialog"], aside, [class*="drawer" i], [class*="modal" i], [class*="filter" i]')
// (Dropdown toggles are not tabs, and a "Filters" button names no group.)
const tabsOf = (list: HTMLElement) =>
  [...list.querySelectorAll<HTMLElement>('[role="tab"], button')].filter(
    (t) => text(t).length > 1 && text(t).length <= 30 && !t.hasAttribute('aria-haspopup') && !t.hasAttribute('aria-controls') && !GENERIC_HEADING.test(cleanHeading(text(t))) &&
      !NOT_AN_OPTION.test(text(t)), // ("Apply", "Clear all", "Close" are not tabs)
  )
// Clicks one tab and returns the options that appeared for it (inside its panel only).
async function openTab(list: HTMLElement, tab: HTMLElement): Promise<Control[]> {
  if (!tabPanel(list)) return []
  const name = cleanHeading(text(tab))
  const first = tab === tabsOf(list)[0]
  const before = new Set(document.querySelectorAll(OPTIONISH))
  tab.click()
  await quiet(300, 1500)
  // A shop may draw the whole panel again on each tab click: find it again.
  const liveList = tabList() ?? list
  const panel = tabPanel(liveList)
  if (!panel) return []
  const out: Control[] = []
  // (The first tab is often open already: its options were there before the click.)
  const fresh = [...panel.querySelectorAll<HTMLElement>(OPTIONISH)].filter((el) => !before.has(el))
  const pool = fresh.length || !first ? fresh : [...panel.querySelectorAll<HTMLElement>(OPTIONISH)]
  const tabs = tabsOf(liveList)
  for (const el of pool) {
    // (Accordion panels may sit inside the tab list itself: only the tabs are not options.)
    if (tabs.some((t) => t.contains(el)) || !visible(el) && !(el instanceof HTMLInputElement) || el.querySelector(OPTIONISH)) continue
    const label = labelOf(el)
    if (label && label.length <= 60 && !NOT_AN_OPTION.test(label) && !GENERIC_HEADING.test(label)) out.push({ group: name, label, el })
  }
  return out
}
async function tabControls(): Promise<Control[]> {
  const list = tabList()
  if (!list) return []
  const out: Control[] = []
  // By name: the tabs may be new elements after each click.
  for (const name of tabsOf(list).slice(0, 20).map((t) => cleanHeading(text(t)))) {
    const live = tabList()
    const tab = live && tabsOf(live).find((t) => cleanHeading(text(t)) === name)
    if (!live || !tab) continue
    out.push(...(await openTab(live, tab)))
    if (ariaSliders() || priceSlider()) priceTab = name
  }
  return out
}
// Set when an option was chosen in a tabbed panel: its "Apply" is pressed after that choice.
let applyPending = false
// The "Apply" of the tabbed panel only (not a coupon box's "Apply" elsewhere on the page).
function pressApply() {
  const list = tabList()
  const panel = list && tabPanel(list)
  // (Or a pop-up's own button: Ajio's "MORE" list.)
  const scope = panel ? [...panel.querySelectorAll<HTMLElement>('button, [role="button"], input[type="submit"]')]
    : [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].filter((b) => b.closest(POPUP))
  const button = scope.find(
    (b) => visible(b) && /^(apply(?: filters?)?|show (?:\d+ )?(?:results|products|items)|view (?:\d+ )?(?:results|products|items)|done)$/i.test(text(b) || (b as HTMLInputElement).value || ''),
  )
  // A pop-up whose "Apply" stays disabled until something changes (MUI): close it instead.
  if (button && !(button as HTMLButtonElement).disabled) button.click()
  else if (!panel) scope.find((b) => visible(b) && /close|cross|dismiss/i.test(b.getAttribute('aria-label') ?? '') || /^[×✕x]$/i.test(text(b)))?.click()
  applyPending = false
}

// Whole lists behind a "MORE" pop-up (Ajio shows 5 brands there, the pop-up all 962). Only
// brands, colours and sizes: the lists people name an option from. Closed with its "Apply".
// "MORE" (Ajio) or "+ 21 More" as clickable text (MUI shops: Max, Lifestyle).
const moreButtons = () => [...document.querySelectorAll<HTMLElement>('button, [role="button"], h1, h2, h3, h4, h5, h6, span, div, a, p')].filter((b) =>
  /^more$|^\+\s*\d+\s*more$|^(?:show|view|see) all$/i.test(text(b)) && b.childElementCount <= 1 && visible(b) && !b.closest(POPUP) &&
  (b.matches('button, [role="button"]') || getComputedStyle(b).cursor === 'pointer'))
const POPUP = '[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="popup" i]'
async function popupControls(): Promise<Control[]> {
  const out: Control[] = []
  const buttons = moreButtons()
  for (const b of buttons.slice(0, 10)) {
    const group = groupOf(b)
    if (!/brand|colou?r|size/i.test(group)) continue
    const before = new Set(checkControls().map((c) => c.el))
    b.click()
    await quiet(400, 3000)
    out.push(...checkControls().filter((c) => !before.has(c.el) && c.el.closest(POPUP)).map((c) => ({ ...c, group })))
    pressApply()
    await quiet(400, 3000)
  }
  return out
}

// Opens each dropdown in turn and reads its options (only one stays open at a time on most shops).
async function dropdownControls(): Promise<Control[]> {
  const out: Control[] = []
  for (const b of dropdownButtons().slice(0, 15)) {
    const wasOpen = b.getAttribute('aria-expanded') === 'true'
    const name = barName(b)
    const opened = await openDropdown(b)
    // Price boxes inside this dropdown (Puma: "Price ▾" → From / To): offered as min/max price.
    const { min, max } = priceBoxes()
    if (min || max) priceDropdown = name
    else for (const c of opened) out.push({ ...c, group: name })
    if (!wasOpen && b.getAttribute('aria-expanded') === 'true') { b.click(); await quiet(200, 1000) }
    // A pop-up with no aria state: close it again (its own close button, else Escape).
    else if (!b.hasAttribute('aria-expanded')) {
      const pop = [...document.querySelectorAll<HTMLElement>(POPUP)].filter(visible).pop()
      const close = pop && [...pop.querySelectorAll<HTMLElement>('button, [role="button"], span, i, div')].find((x) => /close|cancel|dismiss/i.test(`${x.getAttribute('aria-label') ?? ''} ${x.getAttribute('class') ?? ''}`) && x.childElementCount <= 1)
      if (close) close.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await quiet(200, 1000)
    }
  }
  return out
}

// Applying is one request at a time: a reload's leftovers (resume) and a new request from the
// panel must not click the same box at the same moment (two clicks = unticked again).
let queue: Promise<unknown> = Promise.resolve()
// What the request being applied could not find so far (sent if the page unloads mid-way).
let missingSoFar: FilterChoice[] = []

export const generic: SiteAdapter & {
  search(text: string): void
  resume(): void
  missingSoFar(): FilterChoice[]
  result(): Promise<FilterChoice[] | null>
} = {
  // "Nike", else the host without www ("decathlon.in").
  get name() {
    return document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content.trim() || location.hostname.replace(/^www\./, '')
  },
  matches: () => true,

  searchTerm() {
    const params = new URL(location.href).searchParams
    // (Not a filter code in a search-like name: Ajio's "query=:relevance:brand:Puma" beside "text=jacket".)
    for (const p of SEARCH_PARAMS) { const v = params.get(p)?.trim(); if (v && !/^:|:relevance/i.test(v)) return v }
    // A category page ("Men's Shoes") has no search text: its heading says what it shows, so
    // "running shoes size 10" filters it instead of searching again.
    const heading = text(document.querySelector('main h1, h1'))
    // Else the title's first part ("Kurtas | Shop" → "Kurtas").
    const title = document.title.split(/\s[|–—-]\s/)[0].trim()
    return searchBox()?.value.trim() || (heading.length <= 60 ? heading : '') || (title.length <= 60 ? title : '')
  },

  searchUrl(textValue) {
    // Shops whose search box ignores scripted typing and whose address is not ?q= (checked live).
    const site = SITE_SEARCH.find(([host]) => host.test(location.hostname))
    if (site) return `${location.origin}${site[1]}${encodeURIComponent(textValue)}`
    const fromForm = formUrl(textValue)
    if (fromForm) return fromForm
    // The page is itself a search (?q=…): same page, new text.
    const url = new URL(location.href)
    const p = SEARCH_PARAMS.find((p) => url.searchParams.get(p) && !/^:|:relevance/i.test(url.searchParams.get(p)!))
    if (p) {
      url.searchParams.set(p, textValue)
      return url.href
    }
    return `${location.origin}/search?q=${encodeURIComponent(textValue)}` // Shopify, WooCommerce-like, many others
  },

  // Some search boxes are not plain forms (JavaScript only): type into them and press Enter.
  search(textValue) {
    const box = searchBox()
    if (formUrl(textValue) || !box || SITE_SEARCH.some(([host]) => host.test(location.hostname))) return navigateSoon(generic.searchUrl(textValue))
    setTimeout(async () => {
      const at = location.href
      // (A "#" or an empty "?" added to the address is not a search.)
      const moved = () => !samePage(location.href, at)
      // Some boxes only open a search panel on click/focus, and read typing, not a set value.
      box.click()
      box.focus()
      setValue(box, textValue)
      for (const type of ['keydown', 'keypress', 'keyup'])
        box.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
      // Each next step only when the one before did nothing (else it would search twice):
      // the form, then the search button beside the box, then the site's search address.
      await wait(800)
      if (!moved() && box.form) box.form.requestSubmit()
      await wait(800)
      if (!moved()) {
        let node: HTMLElement | null = box.parentElement
        for (let i = 0; node && i < 4; i++, node = node.parentElement) {
          const button = [...node.querySelectorAll<HTMLElement>('button, [role="button"], input[type="submit"]')].find(
            (b) => b !== box && /search|submit|go/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('title') ?? ''} ${b.className} ${b.getAttribute('type') ?? ''} ${text(b)}`),
          )
          if (button) { button.click(); break }
        }
      }
      await wait(1500)
      if (!moved()) navigateSoon(generic.searchUrl(textValue))
    }, 50)
  },

  // Product cards, for the price comparison: a price with a product link around it, in page order.
  products(): Product[] {
    const out: Product[] = []
    const seen = new Set<string>()
    const boxes = facetBoxes()
    const realLinks = (el: Element) =>
      [...el.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => !/^(#|javascript:)/i.test(a.getAttribute('href') ?? ''))
    // The smallest elements holding one amount: "₹1,599", or "<span>₹</span><span>1,599</span>".
    // Not a struck MRP, a price filter ("Under ₹500", "₹500 - ₹999"), an EMI or a saving.
    const prices = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => {
      if (el.children.length > 4) return false
      const t = text(el)
      return t.length < 40 && money(t) > 0 &&
        !/\b(?:under|over|above|below|up ?to|save|saving|off|emi|mrp|per month|\/mo)\b|\d\s*(?:[-–]|to)\s*(?:₹|rs|\$|€|£)/i.test(t) &&
        !el.closest('s, del, strike, label, select, aside, details, header, footer, nav, [class*="strike" i], [class*="line-through" i], [class*="mrp" i], [class*="original" i]') &&
        !el.querySelector(CHECKS) && !boxes.some((b) => b.contains(el))
    })
    for (const p of prices) {
      // The card is often the link itself (<a><img><h3>…</h3><span>₹999</span></a>).
      let card: HTMLElement | null = p.closest<HTMLElement>('a[href]') ?? p
      for (let i = 0; card && i < 8 && card.tagName !== 'A' && !realLinks(card).length; i++) card = card.parentElement
      if (!card) continue
      const link = card instanceof HTMLAnchorElement ? card : realLinks(card)[0]
      // Climbed into the whole grid (many products), not one card. (A card may link a few colours.)
      if (!link || /^(#|javascript:)/i.test(link.getAttribute('href') ?? '') || new Set(realLinks(card).map((a) => a.href)).size > 12) continue
      // The longest name-like text on the card ("new" badges, "+10" colour counts are shorter);
      // the picture's alt text only when the card has no text name.
      const name = (list: (string | null | undefined)[]) =>
        list.map((t) => (t ?? '').replace(/\s+/g, ' ').trim())
          // (Labels for the card itself are not a name: "product card", "Add to bag", "Quick view".)
          .filter((t) => t.length <= 200 && /[a-z].*[a-z].*[a-z]/i.test(t) && !(money(t) > 0) &&
            !/^(?:product(?: card| image| tile| item)?|image|photo|view|details|quick ?view|add to (?:cart|bag|wishlist)|wishlist|new|sale|sold out|bestseller)$/i.test(t))
          .sort((a, b) => b.length - a.length)[0]
      const title =
        name([...card.querySelectorAll('h2, h3, h4, [class*="title" i], [class*="name" i]')].map((e) => text(e)).concat(realLinks(card).map((a) => text(a)))) ||
        // A card that is one link with name and price together (Shoppers Stop): its text up to the price.
        name([text(link).split(/(?:₹|\bRs\.?|\$|€|£)\s*\d/)[0]]) ||
        name([link.getAttribute('aria-label'), link.getAttribute('title'), card.querySelector('img')?.alt])
      const price = money(text(p))
      if (!title || seen.has(link.href) || seen.has(`${title}|${price}`)) continue
      seen.add(link.href).add(`${title}|${price}`)
      // Many shops show the brand apart from the name (Ajio: "Puma" over "Men Hooded Jacket"):
      // the comparison checks titles for the brand, so put it in front.
      const brand = text(card.querySelector('[class*="brand" i]'))
      const full = brand && brand.length <= 40 && !title.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${title}` : title
      // Without a rating count or colour count stuck at the end ("… Black 17.2k +7").
      const tidy = full.replace(/\s+\d[\d.,]*k\b.*$/i, '').replace(/\s+\+\d+\s*$/, '').trim() || full
      out.push({ title: tidy.slice(0, 200), price, url: link.href })
    }
    return out
  },

  async extractFilters(): Promise<FilterGroup[]> {
    await pageReady()
    await openSections()
    let controls = checkControls()
    // Nothing to pick from: the filters may be in a panel that a "Filters" button opens.
    // (Also when only a sort list shows: Westside's filters are behind its "FILTER" button.)
    const onlySort = controls.every((c) => isSortGroup(c.group) || sortOptionsLike(c.label) || NOT_A_FILTER.test(c.group))
    // Or when what shows is thin (one group: Zara's "Woman | Man | Kids" section tabs): open it and
    // keep what is behind it if that has more groups.
    const thin = new Set(controls.filter((c) => !NOT_A_FILTER.test(c.group)).map((c) => c.group)).size < 2
    if ((onlySort || thin) && !selects().some((s) => !isSortSelect(s) && visible(s))) {
      const button = filterButton()
      if (button) {
        button.click(); await wait(500); await quiet()
        const behind = checkControls()
        if (onlySort || new Set(behind.map((c) => c.group)).size > new Set(controls.map((c) => c.group)).size) controls = behind
      }
    }
    // Options inside a bar of dropdown buttons, named after their button.
    const fromDropdowns = await dropdownControls()
    controls = [...controls.filter((c) => !fromDropdowns.some((d) => d.el === c.el)), ...fromDropdowns]
    // Options behind the tabs of a tabbed panel, named after their tab.
    const fromTabs = await tabControls()
    if (fromTabs.length) controls = [...controls.filter((c) => !fromTabs.some((d) => d.el === c.el || d.label === c.label && d.group === c.group)), ...fromTabs]
    controls.push(...(await popupControls()))
    const groups = new Map<string, Set<string>>()
    const add = (g: string, o: string) => (groups.get(g) ?? groups.set(g, new Set()).get(g)!).add(o)
    const sort = sortOptions(controls)
    for (const c of controls) if (!(sort.size && isSortGroup(c.group)) && !NOT_A_FILTER.test(c.group)) add(c.group, c.label)
    for (const s of selects()) {
      if (isSortSelect(s)) continue
      const name = selectName(s)
      if (NOT_A_FILTER.test(name)) continue
      // The first option is often a placeholder ("Choose…", "All").
      if (name) for (const o of s.options) if (o.value && text(o) && !/^(choose|select|all|any|--)/i.test(text(o))) add(name, text(o))
    }
    const out: FilterGroup[] = [...groups].map(([name, options]) => ({ name, options: [...options] }))
    const menu = sort.size ? sort : await sortMenu()
    if (menu.size) out.push({ name: SORT_GROUP, options: [...menu.keys()] })
    const { min, max } = priceBoxes()
    const currency = min || max ? pageCurrency() : ''
    if (min) out.push({ name: MIN_PRICE, options: [anyAmount(currency)] })
    if (max) out.push({ name: MAX_PRICE, options: [anyAmount(currency)] })
    if (!min && !max && priceDropdown) out.push({ name: MIN_PRICE, options: [anyAmount(pageCurrency())] }, { name: MAX_PRICE, options: [anyAmount(pageCurrency())] })
    if (!min && !max && (priceSlider() || priceRanges() || ariaSliders() || priceTab)) out.push({ name: MIN_PRICE, options: [anyAmount(pageCurrency())] }, { name: MAX_PRICE, options: [anyAmount(pageCurrency())] })
    return out
  },

  applyFilters: (choices: FilterChoice[]) => applyQueued(choices, 0, []),

  /** What the request being applied could not find so far (for a reply sent while the page unloads). */
  missingSoFar: () => [...missingSoFar],

  /**
   * The final result of a request that reloaded the page: what could not be applied, once the
   * leftovers are done here. null: another reload is coming (ask the next page).
   */
  async result(): Promise<FilterChoice[] | null> {
    await queue
    try {
      if (sessionStorage.getItem(PENDING)) return null
      const r = JSON.parse(sessionStorage.getItem(RESULT) ?? 'null')
      store(RESULT, null) // read once
      return r?.missing ?? []
    } catch { return [] }
  },

  // Called when a page loads: finish the choices a reload interrupted (less than 30 s ago).
  // Queued at once, so a result request waits for it.
  resume() {
    let p: Pending | null = null
    try {
      p = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null')
      sessionStorage.removeItem(PENDING)
    } catch { return }
    if (!p?.choices?.length) return
    const left = p
    if (Date.now() - left.at > 30000) return store(RESULT, { at: Date.now(), missing: [...(left.missing ?? []), ...left.choices] })
    queue = queue.then(async () => {
      // Like reading a fresh page: wait until its filters are drawn (Decathlon: ~4 s after load).
      await pageReady()
      await applyAll(left.choices, (left.hops ?? 0) + 1, left.missing ?? [])
    }).catch(() => {})
  },
}

function applyQueued(choices: FilterChoice[], hops: number, missing: FilterChoice[]): Promise<FilterChoice[]> {
  const run = queue.then(() => applyAll(choices, hops, missing))
  queue = run.catch(() => {})
  return run
}

// One choice at a time, reading the page again after each (it re-renders after a click).
async function applyAll(choices: FilterChoice[], hops: number, carried: FilterChoice[]) {
  missingSoFar = []
  // A new request: an old result nobody collected must not be taken for this one's.
  if (hops === 0) store(RESULT, null)
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i]
    // If this click reloads the page, the rest is applied there (see resume). "Clear all" stays
    // pending itself: one reload may take off only one of several filters.
    savePending(c.group === '*' ? choices.slice(i) : choices.slice(i + 1), hops, [...carried, ...missingSoFar])
    if (!(await applyOne(c))) missingSoFar.push(c)
    await quiet()
    // A tabbed panel filters only on "Apply", and some (Westside) forget a tab's pick when another
    // tab is opened: apply after each one (the panel is opened again for the next).
    if (applyPending) { pressApply(); await quiet(800, 5000) }
  }
  savePending([], hops, [])
  const missing = [...carried, ...missingSoFar]
  // After a reload the panel asks this page for the result; without one it got the reply directly.
  if (hops > 0) store(RESULT, { at: Date.now(), missing })
  return missing
}

// After clicking a link: waits (max 15 s) until the page goes, or until the address changes and
// the page settles (shops that switch pages without reloading). A link to this same page: no wait.
async function leaving(href: string) {
  if (samePage(href, location.href)) return
  const at = location.href
  let gone = false
  const onHide = () => (gone = true)
  addEventListener('pagehide', onHide, { once: true })
  for (const end = Date.now() + 15000; !gone && Date.now() < end && samePage(location.href, at); ) await wait(100)
  removeEventListener('pagehide', onHide)
  if (!gone) await quiet()
}

// Takes one ticked filter off. A radio is taken off by picking its group's "All" option, when
// there is one. false when it can't be taken off.
async function untick(x: Control, all: Control[]): Promise<boolean> {
  if (!isRadio(x.el)) {
    press(x.el)
    if (x.el instanceof HTMLAnchorElement) await leaving(x.el.href) // a link reloads: see applyOne
    return true
  }
  const any = all.find((y) => y.group === x.group && y !== x && ANY_OPTION.test(y.label))
  if (any) press(any.el)
  return !!any
}

// The "Apply" button of the panel holding an option, if it has one (hidden ones count: Purplle's
// dropdown works without being opened).
function nearApply(el: HTMLElement): HTMLElement | undefined {
  for (let p = el.parentElement, i = 0; p && i < 6; i++, p = p.parentElement) {
    if (p === document.body) return
    const b = [...p.querySelectorAll<HTMLElement>('button, [role="button"], a, input[type="submit"]')].find((b) =>
      /^apply(?: filters?)?$/i.test(text(b) || (b as HTMLInputElement).value || '') && !(b as HTMLButtonElement).disabled &&
      // (not the price boxes' own Apply)
      !b.parentElement?.parentElement?.querySelector('input[type="text"], input[type="number"], input:not([type])'))
    if (b) return b
  }
}

// Applies one choice; false when the page has no such filter.
async function applyOne(c: FilterChoice): Promise<boolean> {
  if (c.group === SORT_GROUP) {
    let choose = sortOptions().get(c.option) ?? (await sortMenu()).get(c.option)
    // A "Sort By" tab in a tabbed filter panel (Westside): open it, choose there, then its "Apply".
    if (!choose) {
      let list = tabList()
      if (!list) { filterButton()?.click(); await quiet(400, 2000); list = tabList() }
      const tab = list && tabsOf(list).find((t) => isSortGroup(cleanHeading(text(t))))
      if (list && tab) {
        const pick = sortOptions(await openTab(list, tab)).get(c.option)
        if (pick) { choose = pick; applyPending = true }
      }
    }
    await choose?.()
    return !!choose
  }
  // Price boxes inside a closed dropdown of the filter bar (Puma): open it first.
  if ((c.group === MIN_PRICE || c.group === MAX_PRICE) && priceDropdown && !priceBoxes().min && !priceBoxes().max) {
    const b = dropdownButtons().find((x) => same(barName(x), priceDropdown))
    if (b) await openDropdown(b)
  }
  const boxes = priceBoxes()
  const priceGroup = c.group === MIN_PRICE || c.group === MAX_PRICE
  // "remove price": the price boxes, unless this page's price filter is a list (then below).
  if (priceGroup || (/price/i.test(c.group) && c.remove && c.option === '*' && (boxes.min || boxes.max || priceSlider() || priceRanges() || ariaSliders() || priceTab))) {
    const targets = c.group === MIN_PRICE ? [boxes.min] : c.group === MAX_PRICE ? [boxes.max] : [boxes.min, boxes.max]
    if (!targets.some(Boolean)) {
      const price = c.remove ? null : Number(c.option.replace(/[^\d.]/g, ''))
      const ends = c.group === MIN_PRICE ? ['min'] as const : c.group === MAX_PRICE ? ['max'] as const : ['min', 'max'] as const
      for (const end of ends) if (!(await slidePrice(end, price))) return false
      return true
    }
    const value = c.remove ? '' : String(Number(c.option.replace(/[^\d.]/g, '')))
    for (const box of targets) if (box) setValue(box, value)
    // Only one side asked and the other box empty: some shops (Ajio) apply nothing until both are
    // filled, so give the other side its widest value (0, or 999… within the box's length limit).
    if (!c.remove && targets.length === 1) {
      const other = c.group === MIN_PRICE ? boxes.max : boxes.min
      if (other && !other.value.trim()) setValue(other, c.group === MIN_PRICE ? '9'.repeat(Math.min(other.maxLength > 0 ? other.maxLength : 7, 7)) : '0')
    }
    // A box that won't take typing (a slider's display) is not applied: say so.
    if (targets.some((b) => b && Number(b.value.replace(/[^\d.]/g, '')) !== Number(value))) return false
    submitPrice((targets.find(Boolean))!)
    return true
  }


  // "Clear all filters": untick everything ticked (not the sort order), empty the price boxes.
  if (c.group === '*') {
    const tried = new Set<string>()
    for (let guard = 0; guard < 40; guard++) {
      const all = checkControls()
      const on = all.find((x) => isOn(x.el) && !isSortGroup(x.group) && !NOT_A_FILTER.test(x.group) && !tried.has(`${x.group}|${x.label}`))
      if (!on) break
      tried.add(`${on.group}|${on.label}`)
      if (!(await untick(on, all))) continue
      await quiet()
    }
    for (const s of selects()) if (!isSortSelect(s) && s.selectedIndex > 0 && !NOT_A_FILTER.test(selectName(s))) setValue(s, s.options[0].value)
    const { min, max } = priceBoxes()
    const filled = [min, max].filter((b): b is HTMLInputElement => !!b?.value)
    for (const b of filled) setValue(b, '')
    if (filled.length) submitPrice(filled[0])
    else if (priceSlider() || priceRanges()) { await slidePrice('min', null); await slidePrice('max', null) }
    return true
  }

  const controls = checkControls().filter((x) => same(x.group, c.group))
  const select = selects().find((s) => !isSortSelect(s) && same(selectName(s), c.group))

  if (c.remove) {
    const on = controls.filter((x) => isOn(x.el) && (c.option === '*' || sameOption(x.label, c.option)))
    // Several clicks: each may re-render the list, so find the next one again each time.
    for (const x of on) {
      const all = checkControls()
      const fresh = all.find((y) => same(y.group, x.group) && same(y.label, x.label))
      if (fresh && isOn(fresh.el) && (await untick(fresh, all))) await quiet()
    }
    if (select && (c.option === '*' || same(text(select.selectedOptions[0]), c.option))) setValue(select, select.options[0].value)
    // Ticked inside a "MORE" pop-up and not in the main list (Ajio): untick it there (the pop-up's
    // "Apply" is pressed after this choice), or just close the pop-up if it is already off.
    if (!on.length && c.option !== '*' && !select && !controls.some((x) => sameOption(x.label, c.option))) {
      const hidden = await findControl(c.group, c.option)
      if (hidden) { if (isOn(hidden.el)) press(hidden.el); else pressApply(); return true }
    }
    // Already off counts as done (e.g. after "remove the gender filter" took the whole group off).
    return on.length > 0 || controls.some((x) => sameOption(x.label, c.option)) || !!select || c.option === '*'
  }

  let control = controls.find((x) => sameOption(x.label, c.option)) ?? (select ? undefined : await findControl(c.group, c.option))
  // Not found: look once more after a moment (a shop's first-visit pop-up or a panel still drawing,
  // Lenskart). Only the lookup is repeated; nothing has been clicked yet.
  if (!control && !select) { await quiet(800, 3000); control = await findControl(c.group, c.option) }
  if (control) {
    if (isOn(control.el)) return true
    press(control.el)
    // A link loads the filtered page; anything else must now read as ticked. If clicking the
    // label didn't take, click the box itself once.
    // A link loads the filtered page. Nothing more may be clicked here meanwhile: on a slow server
    // the next click would replace this one. (The rest is applied on the new page, see resume.)
    if (control.el instanceof HTMLAnchorElement) {
      await leaving(control.el.href)
      return true
    }
    await quiet()
    // An "Apply" beside the options (Purplle's dropdowns, Pepperfry's and Lenskart's drawers): the
    // tick counts only once it is pressed. (A tabbed panel's or pop-up's Apply is pressed by applyAll.)
    if (!applyPending) { const apply = nearApply(control.el); if (apply) { apply.click(); await quiet(); return true } }
    // An option that can't say whether it is ticked (a plain button, Westside) is clicked once
    // only: a second click would untick it.
    if (!canTell(control.el)) return true
    // A slow shop ticks only once its server answers: give it 3 s before clicking again.
    let after = await findControl(c.group, c.option)
    for (let i = 0; i < 6 && after && !isOn(after.el); i++) { await wait(500); after = await findControl(c.group, c.option) }
    if (!after || isOn(after.el)) return true
    after.el.click()
    await quiet()
    const last = await findControl(c.group, c.option)
    return !last || isOn(last.el)
  }
  const option = select && [...select.options].find((o) => same(text(o), c.option))
  if (select && option) {
    setValue(select, option.value)
    return true
  }
  return false
}
