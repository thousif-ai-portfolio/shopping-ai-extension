# AI Shopping Filters

A Chrome extension that applies shopping filters from plain English, using an AI model that runs
**entirely on your computer**: no server, no API key, no cost.

Open a search on **Amazon.in, Flipkart or Myntra**, open the side panel and type, for example:

> black puma jacket size M under 2000

The extension reads the filters the page offers, works out which ones you mean, and ticks them
on the page for you:

> ✅ Colour: Black  ✅ Brands: PUMA  ✅ Size: M  ✅ Max price: ₹2000

It works like a chat: follow-up messages refine the same page. The panel shows the conversation
(your messages on the right, answers with ✅ filter chips on the left), example requests to click,
and while the AI starts a progress bar ("Preparing the AI… 34%", then "Starting the AI…"); Enter
sends. The backup AI runs in a hidden page that starts with Chrome and stays loaded until Chrome
quits, so opening the panel again shows **Ready** at once instead of restarting the model
(it keeps roughly 0.5–1 GB of memory in use while Chrome is open).

| You type | What happens |
|---|---|
| `black puma jacket under 2000` | adds Black, PUMA, max ₹2000 |
| `cheapest first` | ↕ sorts by price, low to high |
| `make it size L` · `now under 1500` | adds size L · changes the max price |
| `remove puma` · `remove the brand filter` | 🗑 takes PUMA off · takes all brands off |
| `clear all filters` / `start over` / `reset` | 🗑 removes every filter |
| `give me running shoes` (on a jackets page) | searches the site for running shoes first |
| `open amazon, i need a blue shirt under 500` · `show this on myntra` | opens that site, searches, then filters |
| `hi` · `what brands are there?` · `what did you apply?` | answers in the chat, applies nothing |
| `return policy?` · `where is my order` | says politely that it only filters, sorts and searches |

| `compare black roadster shirt size 40 on amazon, flipkart and myntra` · `lowest price on all 3 sites` | 🔍 searches all three sites with the same filters, cheapest first, and says which is cheapest and by how much |

### Comparing prices across the three sites

Name two or more sites, or say "all 3 sites" / "across sites", and the extension:

1. searches **Amazon, Flipkart and Myntra** for the same words (request words, prices and sizes removed),
2. applies **the same filters** on each (brand, colour, size, price) and sorts **cheapest first**,
3. reads the cheapest results and checks each title really is what was asked: the right product
   type ("sliders" are not running shoes), the right kind ("running", "casual"…), and the brand
   where a site has no brand filter,
4. opens the **cheapest site's results** and explains the choice, for example (illustrative; real
   runs are in the test results below):

> **Picked Myntra: ₹333, which is ₹45 less than Flipkart.**
> • Myntra: ₹333, Roadster Casual Shirt ✅ cheapest
> • Flipkart: ₹378, Roadster Men Solid Casual Shirt (₹45 more)
> • Amazon: ₹236, Youth First Shirt. *Not compared: its brand filter couldn't be applied there, so this may be a different item*

A site is only compared when it got every filter the others got. Otherwise it is listed with
the reason, never silently counted. The sites share no product ids, so this finds the **cheapest
matching item on each site**, not necessarily the identical product. It takes about 2 minutes
(one site after another, in the same tab).

If the filters together match no products, the panel warns: *"No products match all these
filters. Try 'remove …', a higher budget, or 'start over'."*

## Task requirements

| Requirement | How it is met |
|---|---|
| Works on at least 3 shopping sites | Amazon.in, Flipkart and Myntra, tested on jackets, shoes, phones and kurtas |
| Detects filters and applies them from what you type | Each site has an adapter that reads every filter on the page (including the full "+ more" brand lists) and applies the chosen ones |
| Powered by a client-side LLM | Chrome's built-in **Gemini Nano** where the PC supports it, otherwise **Qwen2.5-0.5B** running in the browser with **Transformers.js** |

## Install

1. Build it (needs Node.js):
   ```bash
   npm install
   npm run build
   ```
2. In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and
   choose the `dist` folder.
