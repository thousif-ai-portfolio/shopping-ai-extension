// Blind batch for the search step, written from the rules only (implementation not read, nothing run).
//   now: the site the tab shows · current: what that page searched for
//   site: the site to open (null = stay) · search: the exact search text (null = no new search)
export const SEARCH_BLIND = [
  // ===== Another product on the same site
  { q: 'show me red sarees', now: 'Myntra', current: 'kurta', site: null, search: 'red sarees' },
  { q: 'mujhe black jeans chahiye', now: 'Myntra', current: 'shirt men', site: null, search: 'black jeans' },
  { q: 'levis jeans dikhao 2000 tak', now: 'Flipkart', current: 'jacket', site: null, search: 'levis jeans' },
  { q: 'pls show me hp laptop with 16gb ram under 60000', now: 'Amazon', current: 'phone', site: null, search: 'hp laptop 16gb ram' },
  { q: 'i need a ladies watch under ₹2000', now: 'Myntra', current: 'jeans', site: null, search: 'ladies watch' },
  { q: 'show me womens kurta 4 star', now: 'Myntra', current: 'saree', site: null, search: 'womens kurta' },
  { q: 'can u show me sports shoes size 8', now: 'Flipkart', current: 'jacket men', site: null, search: 'sports shoes' },
  { q: 'i want white tshirt for men under 500 rupees', now: 'Amazon', current: 'jeans', site: null, search: 'white tshirt men' },
  { q: 'puma sneakers 50% off please', now: 'Myntra', current: 'kurta', site: null, search: 'puma sneakers' },
  { q: 'redmi phone 6gb ram 12000 ke andar', now: 'Flipkart', current: 'shoes', site: null, search: 'redmi phone 6gb ram' },
  { q: 'hey can you show me a leather wallet', now: 'Amazon', current: 'watch', site: null, search: 'leather wallet' },
  { q: 'mujhe smartwatch chahiye', now: 'Myntra', current: 'shoes', site: null, search: 'smartwatch' },
  { q: 'i need blue formal shirts size 40', now: 'Myntra', current: 'jeans', site: null, search: 'blue formal shirts' },
  { q: 'show me grey hoodie for men', now: 'Amazon', current: 'shoes', site: null, search: 'grey hoodie men' },
  { q: 'i want school bag for my son', now: 'Flipkart', current: 'shoes', site: null, search: 'school bag son' },
  { q: 'Show Me Brown Leather Belt', now: 'Amazon', current: 'jeans men', site: null, search: 'brown leather belt' },
  { q: 'red shirts on myntra', now: 'Myntra', current: 'jeans', site: null, search: 'red shirts' },
  // ===== Same product as the page, or no product: no search
  { q: 'show me more shoes', now: 'Flipkart', current: 'running shoes', site: null, search: null },
  { q: 'jeans under 1000 please', now: 'Myntra', current: 'black jeans', site: null, search: null },
  { q: 'only adidas shoe', now: 'Amazon', current: 'running shoes', site: null, search: null },
  { q: 'kurta chahiye white colour mein', now: 'Myntra', current: 'kurta women', site: null, search: null },
  { q: 'i want the phone with 8gb ram', now: 'Flipkart', current: 'samsung phone', site: null, search: null },
  { q: 'watches under 3000', now: 'Myntra', current: 'watch men', site: null, search: null },
  { q: 'sort by price low to high', now: 'Amazon', current: 'laptop', site: null, search: null },
  { q: '4 star and above only', now: 'Flipkart', current: 'kurta', site: null, search: null },
  { q: 'remove the red ones', now: 'Myntra', current: 'sarees', site: null, search: null },
  // ===== Another site
  { q: 'flipkart pe dikhao', now: 'Amazon', current: 'boat earphones', site: 'Flipkart', search: 'boat earphones' },
  { q: 'can you open myntra and show me white sneakers under 3000', now: 'Amazon', current: 'phone', site: 'Myntra', search: 'white sneakers' },
  { q: 'same thing on amazon pls', now: 'Myntra', current: 'black jeans', site: 'Amazon', search: 'black jeans' },
  { q: 'go to myntra', now: 'Flipkart', current: 'kurta women', site: 'Myntra', search: 'kurta women' },
  { q: 'open flipkrt', now: 'Myntra', current: 'sports shoes', site: 'Flipkart', search: 'sports shoes' },
  { q: 'myntra pe red saree dikhao 2000 tak', now: 'Flipkart', current: 'shirt', site: 'Myntra', search: 'red saree' },
  { q: 'search oneplus phone on amazon', now: 'Flipkart', current: 'shoes', site: 'Amazon', search: 'oneplus phone' },
  { q: 'check this on flipkart', now: 'Amazon', current: 'hp laptop', site: 'Flipkart', search: 'hp laptop' },
  { q: 'take me to amazon', now: 'Myntra', current: 'watch men', site: 'Amazon', search: 'watch men' },
  { q: 'show me jeans on myntra', now: 'Amazon', current: 'jeans', site: 'Myntra', search: 'jeans' },
  { q: 'show me nike shoes on amazon', now: 'Myntra', current: 'puma shoes', site: 'Amazon', search: 'nike shoes' },
  { q: 'Switch to Myntra please', now: 'Amazon', current: 'kurta', site: 'Myntra', search: 'kurta' },
  // ===== Naming the site you are already on
  { q: 'open amazon', now: 'Amazon', current: 'laptop', site: null, search: null },
  { q: 'myntra pe dikhao', now: 'Myntra', current: 'jeans', site: null, search: null },
  // ===== Mentioning a site without asking to go there
  { q: 'is flipkart cheaper than amazon', now: 'Myntra', current: 'shoes', site: null, search: null },
  { q: 'myntra', now: 'Amazon', current: 'jeans', site: null, search: null },
  // ===== Orders, returns, payment
  { q: 'how do i return this on flipkart', now: 'Amazon', current: 'shoes', site: null, search: null },
  { q: 'myntra pe refund kab aayega', now: 'Flipkart', current: 'kurta', site: null, search: null },
  { q: 'can i pay cash on delivery on amazon', now: 'Myntra', current: 'kurta', site: null, search: null },
  { q: 'track my order', now: 'Flipkart', current: 'phone', site: null, search: null },
]
