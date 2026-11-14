// Blind batch 7: written without looking at the implementation, only at the fixtures
// and the existing cases (to avoid repeating their wordings). Expectations written before any run.
export const BLIND = [
  // ===== Greetings / thanks / help
  { cat: 'blind-7', site: 'flipkart', q: 'Hello ji', reply: 'greet' },
  { cat: 'blind-7', site: 'amazon', q: 'heyyy', reply: 'greet' },
  { cat: 'blind-7', site: 'myntra', q: 'good evening', reply: 'greet' },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'namaskar', reply: 'greet' },
  { cat: 'blind-7', site: 'amazon', q: 'thx', reply: 'thanks' },
  { cat: 'blind-7', site: 'myntra', q: 'dhanyavaad', reply: 'thanks' },
  { cat: 'blind-7', site: 'flipkart', q: 'great, thanks!', reply: 'thanks' },
  { cat: 'blind-7', site: 'amazon', q: 'got it', reply: 'thanks' },
  { cat: 'blind-7', site: 'flipkart', q: 'what can i ask you', reply: 'help' },
  { cat: 'blind-7', site: 'myntra', q: 'kaise use kare', reply: 'help' },

  // ===== Asking for one group's options
  { cat: 'blind-7', site: 'amazon-shoes', q: 'what materials are there', reply: 'list:Materials' },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'kitne ram options hai', reply: 'list:RAM' },
  { cat: 'blind-7', site: 'amazon-phones', q: 'how much storage options do you have', reply: 'list:Storage' },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'discount options?', reply: 'list:Discounts' },
  { cat: 'blind-7', site: 'flipkart', q: 'what types of jackets do you have', reply: 'list:Types' },
  { cat: 'blind-7', site: 'myntra', q: 'colour options pls', reply: 'list:Colours' },
  { cat: 'blind-7', site: 'flipkart', q: 'konsa size available hai', reply: 'list:Sizes' },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'what sizes are there', reply: 'nolist' }, // phones page has no Size group

  // ===== Applied / price questions
  { cat: 'blind-7', site: 'amazon', q: 'which filters are active', reply: 'applied', applied: ['Brands: Nike'] },
  { cat: 'blind-7', site: 'flipkart', q: 'kya filter laga hai', reply: 'applied', applied: ['Color: Black'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'what is the price of these shoes', reply: 'price' },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'how expensive are these phones', reply: 'price' },

  // ===== Off-topic
  { cat: 'blind-7', site: 'flipkart', q: 'my payment failed', reply: 'offtopic' },
  { cat: 'blind-7', site: 'amazon', q: 'how do i login', reply: 'offtopic' },
  { cat: 'blind-7', site: 'flipkart', q: 'i love you', reply: 'offtopic' },
  { cat: 'blind-7', site: 'myntra', q: 'replacement kaise milega', reply: 'offtopic' },
  { cat: 'blind-7', site: 'flipkart', q: 'previous page', reply: 'offtopic' },
  { cat: 'blind-7', site: 'amazon', q: 'gift wrap available?', reply: 'offtopic' },

  // ===== Compare
  { cat: 'blind-7', site: 'amazon-shoes', q: 'nike vs puma which is better', reply: 'compare', expect: ['Brands: Nike', 'Brands: PUMA'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'is this kurta good quality', reply: 'compare', expect: [] },

  // ===== Flipkart jackets: groups not yet exercised
  { cat: 'blind-7', site: 'flipkart', q: 'maroon colour jacket', expect: ['Color: Maroon'] },
  { cat: 'blind-7', site: 'flipkart', q: 'puffer jacket', expect: ['Type: Puffer Jacket'] },
  { cat: 'blind-7', site: 'flipkart', q: 'sleeveless jacket', expect: ['Sleeve: Sleeveless'] },
  { cat: 'blind-7', site: 'flipkart', q: 'pure cotton jacket', expect: ['fabric: Pure Cotton'] },
  { cat: 'blind-7', site: 'flipkart', q: 'reversible jacket', expect: ['Reversible: Yes'] },
  { cat: 'blind-7', site: 'flipkart', q: 'couple jackets', expect: ['Gender: Couple'] },
  { cat: 'blind-7', site: 'flipkart', q: 'pack of 2 jackets', expect: ['Pack of: 2'] },
  { cat: 'blind-7', site: 'flipkart', q: 'checked jacket', expect: ['Pattern: Checkered'] },
  { cat: 'blind-7', site: 'flipkart', q: 'formal jacket', expect: ['Occasion: Formal'] },
  { cat: 'blind-7', site: 'flipkart', q: 'jacket 5000 tak', expect: ['Max price: ₹2000+'] },
  { cat: 'blind-7', site: 'flipkart', q: 'under two thousand', expect: ['Max price: ₹2000'] },
  { cat: 'blind-7', site: 'flipkart', q: 'any colour except blue', expect: [], reply: 'nomatch' },
  { cat: 'blind-7', site: 'flipkart', q: 'jacket for my wife', expect: [], reply: 'nomatch' }, // only Men / Couple

  // ===== Amazon jackets
  { cat: 'blind-7', site: 'amazon', q: 'winter jacket', expect: ['Seasons: Winter'] },
  { cat: 'blind-7', site: 'amazon', q: 'slim fit jacket', expect: ['Fit: Slim'] },
  { cat: 'blind-7', site: 'amazon', q: 'zipper jacket', expect: ['Closure: Zipper'] },
  { cat: 'blind-7', site: 'amazon', q: 'machine washable jacket', expect: ['Care Instructions: Machine Wash'] },
  { cat: 'blind-7', site: 'amazon', q: 'jacket delivered by tomorrow', expect: ['Delivery Day: Get It by Tomorrow'] },
  { cat: 'blind-7', site: 'amazon', q: 'jackets with 70% off', expect: ['Discount: 70% Off or more'] },
  { cat: 'blind-7', site: 'amazon', q: "today's deals", expect: ["Deals & Discounts: Today's Deals"] },
  { cat: 'blind-7', site: 'amazon', q: 'brown leather jacket', expect: ['Colour: Browns', 'Material: Leather'] },
  { cat: 'blind-7', site: 'amazon', q: 'tommy hilfiger jacket', expect: ['Brands: Tommy Hilfiger'] },
  { cat: 'blind-7', site: 'amazon', q: 'north face jacket', expect: ['Brands: THE NORTH FACE'] },
  { cat: 'blind-7', site: 'amazon', q: 'jacket under 2.5k', expect: ['Max price: ₹2500'] },

  // ===== Myntra jackets
  { cat: 'blind-7', site: 'myntra', q: 'nehru jacket', expect: ['Categories: Nehru Jackets'] },
  { cat: 'blind-7', site: 'myntra', q: 'olive jacket', expect: ['Color: Olive'] },
  { cat: 'blind-7', site: 'myntra', q: 'navy blue mast and harbour jacket', expect: ['Color: Navy Blue', 'Brand: Mast & Harbour'] },
  { cat: 'blind-7', site: 'myntra', q: 'levis jacket', expect: ['Brand: Levis'] },
  { cat: 'blind-7', site: 'myntra', q: 'wrogn jacket size xl', expect: ['Brand: WROGN', 'Size: XL'] },
  { cat: 'blind-7', site: 'myntra', q: 'red jacket', expect: [], reply: 'nomatch' }, // no Red on this page

  // ===== Shoes
  { cat: 'blind-7', site: 'myntra-shoes', q: 'nike shoes 9 number', expect: ['Brand: Nike', 'Size: UK9'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'slip on shoes', expect: ['Fastening: Slip-On'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'gym shoes', expect: ['Sport: Training or Gym'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'non marking shoes for badminton', expect: ['Outsole Type: Non-Marking', 'Sport: Badminton'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'skechers walking shoes', expect: ['Brand: Skechers', 'Sport: Walking'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: '4 star rated', expect: ['Rating: 4 & above'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'red chief formal shoes', expect: ['Brand: RED CHIEF'] }, // no Formal occasion on this page
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'football shoes', expect: ['Type of Shoes: Football Shoes'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'canvas shoes under 1000', expect: ['Outer Material: Canvas', 'Max price: ₹500'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'unisex sneakers size 8', expect: ['Gender: Unisex', 'Size: 8'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'sports shoes above 3000', expect: ['Occasion: Sports', 'Min price: ₹3000'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'shoes under 10k', expect: ['Max price: ₹3000+'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'size nine', expect: ['Size: 9'] },
  { cat: 'blind-7', site: 'amazon-shoes', q: 'hiking shoes woodland', expect: ['Purpose: Hiking', 'Brands: Woodland'] },
  { cat: 'blind-7', site: 'amazon-shoes', q: 'lace up shoes', expect: ['Closure Type: Lace-Up'] },
  { cat: 'blind-7', site: 'amazon-shoes', q: 'loafers', expect: ['Shoe Type: Loafer'] },
  { cat: 'blind-7', site: 'amazon-shoes', q: 'shoes size 7.5', expect: ["Men's Shoe Size (UK/India): 7.5"] },
  { cat: 'blind-7', site: 'amazon-shoes', q: 'skechers under 3k', expect: ['Brands: Skechers', 'Max price: ₹3000'] },

  // ===== Phones
  { cat: 'blind-7', site: 'flipkart-phones', q: 'mediatek phone', expect: ['Processor Brand: Mediatek'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'keypad phone', expect: ['Type: Feature Phones'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'nfc phone', expect: ['Features: NFC'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'octa core phone', expect: ['Number of Cores: Octa Core'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'phone 20 se 30 hazar', expect: ['Min price: ₹20000', 'Max price: ₹30000'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'moto phone 4gb ram', expect: ['Brand: MOTOROLA', 'Ram: 4 GB'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'iqoo 5g', expect: ['Brand: IQOO', 'Network Type: 5G'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'phone with 64mp camera', expect: ['Primary Camera: 64 MP & Above'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'selfie camera phone', expect: ['Speciality: Selfie Camera'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'सैमसंग फोन', expect: ['Brand: Samsung'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'phone under 8000', expect: ['Max price: ₹8000'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'oppo or vivo', expect: ['Brands: OPPO', 'Brands: vivo'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'phone with face unlock', expect: ['Security Feature: Face Recognition'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'type c charging phone', expect: ['Connector Type: USB Type C'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'android 14 phone', expect: ['Operating System: Android 14'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'gold colour iphone', expect: ['Colour: Gold', 'Brands: Apple'] },
  { cat: 'blind-7', site: 'amazon-phones', q: '6000mah phone', expect: ['Battery Capacity: 6,000 mAh & Above'] },
  { cat: 'blind-7', site: 'amazon-phones', q: '512gb storage', expect: ['Storage Capacity: 512 GB & above'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'recommend a phone for photography', expect: ['Purpose: Photography', 'Sort by: Customer Rating'] },

  // ===== Kurtas
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'georgette kurta', expect: ['Fabrics: Georgette'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'v neck kurta', expect: ['Neck: V-Neck'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'libas kurta in pink', expect: ['Brand: Libas', 'Color: Pink'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'navratri kurta', expect: ['Theme: Navratri'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'festive kurta', expect: ['Occasions: Festive'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'kurta with 3/4 sleeves', expect: ['Sleeve Length: Three-Quarter Sleeves'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'ankle length kurta', expect: ['Length: Ankle Length'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'biba kurta 50% off', expect: ['Brand: Biba', 'Discount Range: 50% and above'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'FabIndia kurta', expect: ['Brand: Fabindia'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'kurta size 2xl', expect: ['Size: XXL'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'पीला कुर्ता', expect: ['Color: Yellow'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'kurta under 1000', expect: [], reply: 'nomatch' }, // no price filter on this page

  // ===== Sorting
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'latest kurtas', expect: ['Sort by: Newest First'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'mehenga wala pehle', expect: ['Sort by: Price: High to Low'] },
  { cat: 'blind-7', site: 'flipkart-shoes', q: 'top rated shoes', expect: ['Customer Ratings: 4★ & above', 'Sort by: Popularity'] },
  { cat: 'blind-7', site: 'myntra', q: 'trending jackets', expect: ['Sort by: Popularity'] },

  // ===== Follow-ups
  { cat: 'blind-7', site: 'amazon', q: 'change it to white', applied: ['Colour: Black'], expect: ['Colour: White', '-Colour: Black'] },
  { cat: 'blind-7', site: 'myntra-shoes', q: 'size 10 instead', applied: ['Size: UK9'], expect: ['Size: UK10', '-Size: UK9'] },
  { cat: 'blind-7', site: 'flipkart-phones', q: 'make it 8gb', applied: ['Ram: 6 GB'], expect: ['Ram: 8 GB and Above', '-Ram: 6 GB'] },
  { cat: 'blind-7', site: 'amazon-phones', q: 'actually 12 gb ram', applied: ['RAM Size: 8 to 9.9 GB'], expect: ['RAM Size: 10 GB & Above', '-RAM Size: 8 to 9.9 GB'] },
  { cat: 'blind-7', site: 'flipkart', q: 'not black, navy', applied: ['Color: Black'], expect: ['Color: Navy Blue', '-Color: Black'] },
  { cat: 'blind-7', site: 'flipkart', q: 'make it 1000', applied: ['Max price: ₹2000'], expect: ['Max price: ₹1000'] },
  { cat: 'blind-7', site: 'flipkart', q: 'also 2XL', applied: ['Size: XL'], expect: ['Size: 2XL'] },
  { cat: 'blind-7', site: 'flipkart', q: 'min 1000', applied: ['Max price: ₹2000'], expect: ['Min price: ₹1000'] },
  { cat: 'blind-7', site: 'flipkart', q: 'remove the brand', applied: ['Brand: PUMA', 'Brand: NIKE', 'Color: Black'], expect: ['-Brand: *'] },
  { cat: 'blind-7', site: 'myntra-kurtas', q: 'discount hatao', applied: ['Discount Range: 40% and above'], expect: ['-Discount Range: *'] },
  { cat: 'blind-7', site: 'flipkart', q: 'saare filters hata do', applied: ['Brand: PUMA', 'Size: M'], expect: ['-*: *'] },

  // ===== Odd input
  { cat: 'blind-7', site: 'flipkart', q: '?', reply: 'empty' },
  { cat: 'blind-7', site: 'flipkart', q: 'PUMA puma Puma', expect: ['Brand: PUMA'] },
]
