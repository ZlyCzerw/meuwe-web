// Render the HTML frames from store-assets/_build/manifest.json to PNGs at exact
// pixel dimensions (logical w/h x deviceScaleFactor 2). Run `node gen.mjs` first.
import puppeteer from 'puppeteer'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const ROOT = '/Users/wiktormarc/meuwe-web/store-assets'
const SYS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const manifest = JSON.parse(readFileSync(`${ROOT}/_build/manifest.json`, 'utf8'))

async function launch() {
  const base = { headless: 'new', args: ['--allow-file-access-from-files'] }
  try { return await puppeteer.launch(base) }
  catch (e) {
    if (!existsSync(SYS_CHROME)) throw e
    console.log('bundled Chromium failed, using system Chrome:', e.message)
    return await puppeteer.launch({ ...base, executablePath: SYS_CHROME })
  }
}

const browser = await launch()
for (const f of manifest) {
  const out = `${ROOT}/${f.out}`
  mkdirSync(dirname(out), { recursive: true })
  const page = await browser.newPage()
  await page.setViewport({ width: f.w, height: f.h, deviceScaleFactor: 2 })
  await page.goto(`file://${f.html}`, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.evaluateHandle('document.fonts.ready')
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: out })
  await page.close()
  console.log('rendered', f.out, `${f.w * 2}x${f.h * 2}`)
}
await browser.close()
console.log('done')
