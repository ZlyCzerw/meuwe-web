// Capture fresh app screenshots (live PROD data) for the store frames.
// Requires the dev server running on :5173 (npm run dev).
//
//   node capture.mjs --lang=sl --shots=map,event,create,rzeszow
//   node capture.mjs --lang=en --shots=rzeszow
//
// The browser runs with a persistent profile (PROFILE below) so the Supabase
// session survives between runs. On the first run the window stays open until
// you log in by hand — the "+" button and the avatar only look right for a
// signed-in user. Nothing here types credentials.
//
// Output: public/screenshots/<file>-<lang>.png
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'

const ROOT = '/Users/wiktormarc/meuwe-web'
const OUT = `${ROOT}/public/screenshots`
const PROFILE = '/Users/wiktormarc/.meuwe-capture-profile'
const SYS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5173'

// Timeline: index 1 is today, so a day offset N sits at index N + 1.
const TODAY_IDX = 1
// Day offsets are chosen for pin density on live data (checked before running).
// Ljubljana peaks at +2, Rzeszów at +4; Tenerife is sparse whichever day you pick.
// `loc` fakes the device position. Without it the distance on an event card is
// measured from wherever this machine really is ("693 km od tebe" on a
// Ljubljana event), which reads as a bug in a local-events listing.
const LJUBLJANA = { lat: 46.056, lng: 14.508 }
const SCENES = {
  map:     { ...LJUBLJANA, zoom: 12, day: 2, file: 'map', loc: LJUBLJANA },
  // Same city, closer in: at z14 the same-zone pins show their count badge,
  // which is what the "many events, one pin" frame is actually about.
  cluster: { lat: 46.0552, lng: 14.5115, zoom: 14, day: 2, file: 'map-cluster', loc: LJUBLJANA },
  event:   { ...LJUBLJANA, zoom: 12, day: 2, file: 'event', loc: LJUBLJANA,
             eventId: '5530c861-1316-4372-a84e-cf14720b072a' },
  create:  { ...LJUBLJANA, zoom: 12, day: 2, file: 'new', create: true, loc: LJUBLJANA },
  rzeszow: { lat: 50.0413, lng: 21.999, zoom: 13, day: 4, file: 'map-rzeszow' },
  tenerife:{ lat: 28.48,  lng: -16.33, zoom: 11, day: 0, file: 'map' },
}

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
// --guest skips the login wait. The avatar then shows '?' instead of an
// initial, and the "create" scene is unavailable (the "+" is gated on a
// session and opens the auth modal for a guest — see MapScreen.tsx).
const GUEST = process.argv.includes('--guest')
// --viewport=1024x1366 --tag=ipad captures the app at iPad size and writes
// <file>-ipad-<lang>.png, so tablet shots sit next to the phone ones.
const VIEWPORT = (process.argv.find(a => a.startsWith('--viewport=')) || '')
  .split('=')[1]?.split('x').map(Number)
const TAG = process.argv.find(a => a.startsWith('--tag='))?.split('=')[1]
const SUFFIX = TAG ? `-${TAG}` : ''
const [VW, VH] = VIEWPORT?.length === 2 ? VIEWPORT : [390, 844]
// One run, one login: --jobs="sl:map,event,create,rzeszow;en:rzeszow;de:rzeszow"
// (--lang/--shots still work for a single language.)
const JOBS = (arg('jobs') || `${arg('lang') || 'pl'}:${arg('shots') || 'map'}`)
  .split(';').filter(Boolean)
  .map(j => { const [lang, list] = j.split(':'); return { lang, shots: list.split(',') } })
const firstLang = JOBS[0].lang

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function launch() {
  // --remote-allow-origins is required for this (old) puppeteer to speak to a
  // current Chrome; without it the CDP websocket handshake is rejected.
  const base = {
    headless: false,
    userDataDir: PROFILE,
    args: [`--lang=${firstLang}`, '--remote-allow-origins=*',
           `--window-size=${VW + 70},${Math.min(VH + 120, 1400)}`],
  }
  if (existsSync(SYS_CHROME)) return puppeteer.launch({ ...base, executablePath: SYS_CHROME })
  return puppeteer.launch(base)
}

