// Messages on "any site" pages (the generic adapter): filter lists taken from real shops
// (Decathlon, Allbirds) and the local test shops, in ₹, $ and €. Expectations written before
// running. Same format as everyday-cases.mjs.
export const GENERIC = [
  // ===== Decathlon (₹, price boxes)
  { cat: 'generic', site: 'generic-decathlon', q: 'black shoes for women', expect: ['Color: Black', 'Gender: Women'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'kiprun 40% off', expect: ['Brand: Kiprun', 'Discount: 40% and above'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'adidas size 8 under 3000', expect: ['Brand: Adidas', 'Size: 8 - eu 42', 'Max price: ₹3000'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'uk 10', expect: ['Size: 10 - eu 44'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'above 2000', expect: ['Min price: ₹2000'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'between 1000 and 2500', expect: ['Min price: ₹1000', 'Max price: ₹2500'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'trail running', expect: ['Sport: Trail', 'Sport: Running'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'cheapest first', expect: [] , reply: 'note' },
  { cat: 'generic', site: 'generic-decathlon', q: '4 star and above', expect: ['Rating: Above 4★'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'well rated adidas 3+ stars', expect: ['Brand: Adidas', 'Rating: Above 3★'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'remove adidas', applied: ['Brand: Adidas', 'Color: Black'], expect: ['-Brand: Adidas'] },
  { cat: 'generic', site: 'generic-decathlon', q: 'clear all filters', applied: ['Brand: Adidas'], expect: ['-*: *'] },
  // ===== Allbirds ($, price as a list of ranges, lowercase colours)
  { cat: 'generic', site: 'generic-allbirds', q: 'size 10 black', expect: ['Size: 10', 'Color: black'] },
  { cat: 'generic', site: 'generic-allbirds', q: 'wool slip ons size 9.5', expect: ['Material: wool', 'Product Type: Slip Ons', 'Size: 9.5'] },
  { cat: 'generic', site: 'generic-allbirds', q: 'under $100', expect: ['Price: Under $75', 'Price: $76 - $100'] }, // every range that fits (17 Nov), not only the top one
  { cat: 'generic', site: 'generic-allbirds', q: 'cheapest first', expect: ['Sort by: Price: Low to High'] },
  { cat: 'generic', site: 'generic-allbirds', q: 'newest', expect: ['Sort by: Newest First'] },
  // ===== US test shop ($ price boxes)
  { cat: 'generic', site: 'generic-usshop', q: 'nike size uk 10 under $80', expect: ['Brand: Nike', 'Size: UK 10', 'Max price: $80'] },
  { cat: 'generic', site: 'generic-usshop', q: 'between $50 and $90', expect: ['Min price: $50', 'Max price: $90'] },
  { cat: 'generic', site: 'generic-usshop', q: '$60 to $120 asics', expect: ['Brand: ASICS', 'Min price: $60', 'Max price: $120'] },
  { cat: 'generic', site: 'generic-usshop', q: 'under 80 dollars', expect: ['Max price: $80'] },
  { cat: 'generic', site: 'generic-usshop', q: 'shoes $75', expect: ['Max price: $75'] },
  { cat: 'generic', site: 'generic-usshop', q: 'over $40 puma', expect: ['Brand: Puma', 'Min price: $40'] },
  { cat: 'generic', site: 'generic-usshop', q: 'size 10', expect: ['Size: UK 10'] },
  { cat: 'generic', site: 'generic-usshop', q: 'top rated', expect: ['Sort by: Customer Rating'] },
  { cat: 'generic', site: 'generic-usshop', q: 'black or red', expect: ['Colour: Black', 'Colour: Red'] },
  { cat: 'generic', site: 'generic-usshop', q: 'nike $49.99', expect: ['Brand: Nike', 'Max price: $49.99'] },
  // A weight is not a budget.
  { cat: 'generic', site: 'generic-usshop', q: 'asics 10 pounds', expect: ['Brand: ASICS'] },
  // Small numbers without a currency are still sizes, not prices.
  { cat: 'generic', site: 'generic-usshop', q: '9 to 10', expect: [], reply: 'nomatch' },
  // ===== € shop
  { cat: 'generic', site: 'generic-eushop', q: 'adidas unter €50', expect: ['Marke: Adidas', 'Max price: €50'] },
  { cat: 'generic', site: 'generic-eushop', q: 'nike under 100 euros', expect: ['Marke: Nike', 'Max price: €100'] },
  // ===== From the final review (17 Nov). searched: right after a search for the product.
  // "Men's …" options are not dropped for their "'s"; punctuation is not a leftover filter word.
  { cat: 'generic', site: 'generic-mens', q: "men's running shoes size 9", searched: true, expect: ["Category: Men's Running Shoes", 'Size: 9'] },
  { cat: 'generic', site: 'generic-mens', q: "i'm looking for running shoes.", searched: true, expect: [] },
  { cat: 'generic', site: 'generic-mens', q: 'running shoes size 12', searched: true, expect: [], reply: 'note' },
  // A price list where nothing fits says so, without claiming there is no price filter.
  { cat: 'generic', site: 'generic-allbirds', q: 'wool under $50', expect: ['Material: wool'], reply: 'note' },
  // Amazon takes whole rupees: "₹499.50" is not 49950.
  { cat: 'generic', site: 'amazon', q: 'jacket under ₹499.50', expect: ['Max price: ₹499'] },
  // ===== A page with no filters at all (blog, home page)
  { cat: 'generic', site: 'generic-usshop', page: 'empty', q: 'nike under $100', expect: [], reply: 'note' },
  { cat: 'generic', site: 'generic-usshop', page: 'empty', q: 'what brands are there', reply: 'nolist' },
]