3. Open a search on Amazon.in, Flipkart or Myntra, then click the extension icon.

The first time, the backup AI downloads once (about 500 MB, roughly 2–3 minutes) and is then
cached. After that the panel is ready about 13 seconds after it opens.

## How it works

```
 You type: "samsung 5g phone with 8gb ram under 15000"
        │
        ▼
 ⓪ Right product?   if you ask for a different product than the page shows ("running shoes"
        │           on a jackets page), the extension first searches the site for it
        ▼           (src/ai/product.ts), waits for the new results, then continues
 ① Read filters     the site adapter lists every filter group and option on the page
        │           (Brand: Samsung, OnePlus…; RAM: 8 to 9.9 GB…; Cellular: 5G…)
        ▼
 ② Understand       • AI (on-device) picks out descriptive words → "samsung"
        │           • rules read numbers → max price 15000, "8gb ram", "5g"
        ▼
 ③ Match            code maps words and numbers to options that really exist on the page
        │
        ▼
 ④ Apply            the adapter ticks them on the site, then the panel shows ✅ chips
                    (🗑 for removed filters, ↕ for sorting)
```

The panel also **remembers what it applied in the chat** (per tab), so "remove nike" still works
when a combination has zero results and the site hides its whole filter list.

### The AI and why it is used this way

- **Gemini Nano** (Chrome's built-in AI) is used when the PC supports it (it needs about 16 GB
  RAM or a graphics card with more than 4 GB).
- Otherwise **Qwen2.5-0.5B-Instruct** runs in the browser with Transformers.js, in a background
  worker so the panel never freezes. It is the 8-bit version on the CPU, which was fastest in
  tests on a typical laptop (i3, 8 GB RAM, Intel graphics).
- Both AIs get the same short instruction ([`src/ai/prompt.ts`](src/ai/prompt.ts)): *list the
  descriptive words*. A tiny answer such as `black, puma` takes 8–15 s on that laptop, where a
  full JSON answer took 30–45 s.
- **Small models are unreliable with numbers**, so prices, discounts, ratings, sizes and values
  like "8gb" or "5000 mah" are read by plain rules ([`rules.ts`](src/ai/rules.ts),
  [`match.ts`](src/ai/match.ts)). The AI handles words; the code handles numbers.
- Only words that the user actually typed are kept, so the AI cannot invent filters.

### Matching ([`src/ai/match.ts`](src/ai/match.ts))

- Every option name on the page is looked for in the sentence; **longest match wins**
  ("red tape" before "red", "navy blue" before "blue").
- Spelling and naming differences: "&" = "and", "U.S." = "us", "Levi's" = "levis",
  "The North Face" = "north face", short forms like "hrx" and "us polo".
- Same meaning, different words: men's/gents/male→men, ladies/female→women, hooded→with hood,
  no hood→without hood, 3/4→three-quarter, iphone→Apple, "one plus"→OnePlus.
- **Colour synonyms only as a fallback:** "maroon" picks Maroon where a site has it, otherwise Red;
  "navy" → Navy, else Navy Blue, else Blue; golden→gold, violet→purple.
- **Everyday phrasing** ([`rules.ts`](src/ai/rules.ts)): prices ("1k-2k", "500 to 1000",
  "around 2000", "not more than 2000", "₹1500", "1000+"), sizes ("L size", "10 size", "size: M",
  "uk 9", "medium"), phone shorthand ("8/128"), "on sale", "good reviews", "4+ rating".
- **Hinglish:** prices ("2000 ke andar", "1500 tak", "500 se 1000", "1000 se kam"), colours
  (kala, safed, laal, neela, peela, gulabi, hara…), "joote" (shoes), "sasta" (cheapest), "hatao" (remove).
- **Sorting:** cheapest / low to high / sasta, most expensive / high to low, newest / latest,
  popular / best selling, top rated.
- **Remove and clear:** "remove puma", "remove the brand filter", "remove price filter",
  "clear all filters", "start over", "reset".
