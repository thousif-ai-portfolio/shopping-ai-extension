// Edge-case test sentences. Each lists the EXACT filters it should produce on that site's
// saved filter list (scripts/fixtures/*.json). Missing or extra filters = fail.
// expect: [ 'Group: Option', ... ]   (empty = nothing should be applied)

export const CASES = [
  // --- Basics
  { cat: 'basic', site: 'flipkart', q: 'black puma jacket under 2000', expect: ['Color: Black', 'Brand: PUMA', 'Max price: ₹2000'] },
  { cat: 'basic', site: 'amazon', q: 'black puma jacket size M', expect: ['Colour: Black', 'Brands: PUMA', "Men's General Size: M"] },
  { cat: 'basic', site: 'myntra', q: 'black roadster jacket 40% off', expect: ['Color: Black', 'Brand: Roadster', 'Discount Range: 40% and above'] },
  { cat: 'basic', site: 'amazon', q: 'NIKE JACKET', expect: ['Brands: Nike'] },
  { cat: 'basic', site: 'flipkart', q: 'blue jacket XL', expect: ['Color: Blue', 'Size: XL'] },

  // --- Multi-word and partial brand names
  { cat: 'brand', site: 'amazon', q: 'red tape leather jacket', expect: ['Brands: Red Tape', 'Material: Leather'] },
  { cat: 'brand', site: 'amazon', q: 'u.s. polo jacket', expect: ['Brands: U.S. POLO ASSN.'] },
  { cat: 'brand', site: 'flipkart', q: 'us polo assn jacket', expect: ['Brand: U.S. POLO ASSN.'] },
  { cat: 'brand', site: 'amazon', q: 'levis jacket', expect: ["Brands: Levi's"] },
  { cat: 'brand', site: 'myntra', q: 'hrx jacket', expect: ['Brand: HRX by Hrithik Roshan'] },
  { cat: 'brand', site: 'myntra', q: 'mast and harbour jacket', expect: ['Brand: Mast & Harbour'] },
  { cat: 'brand', site: 'amazon', q: 'jack and jones jacket', expect: ['Brands: JACK & JONES'] },
  { cat: 'brand', site: 'amazon', q: 'north face jacket', expect: ['Brands: THE NORTH FACE'] },

  // --- Colours: multi-word, synonyms, spelling
  { cat: 'colour', site: 'myntra', q: 'navy blue jacket', expect: ['Color: Navy Blue'] },
  { cat: 'colour', site: 'amazon', q: 'grey jacket', expect: ['Colour: Greys'] },
  { cat: 'colour', site: 'flipkart', q: 'gray jacket', expect: ['Color: Grey'] },
  { cat: 'colour', site: 'amazon', q: 'maroon jacket', expect: ['Colour: Reds'] },
  { cat: 'colour', site: 'myntra', q: 'olive green jacket', expect: ['Color: Olive'] },
  { cat: 'colour', site: 'flipkart', q: 'multi colour jacket', expect: ['Color: Multicolor'] },
  { cat: 'colour', site: 'amazon', q: 'white jacket', expect: ['Colour: White'] },

  // --- Gender
  { cat: 'gender', site: 'flipkart', q: "men's black jacket", expect: ['Gender: Men', 'Color: Black'] },
  { cat: 'gender', site: 'amazon', q: 'unisex jacket', expect: ['Gender: Unisex'] },

  // --- Sizes
  { cat: 'size', site: 'flipkart', q: 'medium size jacket', expect: ['Size: M'] },
  { cat: 'size', site: 'myntra', q: 'large jacket', expect: ['Size: L'] },
  { cat: 'size', site: 'amazon', q: 'xxl jacket', expect: ["Men's General Size: 2XL"] },
  { cat: 'size', site: 'myntra', q: 'jacket size 40', expect: ['Size: 40'] },
  { cat: 'size', site: 'flipkart', q: 'small black jacket', expect: ['Size: S', 'Color: Black'] },

  // --- Price
  { cat: 'price', site: 'flipkart', q: 'jacket under 1500', expect: ['Max price: ₹1500'] },
  { cat: 'price', site: 'flipkart', q: 'jacket between 700 and 1500', expect: ['Min price: ₹700', 'Max price: ₹1500'] },
  { cat: 'price', site: 'flipkart', q: 'jacket above 1000', expect: ['Min price: ₹1000'] },
  { cat: 'price', site: 'flipkart', q: 'jacket under 2k', expect: ['Max price: ₹2000'] },
  { cat: 'price', site: 'flipkart', q: 'jacket less than ₹1,000', expect: ['Max price: ₹1000'] },
  { cat: 'price', site: 'amazon', q: 'jacket under 2000', expect: ['Max price: ₹2000'] },
  { cat: 'price', site: 'myntra', q: 'jacket under 1500', expect: [] }, // Myntra shows no price filter here

  // --- Discount and rating
  { cat: 'discount', site: 'amazon', q: 'jacket with 50% off', expect: ['Discount: 50% Off or more'] },
  { cat: 'discount', site: 'flipkart', q: 'at least 45% discount', expect: ['Discount: 40% or more'] },
  { cat: 'rating', site: 'flipkart', q: '4 star and above jacket', expect: ['Customer Ratings: 4★ & above'] },
  { cat: 'rating', site: 'amazon', q: 'jacket rated 4 stars', expect: ['Customer Reviews: 4 Stars & Up'] },

  // --- Negation
  { cat: 'negation', site: 'flipkart', q: 'jacket without hood', expect: ['Hooded: Without Hood'] },
  { cat: 'negation', site: 'amazon', q: 'jacket not black', expect: [] },
  { cat: 'negation', site: 'myntra', q: 'any colour except black', expect: [] },
  { cat: 'negation', site: 'flipkart', q: 'no puma, black jacket', expect: ['Color: Black'] },

  // --- Several values in one group
  { cat: 'multi', site: 'flipkart', q: 'black or grey jacket', expect: ['Color: Black', 'Color: Grey'] },
  { cat: 'multi', site: 'amazon', q: 'nike or adidas jacket', expect: ['Brands: Nike', 'Brands: adidas'] },

  // --- Style, material, features
  { cat: 'style', site: 'flipkart', q: 'bomber jacket', expect: ['Type: Bomber Jacket'] },
  { cat: 'style', site: 'flipkart', q: 'hooded jacket', expect: ['Hooded: With Hood'] },
  { cat: 'style', site: 'amazon', q: 'slim fit jacket', expect: ['Fit: Slim'] },
  { cat: 'style', site: 'amazon', q: 'wool jacket', expect: ['Material: Wool'] },
  { cat: 'style', site: 'amazon', q: 'jacket with zipper', expect: ['Closure: Zipper'] },
  { cat: 'style', site: 'flipkart', q: 'puffer jacket for party', expect: ['Type: Puffer Jacket', 'Occasion: Party'] },
  { cat: 'style', site: 'amazon', q: 'winter jacket for hiking', expect: ['Seasons: Winter', 'Purpose: Hiking'] },

  // --- Typos, junk, other languages
  { cat: 'typo', site: 'flipkart', q: 'pumma jacket', expect: ['Brand: PUMA'] },
  { cat: 'typo', site: 'amazon', q: 'adiddas jacket', expect: ['Brands: adidas'] },
  { cat: 'typo', site: 'myntra', q: 'blak jaket', expect: ['Color: Black'] },
  { cat: 'junk', site: 'myntra', q: 'hello', expect: [] },
  { cat: 'junk', site: 'flipkart', q: 'show me something nice', expect: [] },
  { cat: 'hinglish', site: 'myntra', q: 'kala jacket', expect: ['Color: Black'] },

  // --- Held out: written after the fixes, never tuned against
  { cat: 'held-out', site: 'amazon', q: 'red jacket', expect: ['Colour: Reds'] },
  { cat: 'held-out', site: 'amazon', q: 'get me a nice jacket', expect: [] },
  { cat: 'held-out', site: 'flipkart', q: 'casual jacket', expect: ['Type: Casual Jacket'] },
  { cat: 'held-out', site: 'flipkart', q: 'leather jacket in brown', expect: ['Type: Leather Jacket', 'Color: Brown'] },
  { cat: 'held-out', site: 'myntra', q: 'blue jacket by roadster size L', expect: ['Color: Blue', 'Brand: Roadster', 'Size: L'] },
  { cat: 'held-out', site: 'amazon', q: 'tommy jacket', expect: ['Brands: Tommy Hilfiger'] },
  { cat: 'held-out', site: 'flipkart', q: 'black jacket, no hood', expect: ['Color: Black', 'Hooded: Without Hood'] },
  { cat: 'held-out', site: 'amazon', q: 'polyester jacket under 1000 with 4 star', expect: ['Material: Polyester', 'Max price: ₹1000', 'Customer Reviews: 4 Stars & Up'] },
  { cat: 'held-out', site: 'myntra', q: 'green or olive jacket xl', expect: ['Color: Green', 'Color: Olive', 'Size: XL'] },
  { cat: 'held-out', site: 'amazon', q: 'jacket for men', expect: ['Gender: Men'] },

  // ===== Other categories (written before running them) =====
  // --- Shoes: Amazon
  { cat: 'shoes', site: 'amazon-shoes', q: 'nike running shoes size 9', expect: ['Brands: Nike', 'Purpose: Running', "Men's Shoe Size (UK/India): 9"] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'white sneakers under 2000', expect: ['Colour: White', 'Max price: ₹2000'] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'skechers walking shoes uk 8', expect: ['Brands: Skechers', 'Purpose: Walking', "Men's Shoe Size (UK/India): 8"] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'lightweight breathable mesh shoes', expect: ['Special Features: Lightweight', 'Special Features: Breathable', 'Material: Mesh'] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'new balance shoes size 9.5', expect: ['Brands: new balance', "Men's Shoe Size (UK/India): 9.5"] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'waterproof hiking shoes', expect: ['Special Features: Waterproof', 'Purpose: Hiking'] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'lace up shoes', expect: ['Closure Type: Lace-Up'] },
  { cat: 'shoes', site: 'amazon-shoes', q: 'puma shoes with 50% off', expect: ['Brands: PUMA', 'Discount: 50% Off or more'] },
  // --- Shoes: Flipkart
  { cat: 'shoes', site: 'flipkart-shoes', q: 'asics running shoes under 3000', expect: ['Brand: Asics', 'Type of Shoes: Running Shoes', 'Max price: ₹3000'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: 'black campus shoes size 8', expect: ['Color: Black', 'Brand: CAMPUS', 'Size: 8'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: 'sparx shoes for men', expect: ['Brand: Sparx', 'Gender: Men'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: 'canvas shoes', expect: ['Outer Material: Canvas'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: 'red tape shoes between 1500 and 3000', expect: ['Brand: RED TAPE', 'Min price: ₹1500', 'Max price: ₹3000'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: 'shoes for boys', expect: ['Gender: Boys'] },
  { cat: 'shoes', site: 'flipkart-shoes', q: '4 star rated mesh shoes', expect: ['Customer Ratings: 4★ & above', 'Outer Material: Mesh'] },
  // --- Shoes: Myntra
  { cat: 'shoes', site: 'myntra-shoes', q: 'puma running shoes size 9', expect: ['Brand: Puma', 'Sport: Running', 'Size: UK9'] },
  { cat: 'shoes', site: 'myntra-shoes', q: 'adidas slip on shoes', expect: ['Brand: ADIDAS', 'Fastening: Slip-On'] },
  { cat: 'shoes', site: 'myntra-shoes', q: 'nike shoes 40% off', expect: ['Brand: Nike', 'Discount Range: 40% and above'] },
  { cat: 'shoes', site: 'myntra-shoes', q: 'navy blue sports shoes', expect: ['Color: Navy Blue'] },
  { cat: 'shoes', site: 'myntra-shoes', q: 'leather shoes with high cushioning', expect: ['Materials: Leather', 'Cushioning: High'] },
  { cat: 'shoes', site: 'myntra-shoes', q: 'skechers shoes uk 10', expect: ['Brand: Skechers', 'Size: UK10'] },

  // --- Phones: Amazon
  { cat: 'phones', site: 'amazon-phones', q: 'samsung phone with 8gb ram and 128gb storage', expect: ['Brands: Samsung', 'RAM Size: 8 to 9.9 GB', 'Storage Capacity: 128 GB'] },
  { cat: 'phones', site: 'amazon-phones', q: '5g phone under 15000', expect: ['Cellular Technology: 5G', 'Max price: ₹15000'] },
  { cat: 'phones', site: 'amazon-phones', q: 'phone with 6000 mah battery', expect: ['Battery Capacity: 6,000 mAh & Above'] },
  { cat: 'phones', site: 'amazon-phones', q: 'amoled display phone with 120hz', expect: ['Display Type: AMOLED', 'Display Refresh Rate in Hertz: 120'] },
  { cat: 'phones', site: 'amazon-phones', q: 'oneplus phone', expect: ['Brands: OnePlus'] },
  { cat: 'phones', site: 'amazon-phones', q: 'iphone', expect: ['Brands: Apple'] },
  { cat: 'phones', site: 'amazon-phones', q: 'dual sim phone with nfc', expect: ['SIM Card Slot Count: Dual SIM', 'Connectivity: NFC'] },
  { cat: 'phones', site: 'amazon-phones', q: 'realme phone 4 star', expect: ['Brands: realme', 'Customer Reviews: 4 Stars & Up'] },
  // --- Phones: Flipkart
  { cat: 'phones', site: 'flipkart-phones', q: 'vivo 5g phone 8gb ram', expect: ['Brand: vivo', 'Network Type: 5G', 'Ram: 8 GB and Above'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'samsung phone 256gb', expect: ['Brand: Samsung', 'Internal Storage: 256 GB & Above'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'phone with 5000mah battery under 20000', expect: ['Battery Capacity: 5000 - 5999 mAh', 'Max price: ₹20000'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'android phone with octa core processor', expect: ['Operating System: Android', 'Number of Cores: Octa Core'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'redmi phone between 10000 and 15000', expect: ['Brand: REDMI', 'Min price: ₹10000', 'Max price: ₹15000'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'phone with 64mp camera and 16mp selfie camera', expect: ['Primary Camera: 64 MP & Above', 'Secondary Camera: 16 - 20.9 MP', 'Speciality: Selfie Camera'] }, // "selfie camera" is also a Speciality option
  { cat: 'phones', site: 'flipkart-phones', q: '6.5 inch screen phone', expect: ['Screen Size: 6.4 inch & Above'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'motorola phone not samsung', expect: ['Brand: MOTOROLA'] },
  { cat: 'phones', site: 'flipkart-phones', q: 'oneplus 5g', expect: ['Brand: OnePlus', 'Network Type: 5G'] },

  // --- Kurtas: Myntra
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'pink cotton kurta size M', expect: ['Color: Pink', 'Fabrics: Cotton', 'Size: M'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'anarkali kurta for diwali', expect: ['Shape: Anarkali', 'Theme: Diwali'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'chikankari kurta', expect: ['Ornamentation: Chikankari'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: '3/4 sleeve kurta', expect: ['Sleeve Length: Three-Quarter Sleeves'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'kurta with mirror work', expect: ['Ornamentation: Mirror Work'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'libas kurta', expect: ['Brand: Libas'] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'stylish kurta for college', expect: [] },
  { cat: 'kurtas', site: 'myntra-kurtas', q: 'biba kurta 50% off', expect: ['Brand: Biba', 'Discount Range: 50% and above'] },

  // --- Everyday words that must NOT trigger brands (found by the collision check)
  { cat: 'no-false-match', site: 'flipkart', q: 'good quality jacket under 2000', expect: ['Max price: ₹2000'] },
  { cat: 'no-false-match', site: 'flipkart-phones', q: 'latest phone with long battery life', expect: ['Sort by: Newest First', 'Speciality: Long-Lasting Battery'] }, // "latest" = newest first; "long battery life" is the page's own option (understood since Nov 12)
  { cat: 'no-false-match', site: 'myntra-kurtas', q: 'simple plain kurta for office', expect: [] },
  { cat: 'no-false-match', site: 'myntra-shoes', q: 'light weight sports shoes', expect: [] },

  // --- Held out, batch 2: written after all fixes, never tuned against
  { cat: 'held-out-2', site: 'amazon-shoes', q: 'grey asics shoes for running size 10', expect: ['Colour: Grey', 'Brands: ASICS', 'Purpose: Running', "Men's Shoe Size (UK/India): 10"] },
  { cat: 'held-out-2', site: 'amazon-shoes', q: 'formal leather shoes under 3000', expect: ['Lifestyle: Formal', 'Material: Leather', 'Max price: ₹3000'] },
  { cat: 'held-out-2', site: 'flipkart-shoes', q: 'adidas shoes 4 star above 1500', expect: ['Brand: ADIDAS', 'Customer Ratings: 4★ & above', 'Min price: ₹1500'] },
  { cat: 'held-out-2', site: 'flipkart-shoes', q: 'blue or black shoes not puma', expect: ['Color: Blue', 'Color: Black'] },
  { cat: 'held-out-2', site: 'myntra-shoes', q: 'reebok shoes in white size 8', expect: ['Brand: Reebok', 'Color: White', 'Size: UK8'] },
  { cat: 'held-out-2', site: 'myntra-shoes', q: 'velcro shoes 50% off', expect: ['Fastening: Velcro', 'Discount Range: 50% and above'] },
  { cat: 'held-out-2', site: 'amazon-phones', q: 'apple phone with face recognition', expect: ['Brands: Apple', 'Security Feature: Face Recognition'] },
  { cat: 'held-out-2', site: 'amazon-phones', q: 'blue samsung 5g phone 256gb', expect: ['Colour: Blue', 'Brands: Samsung', 'Cellular Technology: 5G', 'Storage Capacity: 256 GB'] },
  { cat: 'held-out-2', site: 'amazon-phones', q: 'motorola phone 6gb ram', expect: ['Brands: Motorola', 'RAM Size: 6 to 7.9 GB'] },
  { cat: 'held-out-2', site: 'flipkart-phones', q: 'poco phone with 6gb ram under 15000', expect: ['Brand: POCO', 'Ram: 6 GB', 'Max price: ₹15000'] },
  { cat: 'held-out-2', site: 'flipkart-phones', q: 'feature phone with dual sim', expect: ['Type: Feature Phones', 'Sim Type: Dual Sim'] },
  { cat: 'held-out-2', site: 'flipkart-phones', q: 'iphone 128gb', expect: ['Brand: Apple', 'Internal Storage: 128 - 255.9 GB'] },
  { cat: 'held-out-2', site: 'myntra-kurtas', q: 'yellow kurta for haldi', expect: ['Color: Yellow', 'Theme: Haldi'] },
  { cat: 'held-out-2', site: 'myntra-kurtas', q: 'block print cotton kurta size xl', expect: ['Fashion Trends: Block Print', 'Fabrics: Cotton', 'Size: XL'] },
  { cat: 'held-out-2', site: 'myntra-kurtas', q: 'sleeveless kurta with round neck', expect: ['Sleeve Length: Sleeveless', 'Neck: Round Neck'] },
]
