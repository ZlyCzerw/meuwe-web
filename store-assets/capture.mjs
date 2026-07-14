// Capture a fresh Rzeszów map screenshot (Polish UI, live PROD data) for the
// store frames. Shows the new same-zone cluster count badge. Requires the dev
// server running on :5173 (npm run dev). Output: public/screenshots/map-rzeszow-pl.png
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'

const OUT = '/Users/wiktormarc/meuwe-web/public/screenshots/map-rzeszow-pl.png'
const URL = 'http://localhost:5173/?lat=50.0413&lng=21.999&zoom=13'
const SYS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function launch() {
  const base = { headless: 'new', args: ['--allow-file-access-from-files', '--lang=pl'] }
  try {
    return await puppeteer.launch(base)
  } catch (e) {
    if (!existsSync(SYS_CHROME)) throw e
    console.log('bundled Chromium failed, falling back to system Chrome:', e.message)
    return await puppeteer.launch({ ...base, executablePath: SYS_CHROME })
  }
}

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl' })
await page.evaluateOnNewDocument(() => localStorage.setItem('i18nextLng', 'pl'))
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
// Wait for at least one map marker to render, then let tiles + fonts settle.
await page.waitForSelector('.meuwe-icon', { timeout: 30000 }).catch(() => console.log('no .meuwe-icon yet'))
await page.evaluateHandle('document.fonts.ready')
await sleep(2500)
await page.screenshot({ path: OUT })
await browser.close()
console.log('captured', OUT)
