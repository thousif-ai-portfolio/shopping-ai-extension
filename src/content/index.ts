// Runs inside the shopping page. Picks the right adapter and answers the side panel.
import { amazon } from '../adapters/amazon'
import { flipkart } from '../adapters/flipkart'
import { myntra } from '../adapters/myntra'
import { generic } from '../adapters/generic'
import { navigateSoon, type FilterChoice, type Message } from '../adapters/types'

// Amazon, Flipkart and Myntra have their own adapters; every other site gets the generic one.
const adapter = [amazon, flipkart, myntra].find((a) => a.matches(new URL(location.href))) ?? generic
// On other sites a filter click can reload the page: finish the filters still left to apply.
if (adapter === generic) generic.resume()

// Apply requests already taken (kept for the tab's session, across reloads of the same shop).
function seenRequest(id: string) {
  try {
    const key = 'ai-shopping-filters:request'
    if (sessionStorage.getItem(key) === id) return true
    sessionStorage.setItem(key, id)
  } catch { /* storage blocked: treat as new */ }
  return false
}

// A shop's block page instead of the shop (Akamai "Access Denied" on Uniqlo/Meesho/H&M, Adidas's
// "unable to give you access", bot checks). Only asked when the page has no filters at all.
const blockedPage = () =>
  /access denied|you don.t have permission to access|unable to give you access|security issue was automatically identified|request (?:was )?blocked|are you a (?:robot|human)|verify (?:that )?you are (?:a )?human|attention required/i
    .test(`${document.title} ${document.body?.innerText.slice(0, 1500) ?? ''}`)

// An error on the page must still answer the panel, or it would wait forever.
const failed = (reply: (r: unknown) => void) => (e: unknown) => reply({ error: `Could not read this page (${(e as Error)?.message ?? e}).` })

chrome.runtime.onMessage.addListener((msg: Message, _sender, reply) => {
  if (msg.type === 'GET_FILTERS') {
    adapter.extractFilters().then((filters) => reply({ site: adapter.name, filters, searchTerm: adapter.searchTerm(), blocked: !filters.length && blockedPage() }), failed(reply))
    return true // keep the channel open for the async reply
  } else if (msg.type === 'SEARCH') {
    reply({ ok: true })
    if (adapter === generic) generic.search(msg.text)
    else navigateSoon(adapter.searchUrl(msg.text))
  } else if (msg.type === 'NO_RESULTS') {
    // Each site's own "nothing found" message (checked on the live sites).
    const text = document.body.innerText.slice(0, 20000)
    reply({ empty: /no results for|did not match any products|sorry, no results found|couldn.t find any matches|no products found|no items found|(?:^|[^\d,.])0 results|no matching products/i.test(text) })
  } else if (msg.type === 'GET_PRODUCTS') {
    reply({ products: adapter.products().slice(0, 30) })
  } else if (msg.type === 'APPLY_FILTERS' && adapter === generic) {
    // The same request sent again (the panel resends when a reply got lost in a reload): it is
    // already being applied here or on the next page, so only point the panel to the result.
    if (msg.id && seenRequest(msg.id)) return reply({ missing: [], reloading: true })
    // A click can reload the page half-way (the rest is then applied by resume() on the new page).
    // Answer before the page goes, so the panel does not send the same request again.
    let sent = false
    const finish = (r: unknown) => {
      if (sent) return
      sent = true
      removeEventListener('pagehide', leaving)
      reply(r)
    }
    // (reloading: the rest is applied on the next page; the panel asks it for the result.)
    const leaving = () => finish({ missing: generic.missingSoFar(), reloading: true })
    addEventListener('pagehide', leaving)
    generic.applyFilters(msg.choices).then((missing: FilterChoice[]) => finish({ missing }), failed(finish))
    return true
  } else if (msg.type === 'APPLY_RESULT') {
    // After a reload: what the whole request could not apply (null = yet another reload coming).
    if (adapter !== generic) return reply({ missing: [] })
    generic.result().then((missing) => reply(missing ? { missing } : { reloading: true }), failed(reply))
    return true
  } else if (msg.type === 'APPLY_FILTERS' && msg.choices.some((c) => c.group === '*')) {
    // "clear all filters": the same search without any filters.
    reply({ missing: [] })
    navigateSoon(adapter.searchUrl(adapter.searchTerm()))
  } else if (msg.type === 'APPLY_FILTERS') {
    adapter.applyFilters(msg.choices).then((missing) => reply({ missing }), failed(reply))
    return true // keep the channel open for the async reply
  }
})