// The map only queries a radius around its centre, and that radius is widened
// on `moveend`. Nudging the map makes it refetch for the whole visible area.
async function nudgeMap(page) {
  const cx = Math.round(VW / 2), cy = Math.round(VH * 0.59)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 7, cy - 6, { steps: 4 })
  await page.mouse.up()
  await sleep(1800)
}

async function openTimelineDay(page, day) {
  const opened = await page.evaluate(() => {
    const b = document.querySelector('div[style*="bottom: 168px"] button')
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) return
  await sleep(400)
  await page.evaluate(idx => {
    document.querySelector(`[data-day-idx="${idx}"]`)?.click()
  }, day + TODAY_IDX)
  await sleep(2200)
}

const browser = await launch()
const page = (await browser.pages())[0] || await browser.newPage()
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 })
await page.setExtraHTTPHeaders({ 'Accept-Language': firstLang })
// meuwe_lang wins over the browser locale (see detectInitialLang in src/lib/i18n.ts),
// so switching languages between jobs is just a matter of rewriting this key.
let curLang = firstLang
await page.evaluateOnNewDocument(() => {
  const l = localStorage.getItem('__capture_lang')
  if (l) localStorage.setItem('meuwe_lang', l)
})
const useLang = async l => {
  curLang = l
  await page.evaluate(v => {
    localStorage.setItem('__capture_lang', v)
    localStorage.setItem('meuwe_lang', v)
  }, l)
}

// Wait for a signed-in session (the user logs in by hand in the open window).
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
// Ask the UI, not localStorage: a stored token can still be rejected on
// refresh, and only the app knows whether the session really took. The avatar
// shows '?' for a guest and the first letter of the account otherwise.
// Polling also has to survive login navigations (OAuth bounces off-site and
// back), so a destroyed execution context just means "not yet".
const signedIn = async () => {
  try {
    if (!page.url().startsWith(BASE)) return false
    return await page.evaluate(() => {
      const av = [...document.querySelectorAll('button')]
        .find(b => b.getBoundingClientRect().top < 120 && b.textContent.trim().length === 1)
      return !!av && av.textContent.trim() !== '?'
    })
  } catch { return false }
}
if (GUEST) {
  console.log(await signedIn() ? 'Tryb gosc: sesja jest, awatar pokaze inicjal.\n'
                               : 'Tryb gosc: bez sesji, awatar pokaze "?".\n')
} else if (!await signedIn()) {
  console.log('\n>>> Zaloguj sie w otwartym oknie. Czekam (do 15 min)...\n')
  for (let i = 0; i < 450 && !(await signedIn()); i++) await sleep(2000)
  if (!await signedIn()) { console.log('Brak sesji - przerywam.'); await browser.close(); process.exit(1) }
  console.log('Sesja OK.\n')
}

for (const job of JOBS) {
 await useLang(job.lang)
 for (const name of job.shots) {
  const s = SCENES[name]
  if (!s) { console.log('nieznana scena:', name); continue }
  // Without a session the "+" opens the auth modal, so the shot would show the
  // login sheet instead of the create sheet. Skip loudly rather than save it.
  if (s.create && GUEST && !(await signedIn())) {
    console.log(`  pomijam ${name} (${job.lang}): wymaga zalogowania`); continue
  }
  if (s.loc) {
    await browser.defaultBrowserContext().overridePermissions(BASE, ['geolocation'])
    await page.setGeolocation({ latitude: s.loc.lat, longitude: s.loc.lng })
  }
  const q = `?lat=${s.lat}&lng=${s.lng}&zoom=${s.zoom}` + (s.eventId ? `&event=${s.eventId}` : '')
  await page.goto(BASE + q, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.meuwe-icon', { timeout: 30000 }).catch(() => console.log('  (brak markerow)'))
  await nudgeMap(page)
  if (s.day) await openTimelineDay(page, s.day)
  if (s.create) {
    // The "+" opens the create sheet for a signed-in user. Its glyph is an SVG
    // path, so match the button by its place in the layout instead of by text.
    await page.evaluate(() => {
      document.querySelector('div[style*="bottom: 24px"] button')?.click()
    })
    await sleep(1800)
  }
  await page.evaluateHandle('document.fonts.ready')
  await sleep(1200)
  const file = `${OUT}/${s.file}${SUFFIX}-${curLang}.png`
  await page.screenshot({ path: file })
  console.log('captured', file)
 }
}

await browser.close()
console.log('done')
