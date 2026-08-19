// Ramki do App Store i Google Play — HTML, który render.mjs zamienia na PNG.
//
//   node --experimental-strip-types gen.mjs          # wszystkie języki
//   node --experimental-strip-types gen.mjs sl de    # tylko wybrane
//
// Flaga --experimental-strip-types jest konieczna, bo teksty, barwy i geometria
// logo są zaciągane wprost ze źródeł aplikacji (pliki .ts). Nic tu się nie
// przepisuje ręcznie: zmiana tekstu na landingu albo w logo przechodzi do
// sklepu przy najbliższym uruchomieniu.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { C, BLOBS, TAG_META } from '../src/lib/tokens.ts'
import { ORANGE, VIEW_BOX, RIM_WIDTH, PARTS, RIM, FILL, meuweLogoWidth } from '../src/components/meuweLogoPaths.ts'
import pl from '../src/locales/pl.ts'
import en from '../src/locales/en.ts'
import de from '../src/locales/de.ts'
import es from '../src/locales/es.ts'
import sl from '../src/locales/sl.ts'

const ROOT = '/Users/wiktormarc/meuwe-web/store-assets'
const BUILD = `${ROOT}/_build`
const SHOTS = '/Users/wiktormarc/meuwe-web/public/screenshots'
mkdirSync(BUILD, { recursive: true })

const L = { pl, en, de, es, sl }

const fontHead = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;700;800;900&family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
`

// Gradient dokładnie ten, którym wita aplikacja (Welcome.tsx) — ramka intro ma
// wyglądać jak pierwszy ekran po instalacji, a nie jak plakat obok niego.
const WELCOME_BG = `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`

const base = `
* { margin:0; padding:0; box-sizing:border-box; }
:root{
  --orange:${C.primary}; --sky:${C.sky}; --grass:${C.grass}; --sun:${C.sunshine};
  --berry:${C.berry}; --cream:${C.cream}; --ink:${C.ink}; --ink-soft:${C.inkSoft};
}
.display{ font-family:"Hanken Grotesk","Nunito",system-ui,sans-serif; }
.body{ font-family:"Nunito",system-ui,sans-serif; }
`

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------------------------------------------------------------- logo -----

/** Wordmark „meuwe" — te same ścieżki, które rysuje <MeuweLogo> w aplikacji. */
function wordmark(height) {
  const rim = PARTS.map(p => RIM[p.key].map(d =>
    `<path d="${d}" fill="${ORANGE}" stroke="${ORANGE}" stroke-width="${RIM_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join('')).join('')
  const fill = PARTS.map(p => FILL[p.key].map(d =>
    `<path d="${d}" fill="#fff"/>`
  ).join('')).join('')
  return `<svg viewBox="${VIEW_BOX}" width="${meuweLogoWidth(height)}" height="${height}"
    style="display:block;flex-shrink:0">${rim}${fill}</svg>`
}

// --------------------------------------------------------------- blobs -----

/** Buźka z BlobFace.tsx — te same oczy i ten sam uśmiech. */
function blobFace(size) {
  return `<svg width="${size}" height="${size * 0.9}" viewBox="0 0 36 28" style="display:block">
    <ellipse cx="13" cy="10" rx="1.9" ry="2.4" fill="${C.ink}"/>
    <ellipse cx="23" cy="10" rx="1.9" ry="2.4" fill="${C.ink}"/>
    <path d="M11 18 q7 6 14 0" stroke="${C.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`
}

