// Capture fresh app screenshots (live PROD data) for the store frames.
// Requires the dev server running on :5173 (npm run dev).
//
//   node capture.mjs --lang=sl --shots=map,event,create
//   node capture.mjs --all                       # 5 jezykow x 3 sceny
//   node capture.mjs --all --viewport=1024x1366 --tag=ipad
//
// The browser runs with a persistent profile (PROFILE below) so the Supabase
// session survives between runs. On the first run the window stays open until
// you log in by hand - the "+" button and the avatar only look right for a
// signed-in user. Nothing here types credentials.
//
// Output: public/screenshots/<file>-<lang>.png
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'

const ROOT = '/Users/wiktormarc/meuwe-web'
const OUT = `${ROOT}/public/screenshots`
const SYS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5173'

// Timeline: index 1 is today, so a day offset N sits at index N + 1.
const TODAY_IDX = 1

// One day carries the whole set. 2026-08-22 is a Saturday and the density peak
// in all three regions at once (Podkarpacie 29, Slovenia 29, Tenerife 28 events
// - counted against live data before the run). Re-check with the scout query if
// this is ever re-run on a later date; a day in the past has nothing to show.
const SHOOT_DAY = '2026-08-22'

/**
 * Each frame is shot where its story is strongest, so one store listing walks
 * the reader through all three regions:
 *   map    -> Rzeszow      (dense city centre, Polish titles)
 *   event  -> Ljubljana    (Krizanke - a venue a Slovene reader knows)
 *   create -> Santa Cruz   (Tenerife, where meuwe is made)
 * `loc` fakes the device position. Without it the distance on an event card is
 * measured from wherever this machine really is ("693 km od tebe" on a
 * Ljubljana event), which reads as a bug in a local-events listing.
 */
// Srodek kadru, nie srodek miasta: piny siedza na wschod od geometrycznego
// srodka Rzeszowa, wiec mapa jest przesunieta tak, zeby wpadly w srodek ekranu.
const RZESZOW = { lat: 50.0395, lng: 22.0035 }
const LJUBLJANA = { lat: 46.0520, lng: 14.5060 }
const SANTA_CRUZ = { lat: 28.4682, lng: -16.2546 }

const SCENES = {
  map: {
    ...RZESZOW, zoom: 14, day: SHOOT_DAY, file: 'map', loc: RZESZOW,
  },
  // Deep link: App.tsx flies to the event and moves the day axis onto its date,
  // so the sheet and the axis under it agree without any extra clicking.
  //
  // Jedno wydarzenie na oba ekrany. Na iPadzie karta nie rozklada sie na cala
  // szerokosc, tylko siedzi jako kafelek w rogu mapy, wiec dlugosc opisu nie ma
  // tu znaczenia - liczy sie gestosc pinow dookola, a ta jest w Lublanie.
  event: {
    ...LJUBLJANA, zoom: 14, file: 'event', loc: { lat: 46.0455, lng: 14.5115 },
    eventId: '20f2331b-8604-4d80-9186-d44c8dda99ed', // Rade Serbedzija @ Krizanke
  },
  create: {
    ...SANTA_CRUZ, zoom: 14, day: SHOOT_DAY, file: 'new', create: true, loc: SANTA_CRUZ,
  },
}

const ALL_LANGS = ['pl', 'en', 'de', 'es', 'sl']
const ALL_SHOTS = ['map', 'event', 'create']

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
// Osobne katalogi profilu, żeby jeden przebieg nie kasował stanu drugiego:
// domyślny trzyma sesję (potrzebną do sceny `create`), a --profile=guest jest
// pusty i daje widok, który zobaczy ktoś przed zalogowaniem.
const PROFILE = arg('profile') === 'guest'
  ? '/Users/wiktormarc/.meuwe-capture-guest'
  : arg('profile') || '/Users/wiktormarc/.meuwe-capture-profile'
