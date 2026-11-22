// The step before filtering: does a message need a new search (another product, or another site),
// and what exactly is searched? Expectations written before running.
//   now: the site the tab shows · current: what that page searched for
//   site: the site to open (null = stay) · search: the exact search text (null = no new search)
export const SEARCH = [
  // ===== From the final review (17 Nov): ordinary words must not be "corrected" into products,
  // colours or shop names, and filter requests must not be read as another shop.
  { q: 'usb cable', now: 'Amazon', current: 'charger', site: null, search: null },
  { q: 'gold chain for men', now: 'Amazon', current: 'watch', site: null, search: null },
  { q: 'beard trimmer', now: 'Amazon', current: 'shirt', site: null, search: null },
  { q: 'house slippers', now: 'Myntra', current: 'jacket', site: null, search: 'house slippers' },
  { q: 'mellow yellow dress', now: 'Myntra', current: 'kurta', site: null, search: 'mellow yellow dress' },
  { q: 'greek style sandals', now: 'Myntra', current: 'kurta', site: null, search: 'greek style sandals' },
  { q: 'switch to puma', now: 'Amazon', current: 'jacket', site: null, search: null },
  { q: 'switch to boat', now: 'Amazon', current: 'earphones', site: null, search: null },
  { q: "switch to men's", now: 'Myntra', current: 'jackets', site: null, search: null },
  { q: 'open purple', now: 'Myntra', current: 'kurta', site: null, search: null },
  { q: 'open boat neck kurta', now: 'Myntra', current: 'jacket', site: null, search: 'boat neck kurta' },
  { q: 'open ajio red kurta', now: 'Amazon', current: 'jacket', site: null, search: 'red kurta', domain: 'www.ajio.com' },
  { q: 'go to nykaa lipstick', now: 'Flipkart', current: 'jacket', site: null, search: 'lipstick', domain: 'www.nykaa.com' },
  // ===== Found by hand (17 Nov): "open X" with no "website"/"app" was read as filters on this page.
  //   unknown: another shop named only by name → the panel answers, nothing is searched or opened
  { q: 'open insta mart i need egg', now: 'decathlon.in', current: 'running shoes', site: null, search: 'egg', domain: 'www.swiggy.com/instamart' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'open udemy', now: 'decathlon.in', current: 'running shoes', site: null, search: null, domain: 'www.udemy.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'go to bigbasket and order milk', now: 'Flipkart', current: 'jacket men', site: null, search: 'milk', domain: 'www.bigbasket.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'pls open swiggy instamart', now: 'Myntra', current: 'kurta', site: null, search: null, domain: 'www.swiggy.com/instamart' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'can you open zepto, i want milk', now: 'Amazon', current: 'jacket', site: null, search: 'milk', domain: 'www.zeptonow.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'hey take me to nykaa', now: 'decathlon.in', current: 'running shoes', site: null, search: null, domain: 'www.nykaa.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'visit croma please', now: 'Amazon', current: 'phone', site: null, search: null, domain: 'www.croma.com' } /* updated 17 Nov: well-known shops open by name */,
  { q: 'open blinkit', now: 'Myntra', current: 'running shoes', site: null, search: null, domain: 'blinkit.com' },
  { q: 'open ajio', now: 'Myntra', current: 'running shoes', site: null, search: null, domain: 'www.ajio.com' },
  { q: 'open blinkt i need bread', now: 'decathlon.in', current: 'running shoes', site: null, search: 'bread', domain: 'blinkit.com' },
  { q: 'open h&m and show black jeans', now: 'Amazon', current: 'jacket', site: null, search: 'black jeans', domain: 'www2.hm.com/en_in' },
  // Names not on the list of well-known shops: answered, never a guessed address
  { q: 'open kalki fashion website', now: 'Myntra', current: 'kurta', site: null, search: null, unknown: 'kalki fashion' },
  { q: 'open shopxyzq', now: 'decathlon.in', current: 'running shoes', site: null, search: null, unknown: 'shopxyzq' },
  { q: 'go to snitch', now: 'Flipkart', current: 'shirt men', site: null, search: null, unknown: 'snitch' },
  // …but these are not another shop
  { q: 'open myntra i need a kurta', now: 'decathlon.in', current: 'running shoes', site: 'Myntra', search: 'kurta' },
  { q: 'open the cart', now: 'decathlon.in', current: 'running shoes', site: null, search: null },
  { q: 'go to next page', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  { q: 'open toe sandals', now: 'Myntra', current: 'heels', site: null, search: 'toe sandals' },
  { q: 'open filters', now: 'decathlon.in', current: 'running shoes', site: null, search: null },
  { q: 'go to black shoes', now: 'Amazon', current: 'jacket', site: null, search: 'black shoes' },
  { q: 'open decathlon', now: 'decathlon.in', current: 'running shoes', site: null, search: null },
  // ===== The reported bug (Nov 12): request words leaked into the search, and "open amazon" was ignored
  { q: 'can you open amazon i need blue shirt which under 500', now: 'Flipkart', current: 'jacket men', site: 'Amazon', search: 'blue shirt' },
  // ===== Another product on the same site: only the product words are searched
  { q: 'give me running shoes', now: 'Flipkart', current: 'jacket men', site: null, search: 'running shoes' },
  { q: 'tell me this blue shirt', now: 'Flipkart', current: 'jacket men', site: null, search: 'blue shirt' },
  { q: 'can you show me running shoes', now: 'Flipkart', current: 'jacket men', site: null, search: 'running shoes' },
  { q: 'i need a blue shirt which is under 500', now: 'Flipkart', current: 'jacket men', site: null, search: 'blue shirt' },
  { q: 'do you have any white sneakers in size 9', now: 'Myntra', current: 'jackets', site: null, search: 'white sneakers' },
  { q: 'please show me some samsung phones with 8gb ram under 15000', now: 'Flipkart', current: 'running shoes', site: null, search: 'samsung phones 8gb ram' },
  { q: 'hey bro i want a laptop', now: 'Amazon', current: 'jacket', site: null, search: 'laptop' },
  { q: 'mujhe kurta chahiye 1000 ke andar', now: 'Flipkart', current: 'jacket', site: null, search: 'kurta' },
  { q: 'looking for a watch for my dad', now: 'Myntra', current: 'shoes', site: null, search: 'watch dad' },
  { q: 'show me nike t-shirts 40% off', now: 'Amazon', current: 'jacket', site: null, search: 'nike t-shirts' }, // first written as "tshirts": both search the same
  // ===== Same product as the page: no search, just filter
  { q: 'black puma jacket under 2000', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  { q: 'can you show me jackets in red', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  { q: 'size M', now: 'Myntra', current: 'jackets', site: null, search: null },
  { q: 'remove puma', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  // ===== Another site
  { q: 'open myntra', now: 'Flipkart', current: 'jacket men', site: 'Myntra', search: 'jacket men' },
  { q: 'show me this on amazon', now: 'Myntra', current: 'puma shoes', site: 'Amazon', search: 'puma shoes' },
  { q: 'nike shoes on flipkart under 3000', now: 'Amazon', current: 'jacket', site: 'Flipkart', search: 'nike shoes' },
  { q: 'amazon pe samsung phone dikhao', now: 'Flipkart', current: 'jacket', site: 'Amazon', search: 'samsung phone' },
  { q: 'go to flipkart and find red kurta', now: 'Myntra', current: 'shoes', site: 'Flipkart', search: 'red kurta' },
  { q: 'search on myntra for black jacket size L', now: 'Amazon', current: 'phone', site: 'Myntra', search: 'black jacket' },
  { q: 'check amazon', now: 'Flipkart', current: 'running shoes', site: 'Amazon', search: 'running shoes' },
  { q: 'switch to flipkart', now: 'Amazon', current: 'jacket', site: 'Flipkart', search: 'jacket' },
  { q: 'open amzon', now: 'Flipkart', current: 'jacket men', site: 'Amazon', search: 'jacket men' },
  { q: 'Open Amazon.in please', now: 'Myntra', current: 'kurta', site: 'Amazon', search: 'kurta' },
  // ===== Naming the site you are already on: just filter
  { q: 'open flipkart', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  { q: 'black jacket on flipkart', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  // ===== Mentioning a site is not always a request to go there
  { q: 'is amazon better', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  { q: 'amazon', now: 'Flipkart', current: 'jacket men', site: null, search: null },
  // ===== Second user-found bug (Nov 12): three sites named, typo "shirst", other colour than the page, "size is 40"
  { q: 'can you compare and give me all amazon and flipkart and myntra fo white shirst which is better i need roadstar size is 40', now: 'Myntra', current: 'merun shirt', site: null, search: 'white shirt roadstar' },
  { q: 'white shirt', now: 'Myntra', current: 'merun shirt', site: null, search: 'white shirt' },
  { q: 'maroon shirt size 40', now: 'Myntra', current: 'merun shirt', site: null, search: null }, // merun = maroon
  { q: 'black jacket', now: 'Flipkart', current: 'jacket men', site: null, search: null }, // page has no colour: filter
  { q: 'blue jeans', now: 'Amazon', current: 'black jeans', site: null, search: 'blue jeans' },
  { q: 'black jaket', now: 'Flipkart', current: 'running shoes', site: null, search: 'black jacket' },
  { q: 'short kurta', now: 'Myntra', current: 'shoes', site: null, search: 'short kurta' }, // "short" is not "shirt"
  { q: 'compare flipkart and myntra', now: 'Amazon', current: 'jacket', site: null, search: null },
  // ===== Third user-found bug (Nov 12): "lower price" and a repeated "shirt" went into the search → zero results
  { q: 'can you compare black shirt roadstar size is 40 i need that shirt which is lower price compare to all amazon flipkart and myntra', now: 'Myntra', current: 'white shirt roadstar', site: null, search: 'black shirt roadstar' },
  { q: 'cheapest white shirt', now: 'Myntra', current: 'merun shirt', site: null, search: 'white shirt' },
  { q: 'blue jeans lowest price', now: 'Amazon', current: 'black jeans', site: null, search: 'blue jeans' },
  // ===== Found by hand (22 Nov): a shop named after "from/on" was searched for on the open shop
  //   ("hrx white shirt ajio" on BigBasket) instead of opening that shop
  { q: 'i need hrx white shirt from ajio', now: 'bigbasket.com', current: '', site: null, search: 'hrx white shirt', domain: 'www.ajio.com' },
  { q: 'kurta on meesho under 500', now: 'Flipkart', current: 'jacket men', site: null, search: 'kurta', domain: 'www.meesho.com' },
  { q: 'ajio pe white shirt dikhao', now: 'Amazon', current: 'jacket', site: null, search: 'white shirt', domain: 'www.ajio.com' },
  { q: 'chair from ikea', now: 'Amazon', current: 'sofa', site: null, search: 'chair', domain: 'www.ikea.com/in' },
  // "open H and m" was split at "and" ("I can't open h")
  { q: 'open H and m', now: 'www.adidas.co.in', current: '', site: null, search: null, domain: 'www2.hm.com/en_in' },
  { q: 'open h&m', now: 'Flipkart', current: 'jacket', site: null, search: null, domain: 'www2.hm.com/en_in' },
  { q: 'can you open h & m and show black jeans', now: 'Amazon', current: 'shirt', site: null, search: 'black jeans', domain: 'www2.hm.com/en_in' },
]