/** Pływający stworek z ekranu powitalnego: OrganicBlob + BlobFace. */
function blob(size, color, x, y, idx = 0, rot = 0) {
  const sw = size <= 28 ? 4 : size <= 44 ? 4.5 : 5
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;
      transform:rotate(${rot}deg)">
    <svg width="${size}" height="${size}" viewBox="-3 -3 106 106"
      style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 3px 0 ${C.ink}22)">
      <path d="${BLOBS[idx % BLOBS.length]}" fill="${color}" stroke="${C.ink}" stroke-width="${sw}" stroke-linejoin="round"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      transform:rotate(${-rot}deg)">${blobFace(size * 0.55)}</div>
  </div>`
}

/** Pinezka kategorii — ta sama sylwetka, której mapa używa na piny. */
function categoryPin(cat, size) {
  const { color, glyph } = TAG_META[cat]
  const dot = Math.round(size * 0.27)
  return `<div style="position:relative;width:${size}px;height:${Math.round(size * 1.27)}px;flex:none">
    <svg width="${size}" height="${size}" viewBox="-3 -3 106 106"
      style="overflow:visible;filter:drop-shadow(0 3px 0 ${C.ink}22);display:block">
      <path d="${BLOBS[0]}" fill="${color}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
    </svg>
    <div style="position:absolute;top:${Math.round(size * 0.22)}px;left:0;width:${size}px;display:flex;
      align-items:center;justify-content:center;font-size:${Math.round(size * 0.42)}px;color:${C.ink}">${glyph}</div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:${dot}px;height:${dot}px;
      border-radius:50%;background:${color};border:2px solid ${C.ink}"></div>
  </div>`
}

/** Przycisk „+" z mapy — ten sam kształt i ten sam krzyżyk co w AddButton.tsx. */
function addButton(size) {
  return `<div style="position:relative;width:${size * 1.15}px;height:${size * 1.15}px;flex:none;
    display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:${size * 1.15}px;height:${size * 1.15}px;border-radius:50%;
      border:3px solid ${C.primary};opacity:.22"></div>
    <svg width="${size * 1.12}" height="${size * 1.12}" viewBox="-3 -3 106 106"
      style="overflow:visible;filter:drop-shadow(0 5px 0 ${C.ink}44)">
      <path d="${BLOBS[0]}" fill="${C.primary}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
    </svg>
    <svg width="${size * 0.46}" height="${size * 0.46}" viewBox="0 0 40 40" style="position:absolute">
      <path d="M20 7 L20.7 19.2 L31.5 19 C32 19 32.5 19.5 32.5 20 C32.5 20.5 32 21 31.5 21 L20.7 20.8 L21 31.6 C21 32.2 20.5 32.6 20 32.6 C19.5 32.6 19 32.2 19 31.6 L19.3 20.8 L8.4 21 C7.9 21 7.5 20.5 7.5 20 C7.5 19.5 7.9 19 8.4 19 L19.3 19.2 L19 8 C19 7.5 19.5 7 20 7 Z" fill="#fff"/>
    </svg>
  </div>`
}

/** Biała pinezka z maską — wydarzenie prywatne, tak jak na landingu. */
function privatePin(size) {
  const dot = Math.round(size * 0.27)
  return `<div style="position:relative;width:${size}px;height:${Math.round(size * 1.27)}px;flex:none">
    <svg width="${size}" height="${size}" viewBox="-3 -3 106 106"
      style="overflow:visible;filter:drop-shadow(0 5px 0 ${C.ink}44);display:block">
      <path d="${BLOBS[0]}" fill="#fff" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
    </svg>
    <div style="position:absolute;top:${Math.round(size * 0.25)}px;left:0;width:${size}px;display:flex;
      align-items:center;justify-content:center">
      <svg width="${Math.round(size * 0.65)}" height="${Math.round(size * 0.54)}" viewBox="0 0 26 22" fill="none">
        <ellipse cx="7.5" cy="7" rx="6" ry="5" fill="${C.ink}"/>
        <ellipse cx="18.5" cy="7" rx="6" ry="5" fill="${C.ink}"/>
        <rect x="11" y="3" width="4" height="8" fill="${C.ink}"/>
        <ellipse cx="7.5" cy="7" rx="3" ry="2.5" fill="#fff"/>
        <ellipse cx="18.5" cy="7" rx="3" ry="2.5" fill="#fff"/>
        <path d="M8 18Q13 22 18 18" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:${dot}px;height:${dot}px;
      border-radius:50%;background:#fff;border:2px solid ${C.ink}"></div>
  </div>`
}

// -------------------------------------------------------------- makiety -----

/**
 * Makieta urządzenia dopasowana do miejsca, jakie zostało pod tekstem.
 *
 * Rozmiar bierze się z wysokości, nie z szerokości: kadr androidowy (540x960)
 * jest proporcjonalnie niższy od iPhone'owego (645x1398), więc ta sama część
 * szerokości dawała tam telefon wyższy niż cała ramka.
 *
 * Ograniczeniem jest `max-height`, nie `max-width`. Przy `height:100%` szerokość
 * dolicza `aspect-ratio` z wysokości, więc `max-width` przycinał samą szerokość,
 * zostawiając pełną wysokość — pudełko robiło się węższe od zrzutu i `cover`
 * ścinał obraz po bokach (w słoweńskiej karcie znikała pierwsza litera tytułu).
 * Limit nałożony na wysokość skaluje oba wymiary naraz.
 *
 * Zaokrąglenie idzie w procentach, bo końcowej szerokości nie znamy tutaj,
 * tylko w przeglądarce.
 */
function mockup(img, ratio, maxW, radiusPct) {
  const shadow = Math.round(maxW * 0.03)
  // Promień poziomy liczy się od szerokości, pionowy od wysokości. Żeby narożnik
  // wyszedł kołowy, a nie eliptyczny, drugą wartość skaluje proporcja kadru.
  return `<div style="height:100%;aspect-ratio:${ratio};max-height:${Math.round(maxW / ratio)}px;
    border-radius:${radiusPct}% / ${(radiusPct * ratio).toFixed(2)}%;border:3px solid ${C.ink};
    box-shadow:${shadow}px ${shadow}px 0 ${C.ink};overflow:hidden;background:#fff">
    <img src="file://${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>
  </div>`
}

/** Telefon: proporcja kadru z capture.mjs (390x844). */
const phone = (img, maxW) => mockup(img, 390 / 844, maxW, 13)

/** iPad: proporcja kadru 1024x1366, cieńszy rant niż telefon. */
const tablet = (img, maxW) => mockup(img, 1024 / 1366, maxW, 4.5)

// --------------------------------------------------------------- sceny -----

/**
 * Pięć ramek na sklep. Teksty to dokładnie te same klucze, które renderują
 * sekcje landingu (src/components/landing/sections/*), więc opis w sklepie i
 * opis na stronie nie mogą się rozjechać.
 *
 *   1. intro    — ekran powitalny: logo + welcome.tagline
 *   2. map      — HeroSection/ProblemSection: landing.f1*
 *   3. event    — HowItWorksSection: landing.f2*
 *   4. steps    — FeaturesSection: landing.f3* + step1..3
 *   5. private  — PrivateSection: landing.private*
 *
 * Czwarta ramka jest rysowana, nie fotografowana. Arkusz tworzenia wydarzenia
 * otwiera się wyłącznie dla zalogowanego („+" wywołuje onAuthNeeded i podnosi
 * modal logowania), a zrzuty powstają na koncie gościa. Zamiast pokazywać
 * modal logowania w miejscu ekranu tworzenia, ramka niesie tę samą treść co
 * sekcja landingu: nagłówek f3 i trzy kroki spod niego.
 */
const ORDER = ['intro', 'map', 'event', 'steps', 'private']

function scenesFor(lang, tag = '') {
  const t = L[lang]
  const g = t.landing
  const shot = f => `${SHOTS}/${f}${tag}-${lang}.png`
  return {
    intro: { type: 'intro', tagline: t.welcome.tagline },
    map: { type: 'shot', file: shot('map'), eyebrow: g.f1Eyebrow, title: g.f1Title, accent: C.sky },
    event: { type: 'shot', file: shot('event'), eyebrow: g.f2Eyebrow, title: g.f2Title, accent: C.berry },
    create: { type: 'shot', file: shot('new'), eyebrow: g.f3Eyebrow, title: g.f3Title, accent: C.grass },
    steps: {
      type: 'steps', eyebrow: g.f3Eyebrow, title: g.f3Title, accent: C.grass,
      steps: [g.step1, g.step2, g.step3],
    },
    private: {
      type: 'private', eyebrow: g.privateEyebrow, title: g.privateTitle,
      body: g.privateBody, accent: C.sunshine,
    },
  }
}

// Tło wspólne dla ramek treściowych: ten sam kremowy gradient co powitanie plus
// jedna barwna plama, inna dla każdej ramki — zestaw czyta się jako jedna
// rodzina, a pojedyncze kafelki dają się od siebie odróżnić w galerii sklepu.
function backdrop(w, h, accent) {
  // Plamy jako gradienty promieniste, nie koła: twarda krawędź barwnego kręgu
  // na kremowym tle czytała się jak smuga brudu, rozmyta ginie w gradiencie.
  const wash = (color, size, x, y, op) =>
    `<div style="position:absolute;width:${size}px;height:${size}px;left:${x}px;top:${y}px;
      background:radial-gradient(circle,${color}${op} 0%,${color}00 70%)"></div>`
  return `
  <div style="position:absolute;inset:0;background:${WELCOME_BG}"></div>
  ${wash(accent, w * 1.5, w * 0.25, -h * 0.16, '2E')}
  ${wash(C.primary, w * 1.2, -w * 0.55, h * 0.62, '24')}`
}

