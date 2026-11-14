// Opens a Chrome window with the built extension installed (and the AI model already cached from
// the tests) on a shopping page, for trying it by hand. Close the window to stop.
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import os from 'node:os'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: true, defaultViewport: null,
  userDataDir: path.join(os.tmpdir(), 'ai-shopping-filters-e2e-profile'),
  args: ['--start-maximized'],
})
const extId = await browser.installExtension(path.resolve('dist'))
const [first] = await browser.pages()
const page = first ?? (await browser.newPage())
await page.goto(process.argv[2] ?? 'https://www.flipkart.com/search?q=jacket+men', { waitUntil: 'domcontentloaded' })
console.log(`Chrome is open with the extension (${extId}). Close the window when you are done.`)
browser.on('disconnected', () => process.exit(0))
