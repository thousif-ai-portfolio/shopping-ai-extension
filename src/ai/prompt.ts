// The instructions given to the on-device AI (Gemini Nano).
// The AI only picks out descriptive words; prices, discounts, ratings, sizes and number+unit
// values are read by rules.ts and match.ts, which are more reliable for those.
export const SYSTEM =
  'List the words in the shopping request that describe brand, colour, material, fit, gender, style or features. ' +
  'Reply with only those words, separated by commas. Leave out the product type, prices and numbers.'
export const EXAMPLE_IN = 'red nike running shoes for women under 3000'
export const EXAMPLE_OUT = 'red, nike, running, women'