/** Ramka z makietą urządzenia: nadtytuł, tytuł, zrzut, wordmark u dołu. */
function shotHTML(s, w, h, dev) {
  const pad13 = dev === 'ipad'
  const maxW = Math.round(w * (pad13 ? 0.70 : 0.62))
  const capGap = Math.round(h * (pad13 ? 0.034 : 0.040))
  const eyebrowFs = Math.round(w * (pad13 ? 0.0235 : 0.0275))
  const titleFs = Math.round(w * (pad13 ? 0.055 : 0.068))
  const wmFs = Math.round(w * (pad13 ? 0.036 : 0.044))
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  display:flex;flex-direction:column;align-items:center;
  padding:${Math.round(h * (pad13 ? 0.060 : 0.070))}px 0 ${Math.round(h * 0.026)}px}
</style></head><body>
  ${backdrop(w, h, s.accent)}
  ${blob(w * 0.075, C.berry, w * 0.065, h * 0.052, 1, -12)}
  ${blob(w * 0.058, C.sunshine, w * 0.875, h * 0.088, 2, 10)}
  <div style="text-align:center;z-index:2;padding:0 ${Math.round(w * 0.06)}px;flex:none">
    <div class="display" style="font-weight:800;font-size:${eyebrowFs}px;letter-spacing:${(w * 0.004).toFixed(2)}px;
      text-transform:uppercase;color:${C.primary}">${esc(s.eyebrow)}</div>
    <div class="display" style="font-weight:900;font-size:${titleFs}px;line-height:1.12;color:${C.ink};
      margin-top:${Math.round(h * 0.012)}px;white-space:pre-line">${esc(s.title)}</div>
  </div>
  <div style="flex:1;min-height:0;display:flex;justify-content:center;z-index:2;
    padding:${capGap}px 0 ${Math.round(h * 0.022)}px">${(pad13 ? tablet : phone)(s.file, maxW)}</div>
  <div style="z-index:2;flex:none">${wordmark(wmFs)}</div>
