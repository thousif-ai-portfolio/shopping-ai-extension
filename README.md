# AI Shopping Filters

A general-purpose AI shopping assistant for Chrome: it applies shopping filters on **any shopping
site** from plain English, using an AI model that runs **entirely on your computer**: no server,
no API key, no cost. It is not tied to particular shops: a generic reader handles every site, and
Amazon, Flipkart and Myntra additionally get dedicated adapters for extra reliability.

Open a search on **any shopping site**, open the side panel and type, for example:

> black puma jacket size M under 2000

The extension reads the filters the page offers, works out which ones you mean, and ticks them
on the page for you:

> ✅ Colour: Black  ✅ Brands: PUMA  ✅ Size: M  ✅ Max price: ₹2000

It works like a chat: follow-up messages refine the same page. The panel shows the conversation
(your messages on the right, answers with ✅ filter chips on the left); Enter sends.

> **This is the lite build** (branch `nano-only`, ~100 KB). It uses Chrome's built-in Gemini Nano
> where the PC supports it, and the tested rules alone where it doesn't. The full build on `main`
> also ships its own backup AI (Qwen2.5-0.5B, 6.6 MB package) for PCs without Gemini Nano.

| You type | What happens |
|---|---|
| `black puma jacket under 2000` | adds Black, PUMA, max ₹2000 |
| `cheapest first` | ↕ sorts by price, low to high |
| `make it size L` · `now under 1500` | adds size L · changes the max price |
| `remove puma` · `remove the brand filter` | 🗑 takes PUMA off · takes all brands off |
| `clear all filters` / `start over` / `reset` | 🗑 removes every filter |
| `give me running shoes` (on a jackets page) | searches the site for running shoes first |
| `open amazon, i need a blue shirt under 500` · `show this on myntra` | opens that site, searches, then filters |
| `open nykaa.com, red lipstick` (any shop by its address) | opens that address, searches it, then filters |
| `open ajio, red kurta` · `open blinkt i need bread` (about 40 well-known shops, small typos too) | opens that shop, searches it, then filters |
| `open kalki fashion website` (a shop not on that list) | says it can't open it by name: open it yourself or type its address (addresses are never guessed: a misspelt name could lead to a fake site) |
| `hi` · `what brands are there?` · `what did you apply?` | answers in the chat, applies nothing |
| `return policy?` · `where is my order` | says politely that it only filters, sorts and searches |

| `compare running shoes on all sites` · `compare puma jacket on ajio and snapdeal` · `lowest price on all 3 sites` | 🔍 searches every shop selling that product (or the shops named, or Amazon, Flipkart and Myntra for "3 sites") with the same filters, cheapest first, and says which is cheapest and by how much |

### Comparing prices across shops

Which shops are compared:

- **Shops named** ("compare puma jacket on ajio and snapdeal", "nykaa vs purplle"): those; with one
  shop named ("compare with ajio"), that one and the shop open now.
- **"all 3 sites"**: Amazon, Flipkart and Myntra.
- **Otherwise** ("compare …", "across sites", "compare all", "everywhere"): Amazon, Flipkart, Myntra and
  every well-known shop selling that kind of product (clothes and shoes: Ajio, Snapdeal, Tata CLiQ,
  Shoppers Stop, Westside, Meesho; electronics: Croma, Reliance Digital, Vijay Sales, Tata CLiQ;
  beauty: Nykaa, Purplle; home: IKEA, Pepperfry; …), plus the shop open now.

Then the extension:

1. searches each shop for the same words (request words, shop names, prices and sizes removed),
2. applies **the same filters** on each (brand, colour, size, price) and sorts **cheapest first**,
3. reads the cheapest results (and the unsorted ones: some shops pad a cheapest-first list with
   socks) and checks each title really is what was asked: the right product type ("sliders" are not
   running shoes), the right kind ("running", "casual"…), and every other word searched for, such as
   the brand ("puma jacket" never picks a cheaper NEONOMAD jacket),