- **Typos:** one wrong letter ("pumma" → PUMA). Everyday English words are never "corrected",
  so "light" never becomes the brand "right decision".
- **Negation:** "not black", "except black", "no puma", "don't want puma" exclude those words
  (but "without hood" is itself a filter and is applied).
- **Numbers with units:** "8gb ram", "128gb storage", "5000 mah", "64mp", "16mp selfie",
  "120hz", "6.5 inch". The words next to the number decide the group (RAM or storage).
- **Everyday words never trigger brands.** Flipkart lists about 2,000 brands, including "Good
  One", "Latest Chikan" and "Under Armour", so a list of common words
  ([`common.ts`](src/ai/common.ts)) blocks these collisions.

### Site adapters ([`src/adapters/`](src/adapters))

| Site | How filters are read | How they are applied |
|---|---|---|
| **Amazon** | Sidebar groups by their ids (`filter-p_123`) | Builds one URL (`rh=p_123:…,p_36:-200000`), so all filters apply in one page load. Exact min/max price through Amazon's hidden price range |
| **Flipkart** | Opens each collapsed section and reads the full "126 MORE" brand list | Ticks one at a time, reopening sections (Flipkart closes them after every change) and using the brand search box for hidden brands |
| **Myntra** | Sidebar, the "+ 272 more" brand/colour lists, and the top bar of extra groups | Ticks one at a time and waits for the product list to reload, otherwise Myntra drops the previous filter |

Adding a fourth site means writing one new adapter file; nothing else changes.

## Test results

All tests ran on a typical laptop (Intel i3-1115G4, 8 GB RAM, Intel UHD graphics, so the backup
AI was used).

**Final results (Nov 12, 2026), all on the final build:**

| Test | Result |
|---|---|
| Everyday messages through the real AI (questions, chat, Hinglish, typos, follow-ups, odd input) | **615 / 615** |
| …of which written **blind** by a separate reviewer who never saw the code | **254 / 254** |
| Filter sentences through the real AI | **284 / 284** |
| What to search for / which site to open (`scripts/search.mjs`) | **85 / 85** (46 blind) |
| Price comparison: when to compare, the winner, the explanation (`scripts/compare-test.mjs`) | **82 / 82** (45 blind) |
| **Live** on Amazon, Flipkart and Myntra | **46 / 46** |
| …standard filtering · harder cases · new product / other site · chat conversations · price comparison | 12/12 · 7/7 · 9/9 · 14/14 · 4/4 |

All of these ran on the final code (12–13 Nov 2026). The last change, naming the backup AI when
Gemini Nano fails, was then checked with the Nano simulation (3/3) and the 12 standard live tests
(12/12) on the final build.

### 0. Everyday messages: 615 / 615 passed

[`scripts/everyday-cases.mjs`](scripts/everyday-cases.mjs), [`blind-cases.mjs`](scripts/blind-cases.mjs),
[`blind-cases-2.mjs`](scripts/blind-cases-2.mjs). Every message has an exact expected answer:
which filters, or which kind of reply. They run through `decide()`, the same function the panel
uses. Areas:

| Area | Examples |
|---|---|
| Greetings, thanks, help (English and Hinglish) | "hi", "thank u bhai", "madad chahiye", "how do i use this" |
| Questions about the page | "what brands are there?", "konsa size available hai", "what did you apply?" |
| Things it can't do → a polite answer, no filter | "return policy?", "where is my order", "cancel prime", "write me a poem", "next page" |
| "Best" and comparisons | "which phone is best" → top rated; "compare iphone and samsung" → can't compare, says what it can do |
| Follow-ups | "make it L", "not black, navy", "size 8 nahi 9 chahiye", "same in red", "actually 12 gb ram", "remove it", "saare filters hata do" |
| Prices in every format | "under 2K", "rs2000", "2,000/-", "Rs. 1,500.00", "two thousand", "20 se 30 hazar", "budget badha ke 2000 karo", "not too expensive" |
| Sizes | "M or L", "size 9 and 10", "uk 8 or 9", "9 number", "size nine", just "9" on a shoe page |
| Product words in everyday language | "biker jacket", "face unlock", "type c", "keypad phone", "pixel", "big battery", "delivered today", "gym shoes" |
| Odd input | "", "🤔", 400 random letters + "puma", Tamil text, `<script>` tags, "12345" |