</body></html>`
}

/** Ramka powitalna: to, co widać po pierwszym uruchomieniu. */
function introHTML(s, w, h, dev) {
  const pad13 = dev === 'ipad'
  const logoH = w * (pad13 ? 0.105 : 0.135)
  const subFs = w * (pad13 ? 0.040 : 0.052)
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;background:${WELCOME_BG};
  display:flex;flex-direction:column;align-items:center;justify-content:center}
</style></head><body>
  ${blob(w * 0.175, C.grass, w * 0.070, h * 0.135, 0, -10)}
  ${blob(w * 0.130, C.berry, w * 0.755, h * 0.205, 1, 12)}
  ${blob(w * 0.100, C.sunshine, w * 0.130, h * 0.720, 2, 8)}
  ${blob(w * 0.150, C.sky, w * 0.720, h * 0.685, 0, -8)}
  ${blob(w * 0.085, C.primary, w * 0.450, h * 0.845, 1, 14)}
  <div style="display:flex;flex-direction:column;align-items:center;text-align:center;z-index:2;
    padding:0 ${Math.round(w * 0.08)}px">
    ${wordmark(logoH)}
    <div class="body" style="margin-top:${Math.round(h * 0.020)}px;font-size:${subFs}px;font-weight:600;
      color:${C.ink};opacity:.7;line-height:1.4;white-space:pre-line">${esc(s.tagline)}</div>
  </div>
</body></html>`
}