4. opens the **cheapest site's results** and explains the choice, for example (illustrative; real
   runs are in the test results below):

> **Picked Myntra: ₹333, which is ₹45 less than Flipkart.**
> • Myntra: ₹333, Roadster Casual Shirt ✅ cheapest
> • Flipkart: ₹378, Roadster Men Solid Casual Shirt (₹45 more)
> • Amazon: ₹236, Youth First Shirt. *Not compared: its brand filter couldn't be applied there, so this may be a different item*

A site is only compared when it got every filter the others got. Otherwise it is listed with
the reason, never silently counted. The sites share no product ids, so this finds the **cheapest
matching item on each site**, not necessarily the identical product. It takes about 45 seconds a
shop (one after another, in the same tab; the panel shows how long is left), at most 2 minutes for
any one shop.

If the filters together match no products, the panel warns: *"No products match all these
filters. Try 'remove …', a higher budget, or 'start over'."*

## Task requirements

| Requirement | How it is met |
|---|---|
| Works on at least 3 shopping sites | Works on **any** shopping site: the generic adapter, tested live on 27+ shops (Ajio, Decathlon, Snapdeal, Tata CLiQ, Croma, IKEA, …), plus dedicated adapters for Amazon.in, Flipkart and Myntra |
| Detects filters and applies them from what you type | The adapter reads every filter on the page (including the full "+ more" brand lists) and applies the chosen ones |
| Powered by a client-side LLM | Chrome's built-in **Gemini Nano** (on-device). Where a PC can't run it, the same tested rules work alone |

## Install

1. Build it (needs Node.js):
   ```bash
   npm install
   npm run build
   ```
2. In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and
   choose the `dist` folder.
3. Open a search on any shopping site, then click the extension icon. (Tabs that were already
   open before installing need a reload once.)

Or load the ready-made zip: unzip it and choose that folder in step 2. The panel is ready as soon
as it opens; there is nothing to download.

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
- Otherwise, or if Nano fails, **the rules work alone**: prices, sizes, sorting and every filter
  named in the message still apply, instantly. Only vaguer wording, which needs the AI, is missed.
- Nano gets a short instruction ([`src/ai/prompt.ts`](src/ai/prompt.ts)): *list the descriptive
  words*. A tiny answer such as `black, puma` is much faster than a full JSON answer.
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
| **Any other site** ([`generic.ts`](src/adapters/generic.ts)) | General patterns, no code for any one shop: checkboxes / radios (real or ARIA) under a heading, `<fieldset>`, an accordion header (`aria-labelledby`) or a title-and-body section (generated class names); facet links; plain clickable options; `<select>` filters. It opens what hides them first: collapsed sections and icon toggles, "Show more" / "+ 21 More", "MORE" pop-ups with an Apply button (brands, colours, sizes), a "Filters" button that opens a drawer or dialog, filter bars of dropdowns or pop-ups, and tabbed filter dialogs. Sort from a `<select>`, radios, a sort tab, a menu button, a custom select box or plain clickable text. Price from min/max boxes (also inside a dropdown), discount and price range lists, and sliders (dragged, native range inputs set by value, or ARIA sliders by keyboard). Ignores cookie banners, product-card buttons and slider scale marks | Clicks one at a time, reading the page again after each, and presses the panel's own Apply where there is one. If a click reloads the page, the rest is applied on the new page (capped at 6 reloads). Prices typed in the page's own currency (₹, $, €, £); when a shop needs both price boxes, the other side gets its widest value |

Amazon, Flipkart and Myntra keep their own adapters (they know those sites exactly); every other
site uses the generic one. Search on other sites uses the site's own search form, else `?q=` on
the current results page, else `/search?q=`. The price comparison covers any of these shops (see above).

## Test results

### Works on any site: final verification (21 Nov 2026)

The any-site reader ([`generic.ts`](src/adapters/generic.ts)) has **no code for any one shop**: it
recognises general patterns (see "Site adapters" above). Each real shop below is a test sample of
those patterns; when one failed, the pattern was generalised, never special-cased. Everything was
run live, in a separate Chrome profile, on the final build.