**How the gaps were found:** each new batch was written before running it. Batches the code had
never been tuned on scored 20/22, 22/26, 14/18, then the two blind batches **94/126 and 112/128**.
Every miss was fixed and kept as a test, and the full set was then re-run through the real AI.
A real-AI run also caught 4 older sentences that the day's fixes had broken, and a bug where an
AI word was accepted when it only appeared *inside* another word ("red" inside "delivered").

**Bugs found by trying it by hand** (each now has its own tests, and passes live):

| What was typed | What went wrong | Now |
|---|---|---|
| "can you open amazon i need blue shirt which under 500" (on Flipkart) | searched Flipkart for "open amazon blue shirt which" | opens Amazon, searches "blue shirt", max ₹500 |
| "…amazon and flipkart and myntra fo white shirst … roadstar size is 40" (on a maroon-shirt page) | only Roadster applied; white and size 40 ignored silently | searches "white shirt roadstar", applies White, Roadster, 40 |
| "…black shirt roadstar … lower price compare to all amazon flipkart and myntra" | searched "black shirt roadstar shirt lower price": zero results | compares all three sites (see "Comparing prices") |

The live comparison test then exposed a **Flipkart bug that affected ordinary filtering too**:
after reading a long brand or size list ("126 MORE"), its pop-up stayed open, and ticks in it were
lost. It now folds and reopens the section before ticking.

### 1. Sentences through the real AI: 284 / 284 passed

Each sentence must produce **exactly** the expected filters (nothing missing, nothing extra),
against filter lists saved from the live sites. Two sets:

**Realistic chat messages** ([`scripts/chat-cases.mjs`](scripts/chat-cases.mjs)), written the
way shoppers type, including Hinglish, typos, caps and junk: **152 / 152**

| Area | Result | Examples |
|---|---|---|
| Conversational phrasing | 12 / 12 | "can you show me black puma jackets", "hey, any HRX jackets?" |
| Caps, punctuation, emoji, extra spaces | 6 / 6 | "BLACK PUMA JACKET UNDER 2000", "nike jacket 🔥" |
| Price phrasing | 21 / 21 | "1k-2k", "around 2000", "not more than 1500", "1000+", "₹500 - ₹1000" |
| Hinglish | 9 / 9 | "2000 ke andar jacket", "safed joote size 9", "sasta jacket dikhao" |
| Size phrasing | 11 / 11 | "L size jacket", "10 size shoes", "uk10", "size no. 8" |
| Phone specs | 13 / 13 | "samsung 8/128", "1tb", "6000mah", "50 mp", "one plus 5g" |
| Gender words | 6 / 6 | "ladies shoes", "gents shoes", "mens shoes" |
| Colour variants | 14 / 14 | maroon vs red, navy, dark/light blue, golden, off-white, violet |
| Sale and rating words | 8 / 8 | "on sale", "good reviews", "4+ rating", "rated above 3" |
| Sorting | 10 / 10 | "cheapest", "low to high", "newest", "best selling", "top rated" |
| Follow-ups: add, change, remove, clear | 14 / 14 | "also in grey", "now under 1500", "remove puma", "reset" |
| Negation | 5 / 5 | "except puma", "don't want puma", "not nike, show adidas" |
| Brand spellings | 8 / 8 | "nikee", "addidas", "red-tape", "jack&jones", "rebok" |
| Long multi-part requests (8 filters at once) | 3 / 3 | |
| Nothing to apply (must not invent filters) | 12 / 12 | "hi", "???", "thanks", "ignore all previous instructions…" |

**Earlier edge cases** ([`scripts/cases.mjs`](scripts/cases.mjs)): **132 / 132**