/**
 * Ramka o wydarzeniach prywatnych. Bez zrzutu — prywatną pinezkę widzą tylko
 * zaproszeni, więc na zwykłej mapie nie ma jej jak pokazać. Zamiast tego ta
 * sama ilustracja, którą niesie sekcja landingu: rząd publicznych pinów, a pod
 * nim biała pinezka w masce.
 */
const PUBLIC_PINS = ['party', 'outdoor', 'music', 'food', 'sport', 'film', 'gaming']

function privateHTML(s, w, h, dev) {
  const pad13 = dev === 'ipad'
  const eyebrowFs = Math.round(w * (pad13 ? 0.0235 : 0.0275))
  const titleFs = Math.round(w * (pad13 ? 0.055 : 0.068))
  const bodyFs = Math.round(w * (pad13 ? 0.028 : 0.036))
  const wmFs = Math.round(w * (pad13 ? 0.036 : 0.044))
  // Karta ma zająć tyle miejsca, ile w pozostałych ramkach zajmuje telefon -
  // inaczej ta jedna wygląda w galerii jak niedokończona.
  const cardW = Math.round(w * (pad13 ? 0.74 : 0.86))
  const cardH = Math.round(h * (pad13 ? 0.42 : 0.46))
  const pinSize = Math.round(cardW * 0.098)
  const bigPin = Math.round(cardW * 0.26)
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:${Math.round(h * 0.070)}px 0 ${Math.round(h * 0.105)}px}
</style></head><body>
  ${backdrop(w, h, s.accent)}
  ${blob(w * 0.075, C.sky, w * 0.065, h * 0.052, 1, -12)}
  ${blob(w * 0.058, C.grass, w * 0.875, h * 0.088, 2, 10)}
  <div style="text-align:center;z-index:2;padding:0 ${Math.round(w * 0.06)}px">
    <div class="display" style="font-weight:800;font-size:${eyebrowFs}px;letter-spacing:${(w * 0.004).toFixed(2)}px;
      text-transform:uppercase;color:${C.primary}">${esc(s.eyebrow)}</div>
    <div class="display" style="font-weight:900;font-size:${titleFs}px;line-height:1.12;color:${C.ink};
      margin-top:${Math.round(h * 0.012)}px;white-space:pre-line">${esc(s.title)}</div>
  </div>

  <div style="z-index:2;width:${cardW}px;height:${cardH}px;position:relative;
    background:#D4EDDA;border:3px solid ${C.ink};box-shadow:${Math.round(cardW * 0.022)}px ${Math.round(cardW * 0.022)}px 0 ${C.ink};
    border-radius:${Math.round(cardW * 0.06)}px;padding:${Math.round(cardH * 0.10)}px ${Math.round(cardW * 0.055)}px;
    display:flex;flex-direction:column;justify-content:space-between;overflow:hidden">
    <div style="position:absolute;inset:0;
      background-image:linear-gradient(${C.ink}0D 1px,transparent 1px),linear-gradient(90deg,${C.ink}0D 1px,transparent 1px);
      background-size:${Math.round(cardW * 0.075)}px ${Math.round(cardW * 0.075)}px"></div>
    <div style="position:absolute;top:46%;left:0;right:0;height:3px;background:rgba(255,255,255,.6)"></div>
    <div style="position:absolute;left:37%;top:0;bottom:0;width:3px;background:rgba(255,255,255,.6)"></div>

    <div style="display:flex;align-items:flex-end;justify-content:space-between;position:relative">
      ${PUBLIC_PINS.map(c => categoryPin(c, pinSize)).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:${Math.round(cardW * 0.025)}px;position:relative">
      <div style="flex:1;height:1px;background:${C.ink}26"></div>
      <span class="body" style="font-weight:800;font-size:${Math.round(cardW * 0.028)}px;letter-spacing:.1em;
        text-transform:uppercase;color:${C.ink}66">vs</span>
      <div style="flex:1;height:1px;background:${C.ink}26"></div>
    </div>

    <div style="display:flex;justify-content:center;position:relative">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);
        width:${bigPin * 2.1}px;height:${bigPin * 2.1}px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,255,255,.65) 0%,transparent 70%)"></div>
      ${privatePin(bigPin)}
    </div>
  </div>

  <div class="body" style="z-index:2;padding:0 ${Math.round(w * 0.10)}px;
    text-align:center;font-size:${bodyFs}px;font-weight:600;line-height:1.5;color:${C.inkSoft}">${esc(s.body)}</div>

  <div style="position:absolute;bottom:${Math.round(h * 0.028)}px;z-index:2">${wordmark(wmFs)}</div>