**1. Ten common filter types on 27 real shops** (`live-shops`, 270 live requests). ✓ = applied on
the live page; · = the shop has no such filter there, and the panel says so in plain words
("No size M on this page (sizes here: …)", "I couldn't find a sort option on this page").

| Shop | Price | Brand | Colour | Size | Rating | Discount | Cheapest | Newest | In stock | Material |
|---|---|---|---|---|---|---|---|---|---|---|
| Ajio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · |
| Decathlon | ✓ | · | ✓ | · (shoe sizes) | ✓ | ✓ | ✓ | · | ✓ | · |
| Lifestyle, Max | ✓ | · | ✓ | ✓ | · | ✓ | ✓ | ✓ | · | ✓ |
| Snapdeal | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · |
| Tata Cliq | ✓ | ✓ | ✓ | · (UK sizes) | · | ✓ | ✓ | ✓ | · | · |
| Bewakoof | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · |
| Nike | ✓ | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | · | ✓ |
| Westside | ✓ (slider) | · | ✓ | ✓ | · | · | ✓ | ✓ | · | ✓ |
| Reliance Digital | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | · |
| Croma | ✓ | · | · | · | · | ✓ | ✓ | ✓ | · | · |
| Lenskart | ✓ | · | ✓ | ✓ (frame size) | · | · | ✓ | ✓ | · | · |
| Souled Store, Vastrado, Allbirds, Urbanic, Zara, Puma, IKEA, Pepperfry | colour, size, sort, price or material where the shop has them | | | | | | | | | |
| Nykaa, Purplle, boAt | sort (and the filters their pages offer) |
| Zepto, JioMart, BigBasket, Instamart | grocery pages: no such filters; every request answered "not on this page" | | | | | | | | | |

**2. Each shop's own filters, asked in plain words** (`scripts/extra-filters.mjs`: reads every
filter group a shop has and asks for options outside the ten common types): **39 / 43 applied**
on 20 shops, e.g. Croma "wireless headphone" → Device Type, IKEA "medium firm" → Firmness,
Bewakoof "oversized fit" → fit, Nike "american football" → Sports, Snapdeal "lace up" → Closure,
Amazon "top brands", Reliance "rockerz" → Series, Ajio "day wear" → vibes. Of the 4 others, 2 were
the product the page already shows ("jeans" on a jeans page), 1 was "new" (read as newest first),
1 (Puma "sports shoes") was a bug, fixed and passing live. Rerun on the final build: 39 / 43 again,
with Puma passing and one Reliance read that came back empty under load (passes on its own).

**3. The 45 everyday requests** (price, brand, colour, size, rating, discount, sorting, stock,
category, material) live on Amazon, Flipkart, Myntra, Ajio and Decathlon: every filter a shop offers
applied; every other request answered plainly (e.g. Amazon has only "4 Stars & Up", Myntra's jacket
page has no price filter, out-of-stock items are already hidden).

**4. Regression on the final build:** everyday messages **965 / 965** (incl. the 45 requests on 6 shops, 30 everyday-chat turns and the live IKEA/Croma/Snapdeal/Ajio filter lists) · search **160 / 160** · comparison **103 / 103** · local test shops **66 / 66** (now incl. sliders, sort menus, tabbed dialogs, MORE pop-ups and an open cookie banner) · sentences in the built extension **284 / 284** · live on Amazon, Flipkart, Myntra and Ajio: standard **12 / 12**, chat **14 / 14**, everyday chat in English and Hinglish **24 / 24**, harder cases **7 / 7**, new product / other site **9 / 9**, price comparison across shops **4 / 4**.

**Shops that block automated browsers** (could not be tested here; may work in a normal Chrome):
H&M, Uniqlo and Adidas ("Access Denied" to the test browser), Meesho (no page content).

**Fixed on 20 Nov 2026** (checked live): Lenskart frame colour and price (its dialog is closed and
opened again when its panels don't draw), Westside's price slider (one step, then its address with
the budget), Urbanic's picture-only colours (named from the page's own data).

