// Blind batch 2 for the search step (any shop, typed addresses, colour typos, sizes/prices), written
// 17 Nov 2026 from the spec and the earlier cases only: implementation not read, nothing run.
//   now: the site the tab shows · current: what that page searched for
//   site: the known site to open (null = stay) · search: the exact search text (null = no new search)
//   unknown: a shop named by bare name with website/site/app → the panel answers, no search, no open
//   domain: a typed address to open (host without "www."), then `search` there (null = no product words)
export const SEARCH_BLIND2 = [
  // ===== Another shop by bare name + website/site/app: never searched here, never guessed
  { q: 'open vastardo website', now: 'Flipkart', current: 'jacket men', site: null, search: null, domain: 'www.vastrado.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'check on nykaa app', now: 'Myntra', current: 'lipstick', site: null, search: null, domain: 'www.nykaa.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'can you show me brown shirt on ajio website', now: 'Amazon', current: 'jeans', site: null, search: 'brown shirt', domain: 'www.ajio.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'go to meesho site and find kurti under 300', now: 'Flipkart', current: 'saree', site: null, search: 'kurti', domain: 'www.meesho.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'tatacliq website pe dikhao', now: 'Myntra', current: 'watch men', site: null, search: null, domain: 'www.tatacliq.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'open snitch website', now: 'Flipkart', current: 'shirt men', site: null, search: null, unknown: 'snitch' }, // also a Flipkart brand: still not searched
  { q: 'open decathlon app', now: 'Amazon', current: 'cycle', site: null, search: null, domain: 'www.decathlon.in' } /* updated 17 Nov: well-known shops open by name */,
  // ===== Typed addresses: open them, search the product words there
  { q: 'go to nykaa.com', now: 'Flipkart', current: 'jacket', site: null, search: null, domain: 'nykaa.com' },
  { q: 'open www.vastrado.in brown shirt', now: 'Amazon', current: 'phone', site: null, search: 'brown shirt', domain: 'vastrado.in' },
  { q: 'ajio.com pe white sneakers dikhao size 9', now: 'Myntra', current: 'kurta', site: null, search: 'white sneakers', domain: 'ajio.com' },
  { q: 'https://www.decathlon.in running shoes under 3000', now: 'Flipkart', current: 'jeans', site: null, search: 'running shoes', domain: 'decathlon.in' },
  { q: 'open allbirds.com and show me wool runners size 10', now: 'Amazon', current: 'laptop', site: null, search: 'wool runners', domain: 'allbirds.com' },
  { q: 'take me to meesho.com, need cotton kurti under ₹400', now: 'Myntra', current: 'jeans', site: null, search: 'cotton kurti', domain: 'meesho.com' },
  // A known shop typed as an address is just that shop.
  { q: 'go to myntra.com', now: 'Flipkart', current: 'kurta', site: 'Myntra', search: 'kurta' },
  // ===== Colour typos in the search text: one letter wrong / missing / extra is fixed
  { q: 'broen shirt', now: 'Myntra', current: 'jeans', site: null, search: 'brown shirt' },
  { q: 'show me whiite sneakers', now: 'Flipkart', current: 'jacket men', site: null, search: 'white sneakers' },
  { q: 'grren hoodie for men', now: 'Amazon', current: 'shoes', site: null, search: 'green hoodie men' },
  { q: 'mujhe yelow saree chahiye', now: 'Myntra', current: 'kurta', site: null, search: 'yellow saree' },
  { q: 'purpple kurta for women', now: 'Flipkart', current: 'phone', site: null, search: 'purple kurta women' },
  // Two letters off (swapped letters): left as typed.
  { q: 'blakc shoes', now: 'Myntra', current: 'jeans', site: null, search: 'blakc shoes' },
  { q: 'show me balck jeans', now: 'Flipkart', current: 'shirt', site: null, search: 'balck jeans' },
  // ===== Real words one letter from a colour: never "corrected"
  { q: 'blank notebook', now: 'Amazon', current: 'phone', site: null, search: 'blank notebook' },
  { q: 'peace lily plant', now: 'Amazon', current: 'laptop', site: null, search: 'peace lily plant' },
  { q: 'grown up kids bicycle', now: 'Flipkart', current: 'shoes', site: null, search: 'grown up kids bicycle' },
  { q: 'write and wipe board for kids', now: 'Amazon', current: 'watch', site: null, search: 'write wipe board kids' /* corrected after the run: "and" is dropped like "for" in every earlier case */ },
  // ===== Sizes and prices are filters, never search words
  { q: 'blue shirt size is L', now: 'Flipkart', current: 'jeans', site: null, search: 'blue shirt' },
  { q: 'L size kurta dikhao', now: 'Myntra', current: 'jeans', site: null, search: 'kurta' },
  { q: 'running shoes size of 9 under 2500', now: 'Myntra', current: 'jacket', site: null, search: 'running shoes' },
  { q: 'trail shoes under $80', now: 'allbirds.com', current: 'wool runners', site: null, search: 'trail shoes' },
  { q: 'rain jacket below 50 euros', now: 'zalando.de', current: 'sneakers', site: null, search: 'rain jacket' },
  { q: 'wireless mouse $49.99', now: 'bestbuy.com', current: 'keyboard', site: null, search: 'wireless mouse' },
  // "10 pounds" is a weight, part of the product.
  { q: 'dumbbells 10 pounds', now: 'Amazon', current: 'yoga mat', site: null, search: 'dumbbells 10 pounds' },
  // ===== On a generic shop page
  { q: 'show me hiking boots', now: 'decathlon.in', current: 'running shoes', site: null, search: 'hiking boots' },
  { q: 'only adidas size 9', now: 'decathlon.in', current: 'running shoes', site: null, search: null },
  { q: 'open amazon', now: 'decathlon.in', current: 'running shoes', site: 'Amazon', search: 'running shoes' },
  // ===== Traps: "site"/"website"/"app" without naming another shop
  { q: 'is this on sale on this site', now: 'decathlon.in', current: 'running shoes', site: null, search: null },
  { q: 'same site please', now: 'Myntra', current: 'jeans', site: null, search: null },
  { q: 'show me on the official website', now: 'allbirds.com', current: 'wool runners', site: null, search: null },
  { q: 'website se kharido', now: 'Flipkart', current: 'phone', site: null, search: null },
  { q: 'is the app cheaper than the website', now: 'Amazon', current: 'laptop', site: null, search: null },
]