</body></html>`
}

/**
 * Ramka „wydarzenie w 10 sekund": przycisk „+" i trzy kroki spod niego.
 * Numerki i teksty jak w FeaturesSection na landingu.
 */
function stepsHTML(s, w, h, dev) {
  const pad13 = dev === 'ipad'
  const eyebrowFs = Math.round(w * (pad13 ? 0.0235 : 0.0275))
  const titleFs = Math.round(w * (pad13 ? 0.055 : 0.068))
  const stepFs = Math.round(w * (pad13 ? 0.030 : 0.038))
  const dotSize = Math.round(w * (pad13 ? 0.052 : 0.068))
  const wmFs = Math.round(w * (pad13 ? 0.036 : 0.044))
  const cardW = Math.round(w * (pad13 ? 0.74 : 0.86))
  const step = (text, i) => `
    <div style="display:flex;align-items:center;gap:${Math.round(w * 0.034)}px">
      <div class="display" style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;flex:none;
        background:${C.primary};color:#fff;border:2px solid ${C.ink};
        display:flex;align-items:center;justify-content:center;
        font-weight:900;font-size:${Math.round(dotSize * 0.46)}px">${i + 1}</div>
      <span class="body" style="font-weight:700;font-size:${stepFs}px;color:#5C564E;line-height:1.35">${esc(text)}</span>
    </div>`
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:${Math.round(h * 0.070)}px 0 ${Math.round(h * 0.105)}px}
</style></head><body>
  ${backdrop(w, h, s.accent)}
  ${blob(w * 0.075, C.sunshine, w * 0.065, h * 0.052, 1, -12)}
  ${blob(w * 0.058, C.berry, w * 0.875, h * 0.088, 2, 10)}
  <div style="text-align:center;z-index:2;padding:0 ${Math.round(w * 0.06)}px">
    <div class="display" style="font-weight:800;font-size:${eyebrowFs}px;letter-spacing:${(w * 0.004).toFixed(2)}px;
      text-transform:uppercase;color:${C.primary}">${esc(s.eyebrow)}</div>
    <div class="display" style="font-weight:900;font-size:${titleFs}px;line-height:1.12;color:${C.ink};
      margin-top:${Math.round(h * 0.012)}px;white-space:pre-line">${esc(s.title)}</div>
  </div>

  <div style="z-index:2;display:flex;flex-direction:column;align-items:center;
    gap:${Math.round(h * 0.035)}px">
    ${addButton(Math.round(w * (pad13 ? 0.18 : 0.26)))}
    <div style="width:${cardW}px;background:#fff;border:3px solid ${C.ink};
      border-radius:${Math.round(cardW * 0.06)}px;box-shadow:${Math.round(cardW * 0.022)}px ${Math.round(cardW * 0.022)}px 0 ${C.ink};
      padding:${Math.round(cardW * 0.075)}px ${Math.round(cardW * 0.065)}px;
      display:flex;flex-direction:column;gap:${Math.round(h * 0.024)}px">
      ${s.steps.map(step).join('')}
    </div>
  </div>

  <div style="z-index:2">${wordmark(wmFs)}</div>
</body></html>`
}

/** Grafika promocyjna Google Play, 1024x500. */
function featureHTML(w, h, lang) {
  const g = L[lang].landing
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;background:${WELCOME_BG}}
</style></head><body>
  <div style="position:absolute;width:240px;height:240px;border-radius:50%;background:${C.primary};opacity:.12;top:-70px;right:130px"></div>
  <div style="position:absolute;width:180px;height:180px;border-radius:50%;background:${C.sky};opacity:.12;bottom:-60px;left:-40px"></div>
  ${blob(40, C.berry, 26, 26, 1, -12)}
  ${blob(30, C.sunshine, 250, 16, 2, 8)}
  <div style="position:absolute;left:40px;top:50%;transform:translateY(-50%);max-width:300px">
    ${wordmark(34)}
    <div class="display" style="font-weight:800;font-size:23px;color:${C.ink};margin-top:16px;line-height:1.15;white-space:pre-line">${esc(g.f1Title)}</div>
    <div class="body" style="font-weight:700;font-size:13px;color:${C.inkSoft};margin-top:10px">${esc(g.f1Eyebrow)}</div>
  </div>
  <div style="position:absolute;right:34px;top:50%;transform:translateY(-50%) rotate(6deg)">
    ${phone(`${SHOTS}/map-${lang}.png`, 150)}
  </div>
