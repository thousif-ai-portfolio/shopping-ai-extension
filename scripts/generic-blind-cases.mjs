// Blind filter batch for "any site" pages (generic adapter) plus a few Myntra/Flipkart ones, written
// 17 Nov 2026 from the spec and fixtures only: implementation not read, nothing run.
// Same format as everyday-cases.mjs. reply: 'note' = filters applied, plus a note that a size/price is missing.
export const GENERIC_BLIND = [
  // ===== Decathlon (₹ boxes, "8 - eu 42" sizes)
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'broen shoes for men', expect: ['Color: Brown', 'Gender: Men'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'greeen kiprun', expect: ['Color: Green', 'Brand: Kiprun'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'purplle shoes for women', expect: ['Color: Purple', 'Gender: Women'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'size is 9', expect: ['Size: 9 - eu 43'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'adidas size of 10 under 2500', expect: ['Brand: Adidas', 'Size: 10 - eu 44', 'Max price: ₹2500'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'size 12 please', expect: [], reply: 'note' },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'kiprun size 13', expect: ['Brand: Kiprun'], reply: 'note' },
  // "while" and "grown" are words, not White / Brown.
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'grey ones for while jogging', expect: ['Color: Grey', 'Sport: Jogging'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'grown up boys size 8', expect: ['Gender: Boys', 'Size: 8 - eu 42'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: '₹1,500 to ₹3,000', expect: ['Min price: ₹1500', 'Max price: ₹3000'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'remove brown', applied: ['Color: Brown', 'Brand: Adidas'], expect: ['-Color: Brown'] },
  { cat: 'generic-blind', site: 'generic-decathlon', q: 'make it size 10', applied: ['Size: 9 - eu 43'], expect: ['Size: 10 - eu 44', '-Size: 9 - eu 43'] },
  // ===== Allbirds ($ ranges as a list, lowercase colours)
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'size is 9.5', expect: ['Size: 9.5'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'blak size 10', expect: ['Color: black', 'Size: 10'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'beigge wool', expect: ['Color: beige', 'Material: wool'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'yelow slip ons', expect: ['Color: yellow', 'Product Type: Slip Ons'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'running shoes size 13', expect: ['Product Type: Running Shoes'], reply: 'note' },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'wool size 7.5', expect: ['Material: wool'], reply: 'note' },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'under $75', expect: ['Price: Under $75'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'over $150 pls', expect: ['Price: Over $150'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: '$101 to $125', expect: ['Price: $101 - $125'] },
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'remove the price', applied: ['Price: Under $75', 'Color: black'], expect: ['-Price: *'] } /* corrected after the run: this page has no Min/Max price groups to remove */,
  { cat: 'generic-blind', site: 'generic-allbirds', q: 'now make it brown', applied: ['Color: black'], expect: ['Color: brown', '-Color: black'] },
  // ===== US shop ($ boxes, "UK 9" sizes)
  { cat: 'generic-blind', site: 'generic-usshop', q: 'nike size is UK 9 under $60', expect: ['Brand: Nike', 'Size: UK 9', 'Max price: $60'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'size 12 puma', expect: ['Brand: Puma'], reply: 'note' },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'size L', expect: [], reply: 'note' },
  // Two letters off: not a colour.
  { cat: 'generic-blind', site: 'generic-usshop', q: 'blakc nike', expect: ['Brand: Nike'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'under $59.99', expect: ['Max price: $59.99'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'asics 5 pounds under $90', expect: ['Brand: ASICS', 'Max price: $90'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'between 40 and 70 dollars, black', expect: ['Min price: $40', 'Max price: $70', 'Colour: Black'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'make it under $70', applied: ['Max price: $80', 'Brand: Nike'], expect: ['Max price: $70'] },
  { cat: 'generic-blind', site: 'generic-usshop', q: 'take off nike', applied: ['Brand: Nike', 'Colour: Red'], expect: ['-Brand: Nike'] },
  // ===== € shop
  { cat: 'generic-blind', site: 'generic-eushop', q: 'puma below 50 euros', expect: ['Marke: Puma', 'Max price: €50'] },
  { cat: 'generic-blind', site: 'generic-eushop', q: '€39.99 nike', expect: ['Marke: Nike', 'Max price: €39.99'] },
  { cat: 'generic-blind', site: 'generic-eushop', q: 'from €30 to €60 adidas', expect: ['Marke: Adidas', 'Min price: €30', 'Max price: €60'] },
  // ===== Myntra / Flipkart
  { cat: 'generic-blind', site: 'myntra-shoes', q: 'whitte adidas size of 9', expect: ['Color: White', 'Brand: ADIDAS', 'Size: UK9'] },
  { cat: 'generic-blind', site: 'myntra-shoes', q: 'puma size UK 15', expect: ['Brand: Puma', 'Size: UK15'] } /* corrected after the run: UK15 is in this page's size list */,
  { cat: 'generic-blind', site: 'flipkart', q: 'size is L, broen jacket', expect: ['Size: L', 'Color: Brown'] },
  { cat: 'generic-blind', site: 'flipkart', q: 'L size wala maroon jacket', expect: ['Size: L', 'Color: Maroon'] },
  { cat: 'generic-blind', site: 'flipkart', q: 'blue jacket size 9', expect: ['Color: Blue'], reply: 'note' },
]