// --guest skips the login wait. The avatar then shows '?' instead of an
// initial, and the "create" scene is unavailable (the "+" is gated on a
// session and opens the auth modal for a guest - see MapScreen.tsx).
const GUEST = process.argv.includes('--guest')
// --viewport=1024x1366 --tag=ipad captures the app at iPad size and writes
// <file>-ipad-<lang>.png, so tablet shots sit next to the phone ones.
const VIEWPORT = (process.argv.find(a => a.startsWith('--viewport=')) || '')
  .split('=')[1]?.split('x').map(Number)
const TAG = arg('tag')
const SUFFIX = TAG ? `-${TAG}` : ''
const [VW, VH] = VIEWPORT?.length === 2 ? VIEWPORT : [390, 844]
// One run, one login: --jobs="sl:map,event;en:map" (--lang/--shots still work
// for a single language, --all for the full matrix).
const JOBS = process.argv.includes('--all')
  ? ALL_LANGS.map(lang => ({ lang, shots: ALL_SHOTS }))
  : (arg('jobs') || `${arg('lang') || 'pl'}:${arg('shots') || 'map'}`)
    .split(';').filter(Boolean)
    .map(j => { const [lang, list] = j.split(':'); return { lang, shots: list.split(',') } })
const firstLang = JOBS[0].lang

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Dni od dzisiaj do daty zdjeciowej, liczone od lokalnej polnocy. */
function dayOffset(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86_400_000)
}

async function launch() {
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

/**
 * Ustaw os dni na wybrany dzien i zwin ja z powrotem do pigulki. Rozwinieta os
 * zaslania dolna trzecia mapy, a pigulka i tak niesie te sama informacje
 * ("sobota - 22 sie").
 */
async function openTimelineDay(page, idx) {
  const opened = await page.evaluate(() => {
    const b = document.querySelector('div[style*="bottom: 168px"] button')
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) return
  await sleep(400)
  await page.evaluate(i => {
    document.querySelector(`[data-day-idx="${i}"]`)?.click()
  }, idx)
  await sleep(2400)
  // Zwiniecie paska: "×" na jego prawym koncu.
  await page.evaluate(() => {
    const strip = document.querySelector('div[style*="bottom: 168px"]')
    const close = [...(strip?.querySelectorAll('button') ?? [])]
      .find(b => b.textContent.trim() === '×')
    close?.click()
  })
  await sleep(500)
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
  // Wariant per urzadzenie: to samo ujecie na iPadzie potrafi potrzebowac
  // innego wydarzenia i innego srodka kadru niz na telefonie.
  const eventId = s.eventIdByTag?.[TAG] ?? s.eventId
  const loc = s.locByTag?.[TAG] ?? s.loc
  const view = s.viewByTag?.[TAG] ?? s
  if (loc) {
    await browser.defaultBrowserContext().overridePermissions(BASE, ['geolocation'])
    await page.setGeolocation({ latitude: loc.lat, longitude: loc.lng })
  }
  const q = `?lat=${view.lat}&lng=${view.lng}&zoom=${s.zoom}` + (eventId ? `&event=${eventId}` : '')
  await page.goto(BASE + q, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.meuwe-icon', { timeout: 30000 }).catch(() => console.log('  (brak markerow)'))
  await nudgeMap(page)
  if (s.day) {
    const off = dayOffset(s.day)
    if (off < 0) console.log(`  UWAGA: ${s.day} juz minal - os dni tam nie siega`)
    else await openTimelineDay(page, off + TODAY_IDX)
  }
  if (s.create) {
    // The "+" opens the create sheet for a signed-in user. Its glyph is an SVG
    // path, so match the button by its place in the layout instead of by text.
    await page.evaluate(() => {
      document.querySelector('div[style*="bottom: 24px"] button')?.click()
    })
    await sleep(1800)
  }
  await page.evaluateHandle('document.fonts.ready')
  await sleep(1400)
  const file = `${OUT}/${s.file}${SUFFIX}-${curLang}.png`
  await page.screenshot({ path: file })
  console.log('captured', file)
 }
}

await browser.close()
console.log('done')