</body></html>`
}

function build(scene, w, h, dev) {
  if (scene.type === 'intro') return introHTML(scene, w, h, dev)
  if (scene.type === 'private') return privateHTML(scene, w, h, dev)
  if (scene.type === 'steps') return stepsHTML(scene, w, h, dev)
  return shotHTML(scene, w, h, dev)
}

// --------------------------------------------------------------- wyjście ---

const manifest = []
const missing = []
const LANGS = process.argv.slice(2).filter(a => !a.startsWith('-'))
const USE = LANGS.length ? LANGS : Object.keys(L)

/** Brakujący zrzut wychodzi na wierzch, zamiast cicho wyrenderować pustą ramkę. */
function check(scene) {
  if (scene.type === 'shot' && !existsSync(scene.file)) missing.push(scene.file)
  return scene
}

for (const lang of USE) {
  const P = scenesFor(lang)

  // ---- App Store iPhone 6.9" : 645x1398 logicznie -> 1290x2796 @ dsf2 ----
  // To jest dziś jedyny wymagany rozmiar iPhone'a w App Store Connect.
  ORDER.forEach((name, i) => {
    const html = `${BUILD}/ios69-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(check(P[name]), 645, 1398, 'phone'))
    manifest.push({ html, out: `ios69-${lang}/shot-${i + 1}.png`, w: 645, h: 1398 })
  })

  // ---- App Store iPhone 6.5" : 642x1389 logicznie -> 1284x2778 @ dsf2 ----
  // Zostaje dla starszych wpisów, które wciąż mają wypełniony ten slot.
  ORDER.forEach((name, i) => {
    const html = `${BUILD}/ios-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(check(P[name]), 642, 1389, 'phone'))
    manifest.push({ html, out: `ios-${lang}/shot-${i + 1}.png`, w: 642, h: 1389 })
  })

  // ---- App Store iPad 13" : 1024x1366 logicznie -> 2048x2732 @ dsf2 ----
  // Wymagane, dopóki aplikacja ma TARGETED_DEVICE_FAMILY = "1,2".
  const T = scenesFor(lang, '-ipad')
  ORDER.forEach((name, i) => {
    const html = `${BUILD}/ipad-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(check(T[name]), 1024, 1366, 'ipad'))
    manifest.push({ html, out: `ipad-${lang}/shot-${i + 1}.png`, w: 1024, h: 1366 })
  })

  // ---- Google Play telefon : 540x960 logicznie -> 1080x1920 @ dsf2 ----
  ORDER.forEach((name, i) => {
    const html = `${BUILD}/and-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(check(P[name]), 540, 960, 'phone'))
    manifest.push({ html, out: `android-${lang}/phone-${i + 1}.png`, w: 540, h: 960 })
  })

  // ---- Grafika promocyjna 1024x500 (512x250 @ dsf2) ----
  const feat = `${BUILD}/feature-${lang}.html`
  writeFileSync(feat, featureHTML(512, 250, lang))
  manifest.push({ html: feat, out: `android-${lang}/feature-1024x500.png`, w: 512, h: 250 })
}

writeFileSync(`${BUILD}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`HTML: ${manifest.length} ramek (${USE.join(', ')}) -> ${BUILD}`)
if (missing.length) {
  console.log(`\nBRAK ${[...new Set(missing)].length} zrzutow - te ramki wyjda puste:`)
  for (const f of [...new Set(missing)]) console.log('  ', f.replace(SHOTS + '/', ''))
  console.log('  -> node capture.mjs --all   (i --viewport=1024x1366 --tag=ipad dla iPada)')
}