**Fixed on 21 Nov 2026:** a cookie script that marks the whole page (`<html class="show--consent">`)
made the reader skip everything on it (Lenskart read no filters while its banner showed); the page
itself no longer counts as a cookie box, and a consent dialog is never read as filters. The panel
now gives up on reading filters after 2 minutes ("reload and try again") instead of waiting forever. Westside "between ₹1,000
and ₹2,000" sometimes kept only the maximum (the two slider ends raced each other's page loads);
the second end now waits for the first page load (3 / 3 live with both ends).

**Fixed on 22 Nov 2026 (found by hand):** "i need hrx white shirt from ajio" on another shop searched
that shop for "hrx white shirt ajio"; a known shop named after "from/on/at" (or before "pe/par/se")
now opens that shop and searches there. "open H and m" was split at "and"; it now opens H&M. A shop's
"Access Denied" page no longer ends in "Done ✅": the panel says the site is blocking the browser.

**Known gaps** (the panel says so; it never applies something wrong):
- Nike (nike.in) colour buttons do nothing even with a real mouse click: the shop's own colour
  filter does not work, so the panel doesn't offer it.
- A price range list is only ticked where a range fits inside the budget (Croma "₹1,000–2,000"
  ticks "1,001–1,500", not "1,501–3,000").


### Earlier results (18 Nov 2026)

**"Any site" change, final build (18 Nov 2026, comparison across shops included), same laptop without Gemini Nano (rules alone):**

| Test | Result |
|---|---|
| Everyday messages, now including 38 written for other shops (₹, $, €, star ratings, "8 - eu 42" sizes, "Men's …" options) and 40 written **blind** by a separate reviewer (colour typos, "size is L", missing sizes, $/€ decimals), plus 45 common requests (price, brand, colour, size, rating, discount, sorting, stock, category, material) on 4 shops' pages | **875 / 875** |
| What to search for / which site (`scripts/search.mjs`), incl. 40 new **blind** cases (shops by name or address, typos, Hinglish) and the final review's cases ("usb cable", "switch to puma", "open ajio red kurta") · price comparison (incl. which shops for each message) | **160 / 160** · **103 / 103** |
| Filter sentences inside the built extension (`scripts/edge.mjs`) | **284 / 284** |
| Live, other shops: Decathlon, Ajio, Allbirds read and one filter ticked (`scripts/generic.mjs`) | **3 / 3** |
| Six local test shops (now with a size "L" shown next to its item count), a browser page, a shop address that does not load, and product names and prices | **52 / 52** |
| Live on Amazon, Flipkart and Myntra, final build: standard · chat · harder cases · new product / other site · price comparison | **12/12 · 14/14 · 7/7 · 9/9 · 4/4** |
| Live, the requests found by hand on Decathlon: "i need broen shirt size is L" · "open allbirds.com and show me wool shoes size 10" · "open udemy" | Brown + size L · opened Allbirds, wool + size 10 · opened Udemy |
| Live, 36 real shops by name (`scripts/any-site.mjs`, table below) | **36 / 36** behave as described |
| Live comparisons across shops (`scripts/compare-live.mjs`): "puma jacket on ajio and snapdeal" · "headphones under 2000 everywhere" (7 shops) · "running shoes on all sites" (10 shops) | Ajio ₹1,221 (a real Puma) · Amazon ₹69 · Flipkart ₹127, each shop's cheapest listed |

Four blind expectations were corrected after the run, each because it contradicted an earlier rule
or the saved page (marked "corrected after the run" in the case files: "and" is dropped from
search text like "for"; UK15 is in Myntra's size list; a page without Min/Max price groups has none
to remove). Every other failure the blind batches found was a real bug and was fixed: "L size kurta"
searched "l", "peace lily plant" searched "pant", "grown up" became Brown, "below 50 euros" kept
"euros" in the search, "between 40 and 70 dollars" lost the minimum, "over $150" picked no range,
Hinglish "tatacliq website pe" was not seen as another shop, typed addresses left "www" in the search.

