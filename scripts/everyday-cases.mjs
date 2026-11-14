// Everyday messages from ordinary shoppers: questions, small talk, follow-ups, odd input.
// Written before running them. Each case says exactly what must happen:
//   expect: the exact filters applied ('-Group: Option' = removed), [] = none
//   reply:  the kind of answer shown instead of filters (see kindOf in scripts/everyday.mjs)
//   applied: what this chat had already applied on the page (for follow-ups)

export const EVERYDAY = [
  // ===== Greetings and small talk → a friendly hint, no filters
  { cat: 'greeting', site: 'flipkart', q: 'hi', reply: 'greet' },
  { cat: 'greeting', site: 'amazon', q: 'Hello!', reply: 'greet' },
  { cat: 'greeting', site: 'myntra', q: 'hey there', reply: 'greet' },
  { cat: 'greeting', site: 'flipkart', q: 'hiii', reply: 'greet' },
  { cat: 'greeting', site: 'amazon', q: 'good morning', reply: 'greet' },
  { cat: 'greeting', site: 'myntra', q: 'namaste ji', reply: 'greet' },
  { cat: 'greeting', site: 'flipkart', q: 'hello bro', reply: 'greet' },
  { cat: 'greeting', site: 'amazon', q: 'how are you?', reply: 'offtopic' },
  { cat: 'greeting', site: 'flipkart', q: 'who are you', reply: 'help' },
  { cat: 'greeting', site: 'myntra', q: 'are you a bot?', reply: 'offtopic' },
  { cat: 'greeting', site: 'amazon', q: 'tell me a joke', reply: 'offtopic' },
  { cat: 'greeting', site: 'flipkart', q: 'hi, black puma jacket please', expect: ['Color: Black', 'Brand: PUMA'] },

  // ===== Thanks / closing → no filters
  { cat: 'thanks', site: 'flipkart', q: 'thanks', reply: 'thanks' },
  { cat: 'thanks', site: 'amazon', q: 'thank you so much', reply: 'thanks' },
  { cat: 'thanks', site: 'myntra', q: 'ok', reply: 'thanks' },
  { cat: 'thanks', site: 'flipkart', q: 'okay cool', reply: 'thanks' },
  { cat: 'thanks', site: 'amazon', q: 'perfect 👍', reply: 'thanks' },
  { cat: 'thanks', site: 'myntra', q: 'bye', reply: 'thanks' },
  { cat: 'thanks', site: 'flipkart', q: 'shukriya', reply: 'thanks' },
  { cat: 'thanks', site: 'amazon', q: 'nice, it works', reply: 'thanks' },
  { cat: 'thanks', site: 'flipkart', q: 'no', reply: 'thanks' },
  { cat: 'thanks', site: 'flipkart', q: 'yes', reply: 'thanks' },

  // ===== Help
  { cat: 'help', site: 'flipkart', q: 'help', reply: 'help' },
  { cat: 'help', site: 'amazon', q: 'what can you do?', reply: 'help' },
  { cat: 'help', site: 'myntra', q: 'how do I use this', reply: 'help' },
  { cat: 'help', site: 'flipkart', q: 'how does this work', reply: 'help' },
  { cat: 'help', site: 'amazon', q: 'what should i type', reply: 'help' },
  { cat: 'help', site: 'myntra', q: 'what is this', reply: 'help' },

  // ===== "What's available?" → list the page's own options
  { cat: 'list', site: 'flipkart', q: 'what brands are there?', reply: 'list:Brands' },
  { cat: 'list', site: 'amazon', q: 'which brands do you have', reply: 'list:Brands' },
  { cat: 'list', site: 'myntra', q: 'show me all brands', reply: 'list:Brands' },
  { cat: 'list', site: 'flipkart', q: 'what colours are available', reply: 'list:Colours' },
  { cat: 'list', site: 'amazon', q: 'which colors', reply: 'list:Colours' },
  { cat: 'list', site: 'myntra', q: 'what sizes do you have', reply: 'list:Sizes' },
  { cat: 'list', site: 'flipkart-shoes', q: 'available sizes?', reply: 'list:Sizes' },
  { cat: 'list', site: 'myntra-kurtas', q: 'which fabrics are there', reply: 'list:Materials' },
  { cat: 'list', site: 'amazon-phones', q: 'what ram options are there', reply: 'list:RAM' },
  { cat: 'list', site: 'flipkart-phones', q: 'storage options?', reply: 'list:Storage' },
  { cat: 'list', site: 'flipkart', q: 'what filters are there', reply: 'filters' },
  { cat: 'list', site: 'amazon', q: 'which filters can i use', reply: 'filters' },
  { cat: 'list', site: 'myntra', q: 'konse brand hai', reply: 'list:Brands' },
  { cat: 'list', site: 'flipkart', q: 'what is the price range', reply: 'price' },
  { cat: 'list', site: 'amazon', q: 'how much do these cost', reply: 'price' },
  { cat: 'list', site: 'myntra', q: 'what material is it made of', reply: 'nolist' }, // Myntra jackets page has no material filter
  // Naming an option is a filter request, not a question
  { cat: 'list', site: 'flipkart', q: 'show me size M', expect: ['Size: M'] },
  { cat: 'list', site: 'flipkart', q: 'do you have puma brand?', expect: ['Brand: PUMA'] },
  { cat: 'list', site: 'flipkart', q: 'which brand jackets are under 2000', expect: ['Max price: ₹2000'] },
  { cat: 'list', site: 'amazon', q: 'is black colour available', expect: ['Colour: Black'] },

  // ===== "What did you apply?"
  { cat: 'applied', site: 'flipkart', q: 'what filters did you apply?', reply: 'applied', applied: ['Color: Black', 'Brand: PUMA'] },
  { cat: 'applied', site: 'amazon', q: 'what did you apply', reply: 'applied', applied: [] },
  { cat: 'applied', site: 'myntra', q: 'current filters', reply: 'applied', applied: ['Brand: Roadster'] },
  { cat: 'applied', site: 'flipkart', q: 'show applied filters', reply: 'applied', applied: ['Size: L'] },

  // ===== Questions the extension can't answer → polite "check the site's Help page"
  { cat: 'off-topic', site: 'flipkart', q: 'what is the return policy?', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: 'can I return this if it doesnt fit', reply: 'offtopic' },
  { cat: 'off-topic', site: 'myntra', q: 'how do i get a refund', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart', q: 'where is my order', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: 'track my order', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: 'cancel my order', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart', q: 'when will it be delivered', reply: 'offtopic' },
  { cat: 'off-topic', site: 'myntra', q: 'how many days for delivery', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart-phones', q: 'does this phone have warranty', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon-phones', q: 'is no cost emi available', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart', q: 'customer care number', reply: 'offtopic' },
  { cat: 'off-topic', site: 'myntra', q: 'any coupon code?', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: 'change my address', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart', q: 'add it to cart', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: 'buy this for me', reply: 'offtopic' },
  { cat: 'off-topic', site: 'myntra', q: 'exchange policy kya hai', reply: 'offtopic' },
  { cat: 'off-topic', site: 'flipkart', q: 'kab aayega mera order', reply: 'offtopic' },
  { cat: 'off-topic', site: 'amazon', q: "what's the weather today", reply: 'offtopic' },

  // ===== "Best" / recommendations → best rated first (popularity where there's no rating order)
  { cat: 'best', site: 'amazon-phones', q: 'which phone is the best', expect: ['Sort by: Customer Rating'] },
  { cat: 'best', site: 'flipkart-phones', q: 'best phone under 20000', expect: ['Max price: ₹20000', 'Sort by: Popularity'] },
  { cat: 'best', site: 'myntra-shoes', q: 'recommend good running shoes', expect: ['Sport: Running', 'Sort by: Customer Rating'] },
  { cat: 'best', site: 'amazon', q: 'best nike jacket', expect: ['Brands: Nike', 'Sort by: Customer Rating'] },
  { cat: 'best', site: 'myntra-kurtas', q: 'sabse accha kurta', expect: ['Sort by: Customer Rating'] },
  { cat: 'best', site: 'flipkart', q: 'best price jacket', expect: [] , reply: 'nomatch' },
  { cat: 'best', site: 'amazon', q: 'best selling jackets', expect: ['Sort by: Popularity'] },
  { cat: 'best', site: 'amazon', q: 'top rated jackets', expect: ['Customer Reviews: 4 Stars & Up', 'Sort by: Customer Rating'] },

  // ===== Comparisons / reviews → explain, apply nothing
  { cat: 'compare', site: 'flipkart-phones', q: 'compare iphone and samsung', reply: 'compare', expect: ['Brand: Apple', 'Brand: Samsung'] },
  { cat: 'compare', site: 'amazon-phones', q: 'is oneplus better than samsung?', reply: 'compare', expect: ['Brands: OnePlus', 'Brands: Samsung'] },
  { cat: 'compare', site: 'flipkart', q: 'is this jacket good?', reply: 'compare', expect: [] },
  { cat: 'compare', site: 'myntra-shoes', q: 'should i buy these shoes', reply: 'compare', expect: [] },
  { cat: 'compare', site: 'amazon-phones', q: 'what are the specs', reply: 'compare', expect: [] },

  // ===== Filter requests phrased as questions
  { cat: 'question-filter', site: 'flipkart', q: 'do you have black puma jackets?', expect: ['Color: Black', 'Brand: PUMA'] },
  { cat: 'question-filter', site: 'amazon-shoes', q: 'can i get nike shoes in size 9?', expect: ['Brands: Nike', "Men's Shoe Size (UK/India): 9"] },
  { cat: 'question-filter', site: 'myntra-kurtas', q: 'is there any red kurta', expect: ['Color: Red'] },
  { cat: 'question-filter', site: 'flipkart-phones', q: 'any samsung phone under 15k?', expect: ['Brand: Samsung', 'Max price: ₹15000'] },
  { cat: 'question-filter', site: 'amazon', q: 'got any jackets under 1000 for men', expect: ['Max price: ₹1000', 'Gender: Men'] },
  { cat: 'question-filter', site: 'flipkart-shoes', q: 'where are the white sneakers', expect: ['Color: White'] },
  { cat: 'question-filter', site: 'myntra-shoes', q: 'could you show adidas shoes size 10 please', expect: ['Brand: ADIDAS', 'Size: UK10'] },

  // ===== Follow-ups that change an earlier choice (replace, not add)
  { cat: 'replace', site: 'flipkart', q: 'make it L', applied: ['Size: M'], expect: ['Size: L', '-Size: M'] },
  { cat: 'replace', site: 'flipkart', q: 'change size to XL', applied: ['Size: M', 'Color: Black'], expect: ['Size: XL', '-Size: M'] },
  { cat: 'replace', site: 'flipkart', q: 'show nike instead of puma', applied: ['Brand: PUMA'], expect: ['Brand: NIKE', '-Brand: PUMA'] },
  { cat: 'replace', site: 'flipkart', q: 'instead of puma, adidas', applied: ['Brand: PUMA'], expect: ['Brand: ADIDAS', '-Brand: PUMA'] },
  { cat: 'replace', site: 'amazon', q: 'replace nike with adidas', applied: ['Brands: Nike'], expect: ['Brands: adidas', '-Brands: Nike'] },
  { cat: 'replace', site: 'flipkart', q: 'change black to blue', applied: ['Color: Black'], expect: ['Color: Blue', '-Color: Black'] },
  { cat: 'replace', site: 'amazon', q: 'only adidas', applied: ['Brands: Nike', 'Brands: PUMA'], expect: ['Brands: adidas', '-Brands: Nike', '-Brands: PUMA'] },
  { cat: 'replace', site: 'myntra', q: 'just roadster', applied: ['Brand: HRX by Hrithik Roshan'], expect: ['Brand: Roadster', '-Brand: HRX by Hrithik Roshan'] },
  { cat: 'replace', site: 'flipkart', q: 'switch to grey', applied: ['Color: Black'], expect: ['Color: Grey', '-Color: Black'] },
  { cat: 'replace', site: 'flipkart', q: 'rather than puma show nike', applied: ['Brand: PUMA'], expect: ['Brand: NIKE', '-Brand: PUMA'] },
  { cat: 'replace', site: 'flipkart', q: 'make it under 1500', applied: ['Max price: ₹2000'], expect: ['Max price: ₹1500'] },
  { cat: 'replace', site: 'flipkart', q: 'M', applied: ['Size: L'], expect: ['Size: M'] },
  { cat: 'replace', site: 'myntra', q: 'change to M please', applied: ['Size: L'], expect: ['Size: M', '-Size: L'] },
  // Adding, not replacing
  { cat: 'replace', site: 'flipkart', q: 'also in grey', applied: ['Color: Black'], expect: ['Color: Grey'] },
  { cat: 'replace', site: 'flipkart', q: 'and adidas too', applied: ['Brand: PUMA'], expect: ['Brand: ADIDAS'] },
  { cat: 'replace', site: 'flipkart', q: 'size L', applied: ['Size: M'], expect: ['Size: L'] },

  // ===== Removing
  { cat: 'remove', site: 'flipkart', q: 'remove puma', applied: ['Brand: PUMA'], expect: ['-Brand: PUMA'] },
  { cat: 'remove', site: 'flipkart', q: "don't want black anymore, remove it", applied: ['Color: Black'], expect: ['-Color: Black'] },
  { cat: 'remove', site: 'amazon', q: 'remove the price filter', applied: ['Max price: ₹2000'], expect: ['-Price: *', '-Min price: *', '-Max price: *'] },
  { cat: 'remove', site: 'flipkart', q: 'remove size', applied: ['Size: M'], expect: ['-Size: *'] },
  { cat: 'remove', site: 'flipkart', q: 'remove all', expect: ['-*: *'] },
  { cat: 'remove', site: 'flipkart', q: 'remove it', applied: ['Color: Black', 'Brand: PUMA'], expect: ['-Brand: PUMA'] },
  { cat: 'remove', site: 'amazon', q: 'undo', applied: ['Brands: Nike'], expect: ['-Brands: Nike'] },
  { cat: 'remove', site: 'amazon', q: 'undo', applied: [], expect: [], reply: 'nomatch' },
  { cat: 'remove', site: 'flipkart', q: 'remove gucci', applied: ['Brand: PUMA'], expect: [], reply: 'nomatch' },
  { cat: 'remove', site: 'myntra', q: 'clear everything', expect: ['-*: *'] },
  { cat: 'remove', site: 'amazon', q: 'reset filters', expect: ['-*: *'] },
  { cat: 'remove', site: 'flipkart', q: 'sab hatao', expect: ['-*: *'] },
  { cat: 'remove', site: 'flipkart', q: 'puma hatao', applied: ['Brand: PUMA'], expect: ['-Brand: PUMA'] },
  { cat: 'remove', site: 'flipkart', q: 'remove black and puma', applied: ['Brand: PUMA', 'Color: Black'], expect: ['-Color: Black', '-Brand: PUMA'] },

  // ===== Sorting phrasings
  { cat: 'sort', site: 'flipkart', q: 'sort by price', expect: ['Sort by: Price: Low to High'] },
  { cat: 'sort', site: 'amazon', q: 'price low to high', expect: ['Sort by: Price: Low to High'] },
  { cat: 'sort', site: 'myntra', q: 'high to low please', expect: ['Sort by: Price: High to Low'] },
  { cat: 'sort', site: 'flipkart', q: 'show newest first', expect: ['Sort by: Newest First'] },
  { cat: 'sort', site: 'amazon', q: 'most popular ones', expect: ['Sort by: Popularity'] },
  { cat: 'sort', site: 'myntra', q: 'sort by rating', expect: ['Sort by: Customer Rating'] },
  { cat: 'sort', site: 'flipkart', q: 'cheapest black jacket', expect: ['Color: Black', 'Sort by: Price: Low to High'] },
  { cat: 'sort', site: 'amazon', q: 'show the costliest first', expect: ['Sort by: Price: High to Low'] },

  // ===== Prices: unusual amounts and phrasing
  { cat: 'price', site: 'flipkart-phones', q: 'phone under 1 lakh', expect: ['Max price: ₹30000+'] },
  { cat: 'price', site: 'amazon-phones', q: 'phone under 1.5 lakh', expect: ['Max price: ₹150000'] }, // Amazon takes any amount,
  { cat: 'price', site: 'flipkart', q: 'jacket under 1.5k', expect: ['Max price: ₹1500'] },
  { cat: 'price', site: 'flipkart', q: 'jacket under rs.1500', expect: ['Max price: ₹1500'] },
  { cat: 'price', site: 'flipkart', q: 'jacket under 1500 rupees', expect: ['Max price: ₹1500'] },
  { cat: 'price', site: 'flipkart', q: 'jacket under 50', expect: [], reply: 'nomatch' }, // lowest Flipkart limit is ₹500
  { cat: 'price', site: 'amazon', q: 'jacket under 1800', expect: ['Max price: ₹1800'] }, // exact on Amazon
  { cat: 'price', site: 'flipkart', q: 'jacket under 1800', expect: ['Max price: ₹1500'] }, // Flipkart dropdown: nearest value below
  { cat: 'price', site: 'flipkart', q: 'jacket under 0', expect: [], reply: 'nomatch' },
  { cat: 'price', site: 'amazon', q: 'under 1000 and above 5000', expect: ['Max price: ₹1000'] }, // impossible: keep the budget
  { cat: 'price', site: 'amazon', q: 'jacket for less than 2 thousand', expect: ['Max price: ₹2000'] },
  { cat: 'price', site: 'flipkart', q: 'jacket price 1000 to 2000', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'price', site: 'amazon', q: 'jacket upto rs 2,000/-', expect: ['Max price: ₹2000'] },
  { cat: 'price', site: 'myntra', q: 'jacket under 1500', expect: [], reply: 'nomatch' }, // Myntra jackets page has no price filter

  // ===== Gifts: who it's for
  { cat: 'gift', site: 'flipkart-shoes', q: 'shoes for my wife', expect: ['Gender: Women'] },
  { cat: 'gift', site: 'flipkart-shoes', q: 'shoes for my son size 4', expect: ['Gender: Boys', 'Size: 4'] },
  { cat: 'gift', site: 'amazon', q: 'jacket for my husband', expect: ['Gender: Men'] },
  { cat: 'gift', site: 'flipkart-shoes', q: 'gift for my dad, black shoes', expect: ['Gender: Men', 'Color: Black'] },
  { cat: 'gift', site: 'flipkart', q: 'jacket for him', expect: ['Gender: Men'] },
  { cat: 'gift', site: 'myntra-kurtas', q: 'kurta for my mom', expect: [], reply: 'nomatch' }, // kurtas page has no gender filter

  // ===== Hindi in Devanagari
  { cat: 'devanagari', site: 'flipkart', q: 'काली जैकेट', expect: ['Color: Black'] },
  { cat: 'devanagari', site: 'flipkart', q: 'लाल जैकेट 2000 से कम', expect: ['Color: Red', 'Max price: ₹2000'] },
  { cat: 'devanagari', site: 'flipkart-shoes', q: 'सफेद जूते साइज़ 9', expect: ['Color: White', 'Size: 9'] },
  { cat: 'devanagari', site: 'flipkart', q: 'सस्ता जैकेट', expect: ['Sort by: Price: Low to High'] },
  { cat: 'devanagari', site: 'flipkart', q: 'पुरुष नीली जैकेट', expect: ['Gender: Men', 'Color: Blue'] },

  // ===== Odd input: must not crash, must not invent filters
  { cat: 'odd', site: 'flipkart', q: '', reply: 'empty' },
  { cat: 'odd', site: 'flipkart', q: '    ', reply: 'empty' },
  { cat: 'odd', site: 'amazon', q: '😀😀😀', reply: 'empty' },
  { cat: 'odd', site: 'myntra', q: '...', reply: 'empty' },
  { cat: 'odd', site: 'flipkart', q: '<script>alert(1)</script>', expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'amazon', q: "'; DROP TABLE products; --", expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'flipkart', q: 'https://www.flipkart.com/some-product/p/itm123', expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'amazon', q: 'jacket '.repeat(200), expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'flipkart', q: 'black '.repeat(50) + 'jacket', expect: ['Color: Black'] },
  { cat: 'odd', site: 'flipkart', q: '9999999999', expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'myntra', q: 'jkjkjkjk', expect: [], reply: 'nomatch' },
  { cat: 'odd', site: 'flipkart', q: 'BLACK!!!!! PUMA!!!!!', expect: ['Color: Black', 'Brand: PUMA'] },
  { cat: 'odd', site: 'flipkart', q: 'black\npuma\njacket', expect: ['Color: Black', 'Brand: PUMA'] },
  { cat: 'odd', site: 'amazon', q: 'NiKe JaCkEt', expect: ['Brands: Nike'] },
  { cat: 'odd', site: 'flipkart', q: 'pumaa jackt blk', expect: ['Brand: PUMA'] }, // "blk" too short to correct safely

  // ===== Things that don't exist on the page
  { cat: 'not-on-page', site: 'flipkart', q: 'gucci jacket', expect: [], reply: 'nomatch' },
  { cat: 'not-on-page', site: 'flipkart', q: 'jacket size 50', expect: [], reply: 'nomatch' },
  { cat: 'not-on-page', site: 'myntra', q: 'transparent jacket', expect: [], reply: 'nomatch' },
  { cat: 'not-on-page', site: 'amazon-phones', q: 'phone with 64gb ram', expect: ['RAM Size: 10 GB & Above'] },
  { cat: 'not-on-page', site: 'flipkart', q: 'black gucci jacket', expect: ['Color: Black'] },

  // ===== Mixed: several things at once, chatty
  { cat: 'mixed', site: 'flipkart', q: 'hey can u show me some black or navy jackets for men under 2k, size L, sorted cheapest first', expect: ['Color: Black', 'Color: Navy Blue', 'Gender: Men', 'Max price: ₹2000', 'Size: L', 'Sort by: Price: Low to High'] },
  { cat: 'mixed', site: 'amazon-shoes', q: 'need white nike or adidas running shoes uk 9 with good reviews under 5000', expect: ['Colour: White', 'Brands: Nike', 'Brands: adidas', 'Purpose: Running', "Men's Shoe Size (UK/India): 9", 'Customer Reviews: 4 Stars & Up', 'Max price: ₹5000'] },
  { cat: 'mixed', site: 'flipkart-phones', q: 'bhai 5g phone chahiye 8gb ram 15000 tak samsung ya redmi', expect: ['Network Type: 5G', 'Ram: 8 GB and Above', 'Max price: ₹15000', 'Brand: Samsung', 'Brand: REDMI'] },
  { cat: 'mixed', site: 'myntra-kurtas', q: 'cotton kurta for women in yellow, M size, 40% off at least', expect: ['Fabrics: Cotton', 'Color: Yellow', 'Size: M', 'Discount Range: 40% and above'] },
]

// Held out: written after all the fixes above and run once before any further change.
EVERYDAY.push(
  { cat: 'held-out-3', site: 'flipkart', q: 'yo', reply: 'greet' },
  { cat: 'held-out-3', site: 'amazon', q: 'Hi! Can you help me?', reply: 'help' },
  { cat: 'held-out-3', site: 'myntra', q: 'thanks a lot!!', reply: 'thanks' },
  { cat: 'held-out-3', site: 'flipkart', q: 'ok thanks bye', reply: 'thanks' },
  { cat: 'held-out-3', site: 'amazon', q: 'how to use this extension', reply: 'help' },
  { cat: 'held-out-3', site: 'flipkart-shoes', q: 'which brands are available here', reply: 'list:Brands' },
  { cat: 'held-out-3', site: 'myntra-kurtas', q: 'what colours do you have?', reply: 'list:Colours' },
  { cat: 'held-out-3', site: 'amazon-shoes', q: 'list all sizes', reply: 'list:Sizes' },
  { cat: 'held-out-3', site: 'flipkart', q: 'what filters are on now', reply: 'applied', applied: ['Color: Blue'] },
  { cat: 'held-out-3', site: 'amazon', q: 'can I get a refund?', reply: 'offtopic' },
  { cat: 'held-out-3', site: 'flipkart', q: 'is cash on delivery available', reply: 'offtopic' },
  { cat: 'held-out-3', site: 'myntra', q: 'mera order kab aayega', reply: 'offtopic' },
  { cat: 'held-out-3', site: 'amazon-phones', q: 'which mobile is best for gaming', expect: ['Purpose: Gaming', 'Sort by: Customer Rating'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'puma vs adidas jacket', reply: 'compare', expect: ['Brand: PUMA', 'Brand: ADIDAS'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'do u have red jackets in XL?', expect: ['Color: Red', 'Size: XL'] },
  { cat: 'held-out-3', site: 'amazon-shoes', q: 'need sports shoes for my brother size 8', expect: ['Gender: Men', "Men's Shoe Size (UK/India): 8"] },
  { cat: 'held-out-3', site: 'myntra-shoes', q: 'puma ke joote 40% off wale', expect: ['Brand: Puma', 'Discount Range: 40% and above'] },
  { cat: 'held-out-3', site: 'flipkart-phones', q: 'redmi or realme under 12k', expect: ['Brand: REDMI', 'Brand: realme', 'Max price: ₹10000'] },
  { cat: 'held-out-3', site: 'amazon-phones', q: 'apple phone above 50k', expect: ['Brands: Apple', 'Min price: ₹50000'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'change colour to green', applied: ['Color: Black'], expect: ['Color: Green', '-Color: Black'] },
  { cat: 'held-out-3', site: 'amazon', q: 'show only puma', applied: ['Brands: Nike'], expect: ['Brands: PUMA', '-Brands: Nike'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'remove the colour filter', applied: ['Color: Black'], expect: ['-Color: *'] },
  { cat: 'held-out-3', site: 'myntra', q: 'start again', expect: ['-*: *'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'black hatao', applied: ['Color: Black'], expect: ['-Color: Black'] },
  { cat: 'held-out-3', site: 'amazon', q: 'sort by lowest price', expect: ['Sort by: Price: Low to High'] },
  { cat: 'held-out-3', site: 'myntra-shoes', q: 'new arrivals in nike', expect: ['Brand: Nike', 'Sort by: Newest First'] },
  { cat: 'held-out-3', site: 'flipkart', q: 'jacket under ₹1,999', expect: ['Max price: ₹1500'] },
  { cat: 'held-out-3', site: 'amazon', q: 'jackets between 1500-3000', expect: ['Min price: ₹1500', 'Max price: ₹3000'] },
  { cat: 'held-out-3', site: 'flipkart-shoes', q: 'shoes for my daughter', expect: [], reply: 'nomatch' }, // no Girls option, only "Boys & Girls"
  { cat: 'held-out-3', site: 'flipkart', q: 'नीली जैकेट L साइज़', expect: ['Color: Blue', 'Size: L'] },
  { cat: 'held-out-3', site: 'amazon', q: '🤔', reply: 'empty' },
  { cat: 'held-out-3', site: 'flipkart', q: 'asdf puma', expect: ['Brand: PUMA'] },
  { cat: 'held-out-3', site: 'myntra', q: 'zara jacket', expect: [], reply: 'nomatch' },
  { cat: 'held-out-3', site: 'flipkart', q: 'I want a warm jacket for winter, not too costly, maybe black or brown', expect: ['Color: Black', 'Color: Brown', 'Sort by: Price: Low to High'] }, // 'not too costly' = cheapest first, same as 'not too expensive',
  { cat: 'held-out-3', site: 'amazon-phones', q: 'samsung phone 8gb 256gb 5g', expect: ['Brands: Samsung', 'RAM Size: 8 to 9.9 GB', 'Storage Capacity: 256 GB', 'Cellular Technology: 5G'] },
)
EVERYDAY.push(
  // Added after the held-out run: cash on delivery is a real filter on Amazon only.
  { cat: 'cod', site: 'amazon', q: 'is cash on delivery available', expect: ['Pay On Delivery: Eligible for Pay On Delivery'] },
  { cat: 'cod', site: 'amazon', q: 'nike jacket with cod', expect: ['Brands: Nike', 'Pay On Delivery: Eligible for Pay On Delivery'] },
  { cat: 'cod', site: 'myntra', q: 'cod available?', reply: 'offtopic' },
  { cat: 'help', site: 'myntra', q: 'hello, i need help', reply: 'help' },
)
EVERYDAY.push({ cat: 'cod', site: 'amazon', q: 'free delivery jackets', expect: ['Eligible for Free Delivery: Free Shipping'] })
EVERYDAY.push(
  // ===== Gap sweep (Nov 12): wordings not covered above. Expectations written before running.
  // Negation inside a sentence
  { cat: 'gaps', site: 'flipkart', q: 'puma jacket except black', expect: ['Brand: PUMA'] },
  { cat: 'gaps', site: 'flipkart', q: 'no nike, show puma', expect: ['Brand: PUMA'] },
  { cat: 'gaps', site: 'flipkart', q: 'jacket without hood', expect: ['Hooded: Without Hood'] },
  { cat: 'gaps', site: 'flipkart', q: 'hooded jacket', expect: ['Hooded: With Hood'] },
  // Ratings and discounts
  { cat: 'gaps', site: 'flipkart', q: '4 star and above jackets', expect: ['Customer Ratings: 4★ & above'] },
  { cat: 'gaps', site: 'amazon', q: 'rated 4+ puma', expect: ['Customer Reviews: 4 Stars & Up', 'Brands: PUMA'] },
  { cat: 'gaps', site: 'flipkart', q: '50% off jackets', expect: ['Discount: 50% or more'] },
  { cat: 'gaps', site: 'myntra-shoes', q: 'atleast 30 percent discount', expect: ['Discount Range: 30% and above'] },
  // Prices, many wordings
  { cat: 'gaps', site: 'flipkart', q: 'jackets above 1500', expect: ['Min price: ₹1500'] },
  { cat: 'gaps', site: 'amazon', q: 'minimum 1000 maximum 2000', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'gaps', site: 'flipkart', q: 'not more than 2000', expect: ['Max price: ₹2000'] },
  { cat: 'gaps', site: 'flipkart', q: 'budget 2000', expect: ['Max price: ₹2000'] },
  { cat: 'gaps', site: 'flipkart', q: '2000 se kam jacket', expect: ['Max price: ₹2000'] },
  { cat: 'gaps', site: 'flipkart', q: 'jacket under 2K', expect: ['Max price: ₹2000'] },
  { cat: 'gaps', site: 'flipkart', q: 'RED JACKET UNDER 1000', expect: ['Color: Red', 'Max price: ₹1000'] },
  // Sizes
  { cat: 'gaps', site: 'flipkart', q: 'M or L size', expect: ['Size: M', 'Size: L'] },
  { cat: 'gaps', site: 'flipkart', q: 'xl', expect: ['Size: XL'] },
  { cat: 'gaps', site: 'flipkart', q: 'xxl jacket', expect: ['Size: 2XL'] },
  { cat: 'gaps', site: 'myntra', q: '2xl jacket', expect: ['Size: XXL'] },
  { cat: 'gaps', site: 'myntra-shoes', q: 'uk 9 shoes', expect: ['Size: UK9'] },
  { cat: 'gaps', site: 'flipkart-shoes', q: 'size 9 and 10', expect: ['Size: 9', 'Size: 10'] },
  { cat: 'gaps', site: 'flipkart-shoes', q: 'women shoes size 6', expect: ['Gender: Women', 'Size: 6'] },
  // Colours: exact shade, Hinglish, spelling
  { cat: 'gaps', site: 'flipkart', q: 'navy jacket', expect: ['Color: Navy Blue'] },
  { cat: 'gaps', site: 'flipkart', q: 'dark blue jacket', expect: ['Color: Dark Blue'] },
  { cat: 'gaps', site: 'flipkart', q: 'off white jacket', expect: ['Color: Off White'] },
  { cat: 'gaps', site: 'amazon', q: 'gray jacket', expect: ['Colour: Greys'] },
  { cat: 'gaps', site: 'flipkart', q: 'kala jacket', expect: ['Color: Black'] },
  { cat: 'gaps', site: 'myntra-kurtas', q: 'neela kurta', expect: ['Color: Blue'] },
  { cat: 'gaps', site: 'myntra-kurtas', q: 'laal kurta', expect: ['Color: Red'] },
  { cat: 'gaps', site: 'flipkart', q: 'black black black jacket', expect: ['Color: Black'] },
  // Brand spellings
  { cat: 'gaps', site: 'flipkart', q: 'levis jacket', expect: ["Brand: LEVI'S"] },
  { cat: 'gaps', site: 'flipkart', q: 'us polo jacket', expect: ['Brand: U.S. POLO ASSN.'] },
  { cat: 'gaps', site: 'flipkart', q: 'jack and jones jacket', expect: ['Brand: JACK & JONES'] },
  { cat: 'gaps', site: 'flipkart-phones', q: 'iphone', expect: ['Brand: Apple'] },
  { cat: 'gaps', site: 'myntra-shoes', q: 'reebok', expect: ['Brand: Reebok'] },
  // Product features
  { cat: 'gaps', site: 'flipkart', q: 'bomber jacket', expect: ['Type: Bomber Jacket'] },
  { cat: 'gaps', site: 'flipkart', q: 'full sleeve jacket', expect: ['Sleeve: Full Sleeve'] },
  { cat: 'gaps', site: 'flipkart', q: 'party wear jacket', expect: ['Occasion: Party'] },
  { cat: 'gaps', site: 'myntra-kurtas', q: 'cotton kurta', expect: ['Fabrics: Cotton'] },
  { cat: 'gaps', site: 'flipkart-phones', q: 'phone with 5000mah battery', expect: ['Battery Capacity: 5000 - 5999 mAh'] },
  { cat: 'gaps', site: 'flipkart-phones', q: '128gb phone', expect: ['Internal Storage: 128 - 255.9 GB'] },
  { cat: 'gaps', site: 'flipkart-phones', q: '6gb ram', expect: ['Ram: 6 GB'] },
  { cat: 'gaps', site: 'flipkart-phones', q: '48mp camera phone', expect: ['Primary Camera: 48 - 63.9 MP'] },
  { cat: 'gaps', site: 'amazon-phones', q: 'amoled display phone', expect: ['Display Type: AMOLED'] },
  { cat: 'gaps', site: 'amazon-phones', q: 'dual sim phone', expect: ['SIM Card Slot Count: Dual SIM'] },
  { cat: 'gaps', site: 'flipkart-phones', q: 'in stock only', expect: ['Availability: Exclude Out of Stock'] },
  { cat: 'gaps', site: 'myntra-shoes', q: 'running shoes', expect: ['Sport: Running'] },
  { cat: 'gaps', site: 'myntra-shoes', q: 'velcro shoes', expect: ['Fastening: Velcro'] },
  // Follow-ups and sorting
  { cat: 'gaps', site: 'flipkart', q: 'same in red', applied: ['Color: Black'], expect: ['Color: Red', '-Color: Black'] },
  { cat: 'gaps', site: 'flipkart', q: 'show cheaper ones', expect: ['Sort by: Price: Low to High'] },
  { cat: 'gaps', site: 'amazon', q: "what's the cheapest", expect: ['Sort by: Price: Low to High'] },
  { cat: 'gaps', site: 'flipkart', q: 'clear', applied: ['Brand: PUMA'], expect: ['-*: *'] },
  // One-word messages
  { cat: 'gaps', site: 'flipkart', q: 'filters', reply: 'filters' },
  { cat: 'gaps', site: 'flipkart', q: 'price', reply: 'price' },
  { cat: 'gaps', site: 'flipkart', q: 'sizes', reply: 'list:Sizes' },
  { cat: 'gaps', site: 'flipkart', q: '2000', expect: ['Max price: ₹2000'] },
  // Things it cannot do, and rudeness
  { cat: 'gaps', site: 'flipkart', q: 'next page', reply: 'offtopic' },
  { cat: 'gaps', site: 'flipkart', q: 'show more', reply: 'offtopic' },
  { cat: 'gaps', site: 'amazon', q: 'you are useless', reply: 'offtopic' },
  { cat: 'gaps', site: 'myntra', q: 'stupid bot', reply: 'offtopic' },
  // Odd input
  { cat: 'gaps', site: 'flipkart', q: 'x'.repeat(400) + ' puma', expect: ['Brand: PUMA'] },
  { cat: 'gaps', site: 'flipkart', q: 'கருப்பு ஜாக்கெட்', expect: [], reply: 'nomatch' },
  { cat: 'gaps', site: 'flipkart', q: 'jacket under -500', expect: [], reply: 'nomatch' },
)
EVERYDAY.push(
  // ===== Held-out 4: written after the gap fixes, never tuned on. Includes traps for those fixes.
  { cat: 'held-out-4', site: 'flipkart', q: 'is blue available', expect: ['Color: Blue'] },
  { cat: 'held-out-4', site: 'amazon', q: 'in stock jackets', expect: [], reply: 'nomatch' },
  { cat: 'held-out-4', site: 'flipkart', q: 'blue jacket available in L', expect: ['Color: Blue', 'Size: L'] },
  { cat: 'held-out-4', site: 'flipkart-phones', q: 'only in stock samsung', expect: ['Brand: Samsung', 'Availability: Exclude Out of Stock'] },
  { cat: 'held-out-4', site: 'flipkart-shoes', q: 'size 7 or 8', expect: ['Size: 7', 'Size: 8'] },
  { cat: 'held-out-4', site: 'myntra', q: 'size S, M or L', expect: ['Size: S', 'Size: M', 'Size: L'] },
  { cat: 'held-out-4', site: 'amazon-shoes', q: 'uk 8 or 9', expect: ["Men's Shoe Size (UK/India): 8", "Men's Shoe Size (UK/India): 9"] },
  { cat: 'held-out-4', site: 'flipkart', q: 'jacket size L and black', expect: ['Size: L', 'Color: Black'] },
  { cat: 'held-out-4', site: 'myntra-kurtas', q: '20 percent off', expect: ['Discount Range: 20% and above'] },
  { cat: 'held-out-4', site: 'flipkart', q: '1500', expect: ['Max price: ₹1500'] },
  { cat: 'held-out-4', site: 'flipkart-shoes', q: '9', expect: ['Size: 9'] },
  { cat: 'held-out-4', site: 'flipkart', q: 'same but in L', applied: ['Size: M'], expect: ['Size: L', '-Size: M'] },
  { cat: 'held-out-4', site: 'flipkart', q: 'colours', reply: 'list:Colours' },
  { cat: 'held-out-4', site: 'myntra-shoes', q: 'brands?', reply: 'list:Brands' },
  { cat: 'held-out-4', site: 'amazon', q: 'budget', reply: 'price' },
  { cat: 'held-out-4', site: 'myntra', q: 'load more', reply: 'offtopic' },
  { cat: 'held-out-4', site: 'amazon', q: 'page 2', reply: 'offtopic' },
  { cat: 'held-out-4', site: 'flipkart', q: 'this is not working', reply: 'offtopic' },
  { cat: 'held-out-4', site: 'myntra', q: 'worst app', reply: 'offtopic' },
  { cat: 'held-out-4', site: 'flipkart', q: 'worst rated jackets', expect: [], reply: 'nomatch' },
  { cat: 'held-out-4', site: 'amazon', q: 'show me more black ones', expect: ['Colour: Black'] },
  { cat: 'held-out-4', site: 'flipkart', q: 'puma, size m or l, under 2000', expect: ['Brand: PUMA', 'Size: M', 'Size: L', 'Max price: ₹2000'] },
)
EVERYDAY.push(
  // ===== Held-out 5: spelling mistakes, price formats, follow-ups. Written before running.
  // Spelling mistakes
  { cat: 'held-out-5', site: 'flipkart', q: 'addidas jacket', expect: ['Brand: ADIDAS'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'nikee jacket', expect: ['Brand: NIKE'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'blak jackt', expect: ['Color: Black'] },
  { cat: 'held-out-5', site: 'myntra-shoes', q: 'whte shoes', expect: ['Color: White'] },
  { cat: 'held-out-5', site: 'flipkart-phones', q: 'samsng phone', expect: ['Brand: Samsung'] },
  { cat: 'held-out-5', site: 'amazon', q: 'jacket for mens', expect: ['Gender: Men'] },
  // Price formats
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under rs2000', expect: ['Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under 2,000', expect: ['Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under ₹ 2000', expect: ['Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under 2000/-', expect: ['Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under Rs. 1,500.00', expect: ['Max price: ₹1500'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'jacket under2000', expect: ['Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'amazon', q: 'jacket 1000-2000', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'amazon', q: 'from 1000 to 2000', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'kam daam wali jacket', expect: ['Sort by: Price: Low to High'] },
  // Follow-ups with something already applied
  { cat: 'held-out-5', site: 'flipkart', q: 'also red', applied: ['Color: Black'], expect: ['Color: Red'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'remove size L', applied: ['Size: L', 'Color: Black'], expect: ['-Size: L'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'remove price', applied: ['Max price: ₹2000'], expect: ['-Min price: *', '-Max price: *'] }, // all price filters, like 'remove the price filter'
  { cat: 'held-out-5', site: 'flipkart', q: 'not puma', applied: ['Brand: PUMA'], expect: ['-Brand: PUMA'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'no need of black', applied: ['Color: Black'], expect: ['-Color: Black'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'increase budget to 3000', applied: ['Max price: ₹2000'], expect: ['Max price: ₹2000+'] },
  { cat: 'held-out-5', site: 'amazon', q: 'cheapest first', applied: ['Sort by: Popularity'], expect: ['Sort by: Price: Low to High'] },
  // Mixed messages
  { cat: 'held-out-5', site: 'myntra-kurtas', q: 'yellow or pink kurta size xl', expect: ['Color: Yellow', 'Color: Pink', 'Size: XL'] },
  { cat: 'held-out-5', site: 'amazon-shoes', q: 'nike running shoes size 10 for men', expect: ['Brands: Nike', 'Purpose: Running', "Men's Shoe Size (UK/India): 10", 'Gender: Men'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'thanks, now show red ones', expect: ['Color: Red'] },
  { cat: 'held-out-5', site: 'flipkart', q: 'hello, what sizes do you have', reply: 'list:Sizes' },
)
EVERYDAY.push(
  // ===== Held-out 6: numbers that are not prices, mixed price words, gender switches, empty pages.
  { cat: 'held-out-6', site: 'flipkart-phones', q: '6.5 inch screen phone', expect: ['Screen Size: 6.4 inch & Above'] },
  { cat: 'held-out-6', site: 'amazon-phones', q: 'phone with 4k video', expect: ['Video Capture Resolution: 4k'] },
  { cat: 'held-out-6', site: 'amazon-phones', q: '120hz phone', expect: ['Display Refresh Rate in Hertz: 120'] },
  { cat: 'held-out-6', site: 'amazon-phones', q: '5g phone under 20k', expect: ['Cellular Technology: 5G', 'Max price: ₹20000'] },
  { cat: 'held-out-6', site: 'flipkart', q: 'under 2000 but above 1000', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'held-out-6', site: 'amazon', q: 'max 2k min 1k', expect: ['Min price: ₹1000', 'Max price: ₹2000'] },
  { cat: 'held-out-6', site: 'flipkart', q: 'not too expensive jacket', expect: ['Sort by: Price: Low to High'] },
  { cat: 'held-out-6', site: 'flipkart-shoes', q: 'for women instead', applied: ['Gender: Men'], expect: ['Gender: Women', '-Gender: Men'] },
  { cat: 'held-out-6', site: 'flipkart-shoes', q: 'shoes for boys', expect: ['Gender: Boys'] },
  { cat: 'held-out-6', site: 'flipkart', q: 'black jacket', page: 'empty', expect: [], reply: 'nomatch' },
  { cat: 'held-out-6', site: 'flipkart', q: 'what brands are there', page: 'empty', reply: 'nolist' },
  { cat: 'held-out-6', site: 'myntra', q: 'puma jacket!!!???', expect: ['Brand: Puma'] }, // first written as "no Puma": wrong, the page has Puma
  { cat: 'held-out-6', site: 'myntra', q: 'roadster jacket!!!???', expect: ['Brand: Roadster'] },
  { cat: 'held-out-6', site: 'amazon', q: 'Black Jacket, Size XL, Under ₹1500, Nike', expect: ['Colour: Black', "Men's General Size: XL", 'Max price: ₹1500', 'Brands: Nike'] },
  { cat: 'held-out-6', site: 'flipkart', q: 'jacket for 25 year old man', expect: ['Gender: Men'] },
  { cat: 'held-out-6', site: 'flipkart-phones', q: 'phone for my mom with big battery', expect: ['Speciality: Long-Lasting Battery'] }, // the page's own option for this
  { cat: 'held-out-6', site: 'myntra-kurtas', q: 'kurta for diwali', expect: ['Theme: Diwali'] },
  { cat: 'held-out-6', site: 'myntra-kurtas', q: 'wedding kurta', expect: ['Theme: Wedding'] },
)
EVERYDAY.push(
  // ===== Regressions the real-AI run caught (Nov 12): today's fixes broke these older sentences.
  { cat: 'regress', site: 'amazon', q: 'not nike, show adidas', expect: ['Brands: adidas'] },
  { cat: 'regress', site: 'amazon', q: 'not nike, show adidas', applied: ['Brands: Nike'], expect: ['Brands: adidas', '-Brands: Nike'] },
  { cat: 'regress', site: 'myntra-kurtas', q: 'pink or yellow cotton anarkali kurta, size M, 3/4 sleeves, for diwali, 50% off', expect: ['Color: Pink', 'Color: Yellow', 'Fabrics: Cotton', 'Shape: Anarkali', 'Size: M', 'Sleeve Length: Three-Quarter Sleeves', 'Theme: Diwali', 'Discount Range: 50% and above'] },
  { cat: 'regress', site: 'flipkart', q: '12345', expect: [], reply: 'nomatch' },
  { cat: 'regress', site: 'flipkart', q: '1999', expect: ['Max price: ₹1500'] },
)
EVERYDAY.push(
  // ===== Second user-found bug (Nov 12): say what couldn't be done, read "size is 40".
  { cat: 'regress', site: 'myntra', q: 'white roadster jacket size is L', expect: ['Brand: Roadster', 'Size: L'], reply: 'colour-missing' },
  { cat: 'regress', site: 'myntra', q: 'can you compare amazon flipkart and myntra for roadstar jacket size is xl', expect: ['Brand: Roadster', 'Size: XL'], reply: 'compare' },
  { cat: 'regress', site: 'myntra', q: 'black roadster jacket', expect: ['Color: Black', 'Brand: Roadster'] },
  { cat: 'regress', site: 'myntra', q: 'not white, black jacket', expect: ['Color: Black'] },
  { cat: 'regress', site: 'flipkart', q: 'navy jacket', expect: ['Color: Navy Blue'] },
  // ===== Found by the blind search tests (Nov 12): the "rs" ending a word is not rupees.
  { cat: 'regress', site: 'myntra-shoes', q: 'puma sneakers 50% off', expect: ['Brand: Puma', 'Discount Range: 50% and above'] },
  { cat: 'regress', site: 'flipkart-shoes', q: 'nike sneakers 9', expect: ['Brand: NIKE', 'Size: 9'] },
  { cat: 'regress', site: 'flipkart', q: 'jacket rs 1500', expect: ['Max price: ₹1500'] },
)
EVERYDAY.push(
  // The page was searched for the colour already ("pink cotton kurta"): no "not on this page" note.
  { cat: 'regress', site: 'myntra-kurtas', q: 'pink cotton kurta size M', searchTerm: 'pink cotton kurta', expect: ['Color: Pink', 'Fabrics: Cotton', 'Size: M'] },
  { cat: 'regress', site: 'myntra', q: 'white jacket', searchTerm: 'white jacket', expect: [], reply: 'nomatch' },
)