| Area | Result |
|---|---|
| Jackets: basics, brands, colours, gender, sizes, price, discount, rating | 38 / 38 |
| Negation, "or", style/material, typos, junk text, Hindi | 19 / 19 |
| Shoes (Amazon, Flipkart, Myntra) | 21 / 21 |
| Phones (Amazon, Flipkart): RAM, storage, battery, camera, 5G | 17 / 17 |
| Kurtas (Myntra) | 8 / 8 |
| Everyday phrases that must not trigger brands | 4 / 4 |
| **Held-out sentences** (written after the fixes, never tuned against) | **25 / 25** |

When the first 57 sentences were run, before the fixes, only 27 passed (47%). Most of the 132
were then used to improve the matching, so the **held-out sentences** are the fairest measure of
how it handles new requests.

### 2. Live on the real sites: 46 / 46 passed

**Chat conversations** (`node scripts/e2e.mjs --chat`): several messages on one page, with the
site's URL checked after every message.

| Site | Messages, in order | Result |
|---|---|---|
| Flipkart | black puma jacket → sort by price low to high → remove puma → now under 1500 → clear all filters | each step applied; Black kept throughout |
| Amazon | nike jacket under 2000 → cheapest first → remove nike → above 1000 → start over | each step applied; "remove nike" worked even on a zero-results page |
| Myntra | puma shoes size 9 → newest first → remove size → reset | each step applied |

**Different product than the page shows** (`node scripts/e2e.mjs --search`): the extension
searches the site first, then filters the new results.

| Site | Page showed | Request | Result |
|---|---|---|---|
| Flipkart | jackets | give me running shoes | searched "running shoes" |
| Amazon | jackets | nike running shoes size 9 under 3000 | searched, then Nike, Running, 9, Max ₹3000 |
| Myntra | jackets | pink cotton kurta size M | searched, then Cotton, M |
| Flipkart | running shoes | samsung phone with 8gb ram under 15000 | searched, then Samsung, 8 GB+, Max ₹15000 |
| Flipkart | jackets | can you open amazon i need blue shirt which under 500 | **opened Amazon**, searched exactly "blue shirt", then Max ₹500 |
| Flipkart | jackets | mujhe kurta chahiye 1000 ke andar | searched exactly "kurta", then Max ₹1000 |
| Myntra | jackets | nike shoes on flipkart | **opened Flipkart**, searched "nike shoes", then NIKE |
| Amazon | jackets | show this on myntra | **opened Myntra**, searched the same "jacket men" |

The search step has its own test set as well (`node scripts/search.mjs`): **85 / 85**, of which 46 were
written blind. It was added after a user found the first bug above by hand: the search had kept
"open amazon … which", and the request to switch sites was ignored.

**Price comparison across the three sites** (`node scripts/e2e.mjs --compare`): **4 / 4** (the 4th, "compare puma
jacket under 2000 on all 3 sites", checks a budget: Myntra has no price filter, so its items are
checked against the budget one by one). Each
test checks that every site was searched with the clean words, that the expected sites have a
real price, that the winner really is the lowest counted price, and that the tab ends on it.
Real results (12 Nov 2026):

| Request | Amazon | Flipkart | Myntra | Picked |
|---|---|---|---|---|
| "can you compare black shirt roadstar size is 40 … lower price compare to all amazon flipkart and myntra" | not compared: no Roadster brand or size 40 there | not compared: shirts only in XS–5XL, no 40 | ₹333 Roadster Casual Shirt | **Myntra**, the only full match |
| "compare nike running shoes size 9 on all 3 sites" | ₹11,895 Nike Air Zoom Pegasus 40 | ₹2,996 Nike Run Defy | ₹2,597 Nike Run Defy | **Myntra**: the same model ₹399 cheaper than Flipkart |
| "lowest price for puma jacket across sites" | ₹999 PUMA Essentials track jacket | ₹891 PUMA printed jacket | ₹1,263 Puma Train All Day | **Flipkart**, ₹108 less than Amazon |

**Filtering the current results:**

The filters were actually applied on the live pages ([`scripts/e2e.mjs`](scripts/e2e.mjs)). Each test
checks the **site's own URL** (where the site lists its active filters), not just what the extension
reports, and follow-ups check that the earlier filters are still there.