Found by hand on 17 Nov ("can you open vastardo website and i need broen shirt size is L" on
Decathlon) and fixed: it searched Decathlon for "vastardo broen shirt"; Decathlon draws its filters
~4 s after loading, so the new results were read too early and nothing was applied, silently; and
"L <count>" was read as litres. Now: another shop named only by name gets an answer, colour typos are
fixed in the search ("brown shirt"), the extension waits for the filters to appear, and a size or
budget that can't be applied is always said ("No size L on this page (sizes here: …)").
Also found by hand the same day: "open insta mart i need egg" and "open udemy" (no "website" in
the message) were read as filters for the page. Now "open / go to / visit X" at the start of a
message, where X is not a product, a colour, a part of the page ("open the cart") or a filter on
the page ("open toe" sandals), opens that shop when it is a well-known one and otherwise gets the
"can't open by name" answer. All 1,184 test messages were checked for false alarms: none.

The final independent review (18 Nov) found 13 problems, all fixed with a case each: new product
words "corrected" ordinary ones ("usb cable" → table, "gold chain" → chair), "switch to puma" left
for puma.com, "men's" and "shoes." were cut into wrong words, a filter link could be lost on a slow
server, leftovers after a reload were read before the page drew its filters, a "Shop by category"
bar could be read as filter tabs, an old result could be taken for a new request, "₹499.50" became
49950 on Amazon, and a few smaller ones.

Flipkart sometimes drops one of several filters clicked in a row (e.g. "40% or more" in "white
shoes 4 star 40% off"; it passed in the final run). The unchanged previous code fails the same case
the same way when it happens, so this is the live site, not this change.

The six test shops (`scripts/test-shops/`) each build filters a different way, with traps:
checkboxes in fieldsets with hidden inputs, a sort `<select>` that lists "high to low" and
Shopify's "Alphabetically, A-Z" first, $ price boxes, a cookie banner, newsletter and "I agree"
checkboxes (checkboxes.html); ARIA checkboxes and radios in sections that only exist once
opened, "Show more", counts without brackets, a Tailwind `filter` class on a menu (aria.html);
filter links where every click reloads the page, € prices (links.html); filters in a modal that
a "Filters (0)" button opens, a `<select>` with a placeholder, a JavaScript-only search box
(drawer.html); a blog with a comment form (blog.html, must yield no filters); and a browser page
where the extension can't run (must say so, yet "open decathlon" must still work from there), and an
address that doesn't load (must be reported plainly).

Found by hand on 18 Nov: on Swiggy's "Access denied" page (Swiggy refuses the automated test
browser), "open nike" answered "Open a shopping site and reload the page". Going to another shop
needs nothing from the current page, so it now works from error pages, browser pages and blocked
sites; a shop that opens but can't be read is reported plainly instead of failing after a long wait.

**Any shop, live (final build, 18 Nov 2026):** from Decathlon's results page, "open <shop> i need <product +
filters>" typed into the real panel for 36 shops (`node scripts/any-site.mjs`):

| Result | Shops |
|---|---|
| Opened, searched and filters applied | Snapdeal (black, size 8) · Bewakoof (black, size L) · Croma (price ranges under ₹2000) · Westside (white, size M, tabbed drawer) · Puma (running, size 9, dropdown bar) · Vastrado (size L) · The Souled Store (size M) · Allbirds (wool, size 10) · Decathlon from Myntra (running, size 8) |
| Opened and searched (no filters asked) | Zepto · Instamart · BigBasket · JioMart · Reliance Digital · Lenskart · Pepperfry · IKEA · Shoppers Stop · boAt · Purplle · Uniqlo · H&M · Max Fashion · Udemy (opened) |
| Opened and searched; the asked size or price could not be found there, and the panel says so | Ajio · Tata CLiQ · Lifestyle · Urbanic · Zara · Nike · Adidas |
| Search box ignores a script: said so, nothing else touched | Blinkit · Firstcry · Vijay Sales |
| Filters could not be tested | Nykaa (its search lands on a page without filters; the panel says so) · Meesho (blocks automated browsers) |

