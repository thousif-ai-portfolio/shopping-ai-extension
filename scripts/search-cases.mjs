// The step before filtering: does a message need a new search (another product, or another site),
// and what exactly is searched? Expectations written before running.
//   now: the site the tab shows · current: what that page searched for
//   site: the site to open (null = stay) · search: the exact search text (null = no new search)
export const SEARCH = [
  // ===== The reported bug (Nov 12): request words leaked into the search, and "open amazon" was ignored
  { q: 'can you open amazon i need blue shirt which under 500', now: 'Flipkart', current: 'jacket men', site: 'Amazon', search: 'blue shirt' },
  // ===== Another product on the same site: only the product words are searched
  { q: 'give me running shoes', now: 'Flipkart', current: 'jacket men', site: null, search: 'running shoes' },
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
]