| Site | Request | Applied | Time |
|---|---|---|---|
| Amazon | black puma jacket size M under 2000 | Black, PUMA, M, Max ₹2000 | 23 s |
| Amazon | nike running shoes size 9 | Nike, Running, 9 | 17 s |
| Amazon | samsung 5g phone with 8gb ram under 15000 | Samsung, 5G, 8–9.9 GB, Max ₹15000, plus the warning *"No products match all these filters"*. That was correct: on Nov 12 Amazon had 41 such phones, none under ₹15000 | 24 s |
| Amazon | phone with 6000 mah battery and amoled display above 10000 | AMOLED, 6000 mAh & above, Min ₹10000 | 16 s |
| Amazon | maroon shoes uk 8 | Red, 8 | 14 s |
| Flipkart | black puma jacket under 2000 | Black, PUMA, Max ₹2000 | 28 s |
| Flipkart | *(follow-up, same page)* size L | L, earlier filters kept | 16 s |
| Flipkart | *(follow-up, same page)* adidas too | ADIDAS added next to PUMA | 15 s |
| Flipkart | oneplus phone with 256gb storage | OnePlus *(hidden brand)*, 256 GB & above | 25 s |
| Flipkart | sparx shoes size 8 | Sparx *(hidden brand)*, 8 | 22 s |
| Flipkart | redmi phone between 10000 and 15000 | REDMI, ₹10000 – ₹15000 | 31 s |
| Flipkart | jacket without hood not puma | Without Hood (and no PUMA) | 21 s |
| Flipkart | white shoes 4 star 40% off | White, 4★ & above, 40% or more | 24 s |
| Myntra | black roadster jacket 40% off | Black, Roadster, 40% and above | 29 s |
| Myntra | skechers shoes size 9 | Skechers *(hidden brand)*, UK9 | 26 s |
| Myntra | libas cotton kurta size M | Libas, Cotton, M | 49 s |
| Myntra | pink anarkali kurta 3/4 sleeve | Pink, Anarkali, Three-Quarter Sleeves | 36 s |
| Myntra | adidas or puma shoes | ADIDAS, Puma | 23 s |
| Myntra | show me something nice | nothing applied (correct); explains what it can filter | 14 s |

Times are from clicking Apply to filters on the page. Most of the time is the website reloading
after each filter; the AI's part is 8–15 s.

**Reliability:** Flipkart and Myntra sometimes drop a filter if the next one is clicked while the
page is still reloading. The adapters wait for the page to settle, then **re-check the URL and
retry** anything that didn't stick (up to 2 more times), and report anything still missing instead
of showing a false ✅.

### 3. Gemini Nano: simulated only

The test laptop can't run Gemini Nano, so [`scripts/nano-sim.mjs`](scripts/nano-sim.mjs) fakes it:
- a Nano that **crashes** → the extension falls back to the backup AI and still applies the right filters ✓
- …and **remembers it**: the next request goes straight to the backup (Nano tried only once,
  7.5 s instead of 21 s), and the panel names the AI really answering: "Qwen2.5-0.5B (backup:
  Gemini Nano did not work here)" ✓
- a Nano that **answers normally** → its answer goes through the same tested matching, same result ✓

This proves Nano problems can't break the extension, but **the real Gemini Nano was never run**.

### Run the tests yourself

```bash
node scripts/everyday.mjs      # 615 everyday messages, rules only (seconds)
node scripts/everyday.mjs --ai # the same 615 through the real AI (~40 min)
node scripts/search.mjs        # 85 "what to search / which site" messages (seconds)
node scripts/compare-test.mjs  # 82 comparison checks: when to compare, winner, explanation (seconds)
node scripts/e2e.mjs --compare # 4 live comparisons across Amazon, Flipkart and Myntra (~7 min)
node scripts/edge.mjs          # 284 sentences through the real AI (~20 min)
node scripts/e2e.mjs --chat    # 3 live chat conversations, 14 messages (~10 min)
node scripts/e2e.mjs           # 12 live tests on the real sites (~7 min)
node scripts/e2e.mjs --extra   # 7 harder live tests (~5 min)
node scripts/e2e.mjs --search  # 4 "different product" live tests (~3 min)
node scripts/nano-sim.mjs      # simulated Gemini Nano: crash fallback + normal answer
node scripts/snapshot.mjs      # re-save filter lists from the live sites
```