**Lite build (16 Nov 2026), on a laptop without Gemini Nano, so the rules worked alone:**
everyday messages 617/617, search 86/86, price comparison 83/83, live on Amazon, Flipkart and
Myntra 12/12, simulated Gemini Nano 3/3. The zip was also loaded in a fresh Chrome profile.

The detailed results below were measured on the **full build** (with the backup AI), on a typical
laptop (Intel i3-1115G4, 8 GB RAM, Intel UHD graphics). The rules and site code are the same in
both builds.

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
- a Nano that **crashes** → the extension falls back to the rules alone and still applies the right filters ✓
- …and **remembers it**: the next request goes straight to the rules (Nano tried only once), and
  the panel says so: "Rules only (Gemini Nano is not available on this PC)" ✓
- a Nano that **answers normally** → its answer goes through the same tested matching, same result ✓

This proves Nano problems can't break the extension, but **the real Gemini Nano was never run**.

### Run the tests yourself

```bash
node scripts/everyday.mjs      # 875 everyday messages, rules only (seconds)
node scripts/everyday.mjs --ai # the same 875 inside the built extension (Gemini Nano if the PC has it)
node scripts/search.mjs        # 126 "what to search / which site" messages (seconds)
node scripts/compare-test.mjs  # 83 comparison checks: when to compare, winner, explanation (seconds)
node scripts/e2e.mjs --compare # 4 live comparisons across Amazon, Flipkart and Myntra (~7 min)
node scripts/edge.mjs          # 284 sentences inside the built extension (written for the AI; without
                               # Gemini Nano, vaguer ones are expected to miss)
node scripts/e2e.mjs --chat    # 3 live chat conversations, 14 messages (~10 min)
node scripts/e2e.mjs           # 12 live tests on the real sites (~7 min)
node scripts/e2e.mjs --extra   # 7 harder live tests (~5 min)
node scripts/e2e.mjs --search  # 4 "different product" live tests (~3 min)
node scripts/nano-sim.mjs      # simulated Gemini Nano: crash fallback + normal answer
node scripts/snapshot.mjs      # re-save filter lists from the live sites
node scripts/everyday.mjs --generic # 73 messages on other shops' filter lists (₹, $, €; seconds)
node scripts/e2e.mjs --natural        # everyday chats in English and Hinglish, live on Flipkart, Amazon, Myntra, Ajio
node scripts/extra-filters.mjs "<name>|<url>" … > list.txt  # each shop's own filter groups, to ask for in plain words
node scripts/generic-shops.mjs # 6 local test shops: what is read + typed requests in the panel (~8 min)
node scripts/probe-generic.mjs <url> # debug: run the generic adapter on any page, with timings
node scripts/generic.mjs [url] # real shops (Decathlon, Ajio, Allbirds): read filters, tick one
node scripts/any-site.mjs [shop] # 36 real shops by name through the panel: open, search, filter (~30 min)
node scripts/compare-live.mjs  # 3 live comparisons across shops through the panel (~10 min)
```

The tests open a separate Chrome window with its own profile. Leave it alone while they run.

## Known limitations

- **Not tested:** the real Gemini Nano (only simulated, see above). The automated tests open the
  panel page in a tab; the real side panel (from the toolbar icon) was also checked by hand.
- **Without Gemini Nano, only the rules work:** brands, colours, sizes, prices and sorting named in
  the message apply instantly, but vaguer wording that needs the AI is missed. The full build on
  `main` covers those PCs with its own backup AI.
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
  It reads the cheapest results of each shop (about 45 s a shop) and doesn't open product pages,
  so delivery charges and bank offers are not included. A shop whose search box ignores a script
  (Vijay Sales, Blinkit) is listed as "couldn't check".
- **Languages:** English, Hinglish, and common Hindi words in Devanagari. Other scripts
  (e.g. Tamil) get "no matching filters" and a hint, never a wrong filter.
