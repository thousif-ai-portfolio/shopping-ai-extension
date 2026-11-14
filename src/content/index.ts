// Runs inside the shopping page. Picks the right adapter and answers the side panel.
import { amazon } from '../adapters/amazon'
import { flipkart } from '../adapters/flipkart'
import { myntra } from '../adapters/myntra'
import type { Message } from '../adapters/types'

const adapter = [amazon, flipkart, myntra].find((a) => a.matches(new URL(location.href)))

chrome.runtime.onMessage.addListener((msg: Message, _sender, reply) => {
  if (!adapter) return reply({ error: 'This site is not supported yet.' })

  if (msg.type === 'GET_FILTERS') {
    adapter.extractFilters().then((filters) => reply({ site: adapter.name, filters, searchTerm: adapter.searchTerm() }))
    return true // keep the channel open for the async reply
  } else if (msg.type === 'SEARCH') {
    reply({ ok: true })
    // Navigate a moment later so the reply reaches the side panel first.
    setTimeout(() => location.assign(adapter.searchUrl(msg.text)), 50)
  } else if (msg.type === 'NO_RESULTS') {
    // Each site's own "nothing found" message (checked on the live sites).
    const text = document.body.innerText.slice(0, 20000)
    reply({ empty: /no results for|did not match any products|sorry, no results found|couldn.t find any matches|no products found|no items found/i.test(text) })
  } else if (msg.type === 'GET_PRODUCTS') {
    reply({ products: adapter.products().slice(0, 30) })
  } else if (msg.type === 'APPLY_FILTERS') {
    adapter.applyFilters(msg.choices).then((missing) => reply({ missing }))
    return true // keep the channel open for the async reply
  }
})