The tests open a separate Chrome window with its own profile. Leave it alone while they run.

## Known limitations

- **Not tested:** the real Gemini Nano (only simulated, see above). The automated tests open the
  panel page in a tab; the real side panel (from the toolbar icon) was also checked by hand.
- **Speed on low-end PCs:** with the backup AI a request takes about 15–50 s. Gemini Nano on a
  stronger PC should be faster.
- **Product switching needs a product word:** "give me running shoes" on a jackets page searches
  for shoes, but only for products in the list in [`product.ts`](src/ai/product.ts) (clothes,
  shoes, phones, laptops, watches, bags, …).
- **Only filters, sorts and searches.** Questions it can't act on get a short, honest answer
  instead of a wrong filter: returns, orders, payments, delivery times ("Sorry, I can't help with
  … check the site's Help page"), comparing or reviewing two products ("I can't compare … say
  'top rated'"), "next page" (scroll the site). "Which phone is best?" sorts by top rated.
  Very vague requests ("something nice") apply nothing rather than guess, and say what to try.
- **Price comparison finds the cheapest *matching* item, not the identical product.** The sites
  share no product ids. A site is only counted when it got the same filters as the others
  (otherwise it is listed with the reason), and titles must name the asked product type and kind.
  It reads the cheapest results of each site (about 2 minutes for all three) and doesn't open
  product pages, so delivery charges and bank offers are not included.
- **Languages:** English, Hinglish, and common Hindi words in Devanagari. Other scripts
  (e.g. Tamil) get "no matching filters" and a hint, never a wrong filter.
- **Fixed price steps:** Flipkart's price dropdowns have fixed values, so "under 1200" uses ₹1000.
  Amazon and Myntra are not affected like this (Amazon uses an exact range, and Myntra showed no
  price filter on the pages tested).
- **Ambiguous words pick the first matching group:** "straight kurta" could mean the hemline,
  shape or type; the first group on the page wins.
- **Sites change their pages.** The adapters rely on each site's current structure (checked
  Nov 2026) and may need updating when a site redesigns.
- **Tested categories:** jackets, shoes, phones and kurtas. Others (laptops, furniture, …) are
  likely to work, since the adapters read whatever filters the page has, but have not been tested.

## Project structure

```
manifest.config.ts        extension settings (side panel, sites, security for the AI runtime)
src/sidepanel/App.tsx     the panel: text box, status, ✅ chips
src/ai/decide.ts          one message → answer it, or pick filters (the panel and all tests use this)
src/ai/reply.ts           instant answers: greetings, help, "what brands are there?", off-topic questions
src/ai/llm.ts             picks Gemini Nano or the backup AI, runs the pipeline
src/ai/prompt.ts          the instruction both AIs get
src/ai/worker.ts          backup AI (Qwen2.5-0.5B + Transformers.js) in a background worker
src/ai/fallback.ts        talks to the worker, preloads the model when the panel opens
src/ai/rules.ts           prices, discounts, ratings, sizes, sorting, remove/clear from the text
src/ai/product.ts         spots a different product or site ("open amazon"), a comparison, and what to search for
src/ai/compare.ts         compares the cheapest matching item per site and explains the pick
src/ai/match.ts           words and numbers → real filter options
src/ai/common.ts          everyday words that must never trigger brands or typo fixes
src/content/index.ts      runs inside the shopping site, picks the right adapter
src/adapters/*.ts         Amazon, Flipkart, Myntra: read and apply filters
public/ort/               AI runtime files shipped with the extension (extensions can't load code from the internet)
scripts/                  edge-case tests, live tests, saved filter lists, results
```