- **Fixed price steps:** Flipkart's price dropdowns have fixed values, so "under 1200" uses ₹1000.
  Amazon and Myntra are not affected like this (Amazon uses an exact range, and Myntra showed no
  price filter on the pages tested).
- **Ambiguous words pick the first matching group:** "straight kurta" could mean the hemline,
  shape or type; the first group on the page wins.
- **Other sites (generic adapter): works on shops built the common ways, not on every shop.**
  It reads checkboxes and radios (real or ARIA), filter links, `<select>`s, min/max price boxes,
  dropdown filter bars (Puma), tabbed filter drawers with an Apply button (Westside) and plain
  clickable options inside a filter panel, under a heading or the checkbox's own name. It opens
  collapsed sections, "Show more" lists and a "Filters" button first. Seen not to work, in the
  36-shop run (17 Nov): Nykaa sends searches to a landing page without filters; Meesho and Adidas
  block automated browsers (could not be tested); Blinkit, Firstcry and Vijay Sales ignore a
  script typing in their search box (the panel says so and asks you to search there yourself);
  Lifestyle's collapsed sections and Urbanic's search don't open from a script; Zara and Nike
  showed no size filter the extension could read. Two-handle price sliders are dragged (Decathlon, checked live 18 Nov);
  this assumes an even price scale, so a shop whose slider jumps in uneven steps can land a
  little off the budget. "MORE" pop-ups (Ajio) are read for brands, colours and sizes only, which
  adds about 10 s per request there; a discount or category option only in such a pop-up is not
  seen ("more than 50% off" picks Ajio's visible "40% and above"). Sort lists that open on a click
  (Decathlon) are read too. The extension never sorts by discount. On sites where every click reloads the page, the panel
  waits for the last reload (up to about 40 s) before saying what was applied.
- **Shops by name:** about 40 well-known shops open by name ("open ajio", "open blinkit", with
  small typos). Any other shop opens only by its address ("open shopname.com"); a name is never
  turned into a guessed address.
- **Permission:** to work on any site, the content script and host permission cover all http/https pages, so
  Chrome shows "Read and change all your data on all websites" when installing or updating.
  It only reads or clicks anything when you send a message from the panel on that tab. On
  update, Chrome turns the extension off for existing users until they accept the new permission.
- **Sites change their pages.** The adapters rely on each site's current structure (checked
  Nov 2026) and may need updating when a site redesigns.
- **Tested categories:** jackets, shoes, phones and kurtas. Others (laptops, furniture, …) are
  likely to work, since the adapters read whatever filters the page has, but have not been tested.

## Project structure

```
manifest.config.ts        extension settings (side panel, permissions, icons)
src/sidepanel/App.tsx     the panel: text box, status, ✅ chips
src/ai/decide.ts          one message → answer it, or pick filters (the panel and all tests use this)
src/ai/reply.ts           instant answers: greetings, help, "what brands are there?", off-topic questions
src/ai/llm.ts             asks Gemini Nano (or uses the rules alone), runs the pipeline
src/ai/prompt.ts          the instruction Gemini Nano gets
src/ai/rules.ts           prices, discounts, ratings, sizes, sorting, remove/clear from the text
src/ai/product.ts         spots a different product or site ("open amazon"), a comparison, and what to search for
src/ai/compare.ts         compares the cheapest matching item per site and explains the pick
src/ai/match.ts           words and numbers → real filter options
src/ai/common.ts          everyday words that must never trigger brands or typo fixes
src/content/index.ts      runs inside the shopping site, picks the right adapter
src/adapters/*.ts         Amazon, Flipkart, Myntra: read and apply filters
src/adapters/generic.ts   every other site: common filter patterns (see "Site adapters")
scripts/test-shops/       local test pages, one per way of building filters, with traps
public/icons/             extension icons, drawn from assets/icon.svg
store/                    Chrome Web Store listing text and privacy policy
scripts/                  edge-case tests, live tests, saved filter lists, results
```
