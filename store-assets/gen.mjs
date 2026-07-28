import { writeFileSync, mkdirSync } from 'node:fs'

const ROOT = '/Users/wiktormarc/meuwe-web/store-assets'
const BUILD = `${ROOT}/_build`
const SHOTS = '/Users/wiktormarc/meuwe-web/public/screenshots'
mkdirSync(BUILD, { recursive: true })

const fontHead = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;700;800;900&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
`

const base = `
* { margin:0; padding:0; box-sizing:border-box; }
:root{
  --orange:#FF7A45; --sky:#4FC3F7; --grass:#7DD87A; --sun:#FFD54F;
  --berry:#FF8FA3; --cream:#FFF6EC; --cream2:#FFF0DF; --ink:#2D2B2A;
}
.display{ font-family:"Hanken Grotesk","Nunito",system-ui,sans-serif; }
.body{ font-family:"Nunito",system-ui,sans-serif; }
`

function smiley(size, color, x, y, rot = 0, op = 1) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"
    style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);opacity:${op}">
    <path d="M50 8 C71 8 92 22 92 47 C92 73 76 92 50 92 C25 92 8 75 8 50 C8 26 28 8 50 8 Z"
      fill="${color}" stroke="#2D2B2A" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="38" cy="44" rx="4.5" ry="6" fill="#2D2B2A"/>
    <ellipse cx="62" cy="44" rx="4.5" ry="6" fill="#2D2B2A"/>
    <path d="M34 60 q16 14 32 0" stroke="#2D2B2A" stroke-width="6" fill="none" stroke-linecap="round"/>
  </svg>`
}

function wordmark(fs) {
  return `<div class="display" style="font-weight:900;font-size:${fs}px;letter-spacing:-${fs * 0.03}px;line-height:1">
    <span style="color:var(--orange)">me</span><span style="color:var(--sky)">u</span><span style="color:var(--grass)">we</span>
  </div>`
}

function phone(img, w) {
  const h = Math.round(w / 0.463)
  return `<div style="width:${w}px;height:${h}px;border-radius:${w * 0.13}px;border:3px solid var(--ink);
    box-shadow:${w * 0.03}px ${w * 0.03}px 0 var(--ink);overflow:hidden;background:#fff;flex:none">
    <img src="file://${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>
  </div>`
}

// ---- Copy per language (no long dashes; middot is fine) ----
// Wording follows src/locales/<lang>.ts (tagline, f1..f3) so the store frames
// speak the same way the app does.
const COPY = {
  pl: {
    introTitle: 'Lokalne wydarzenia,<br>na żywo',
    introSub: 'Bez reklam. Bez algorytmów.',
    mapEyebrow: 'WYDARZENIA W POBLIŻU', mapCaption: 'Odkryj, co dzieje się\nwokół Ciebie',
    clusterEyebrow: 'WIELE WYDARZEŃ, JEDNO MIEJSCE', clusterCaption: 'Zobacz wszystkie\nw jednym pinie',
    eventEyebrow: 'JEDNO DOTKNIĘCIE, BY DOŁĄCZYĆ', eventCaption: 'Dotknij pina i\ndołącz do wydarzenia',
    createEyebrow: 'STWÓRZ SWÓJ PLAN', createCaption: 'Twoje wydarzenie\nw 10 sekund',
    featTitle: 'Odkrywaj wydarzenia<br>wokół Ciebie', featSub: 'Mapa · Czat · Społeczność',
  },
  en: {
    introTitle: 'Local events,<br>live',
    introSub: 'No ads. No algorithms.',
    mapEyebrow: 'EVENTS NEAR YOU', mapCaption: "Discover what's happening\naround you",
    clusterEyebrow: 'MANY EVENTS, ONE SPOT', clusterCaption: 'See them all\nin one pin',
    eventEyebrow: 'ONE TAP TO JOIN', eventCaption: 'Tap a pin and\njoin the event',
    createEyebrow: 'CREATE YOUR OWN MEETUP', createCaption: 'Your event\nin 10 seconds',
    featTitle: 'Discover events<br>around you', featSub: 'Map · Chat · Community',
  },
  de: {
    introTitle: 'Lokale Events,<br>live',
    introSub: 'Keine Werbung. Keine Algorithmen.',
    mapEyebrow: 'EVENTS IN DEINER NÄHE', mapCaption: 'Entdecke, was um dich\nherum passiert',
    clusterEyebrow: 'VIELE EVENTS, EIN ORT', clusterCaption: 'Sieh sie alle\nin einem Pin',
    eventEyebrow: 'EIN TAP ZUM MITMACHEN', eventCaption: 'Tippe einen Pin\nund sei dabei',
    createEyebrow: 'ERSTELLE DEIN TREFFEN', createCaption: 'Dein Event\nin 10 Sekunden',
    featTitle: 'Entdecke Events<br>in deiner Nähe', featSub: 'Karte · Chat · Community',
  },
  sl: {
    introTitle: 'Lokalni dogodki,<br>v živo',
    introSub: 'Brez oglasov. Brez algoritmov.',
    mapEyebrow: 'DOGODKI V BLIŽINI', mapCaption: 'Odkrij, kaj se dogaja\nokoli tebe',
    clusterEyebrow: 'VEČ DOGODKOV, ENO MESTO', clusterCaption: 'Poglej vse\nv enem pinu',
    eventEyebrow: 'EN DOTIK DO PRIDRUŽITVE', eventCaption: 'Tapni pin in se\npridruži dogodku',
    createEyebrow: 'USTVARI SVOJE SREČANJE', createCaption: 'Dogodek\nv 10 sekundah',
    featTitle: 'Odkrij dogodke<br>v svoji okolici', featSub: 'Zemljevid · Klepet · Skupnost',
  },
}

// iPad mockup: 4:3-ish body, thinner bezel radius than the phone. Fed with the
// real 1024x1366 captures, so the frames show the tablet layout (full chip row,
// zoom buttons) rather than a phone shot stretched onto a tablet canvas.
function tablet(img, w) {
  const h = Math.round(w / 0.75)
  return `<div style="width:${w}px;height:${h}px;border-radius:${w * 0.045}px;border:3px solid var(--ink);
    box-shadow:${w * 0.018}px ${w * 0.018}px 0 var(--ink);overflow:hidden;background:#fff;flex:none">
    <img src="file://${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>
  </div>`
}

// The cluster frame needs a city that actually has same-zone pins on the day it
// was shot: Rzeszów for pl, Ljubljana (zoomed in) for sl. en/de have no such
// shot, so they leave the frame out rather than show a Polish city.
const CLUSTER_SHOT = { pl: 'map-rzeszow-pl.png', sl: 'map-cluster-sl.png' }
// iPad shots were all taken fresh, so every language has a cluster frame here.
// pl keeps Rzeszów (its own city); the rest use Ljubljana, the only place with
// reliable same-zone pins right now - Tenerife is down to a single pin.
const CLUSTER_SHOT_IPAD = {
  pl: 'map-rzeszow-ipad-pl.png', en: 'map-cluster-ipad-en.png',
  de: 'map-cluster-ipad-de.png', sl: 'map-cluster-ipad-sl.png',
}
// No "create" or "event" on tablet: create needs a session, and the event sheet
// leaves a large empty band at the bottom of a 1366pt-tall screen.
const IPAD_SET = ['intro', 'map', 'mapCluster']

// Scenes per language, in store order. Frames are dropped where no screenshot
// exists: sl has no "create" shot (the "+" is gated on a session), en/de have
// no cluster shot.
const SETS = {
  pl: { ios: ['intro', 'map', 'mapCluster', 'event', 'create'], and: ['map', 'event', 'create', 'intro'] },
  en: { ios: ['intro', 'map', 'event', 'create'],               and: ['map', 'event', 'create', 'intro'] },
  de: { ios: ['intro', 'map', 'event', 'create'],               and: ['map', 'event', 'create', 'intro'] },
  sl: { ios: ['intro', 'map', 'mapCluster', 'event'],           and: ['map', 'mapCluster', 'event', 'intro'] },
}

// Screenshot files are per language: map-<lang>.png etc. The "map" shot is
// Tenerife for pl/en/de and Ljubljana for sl - whichever had events to show.
function scenesFor(lang, tag = '') {
  const c = COPY[lang]
  return {
    intro: { type: 'intro', tint: 'var(--cream)', title: c.introTitle, sub: c.introSub },
    map: {
      type: 'shot', file: `map${tag}-${lang}.png`, tint: 'var(--cream)',
      eyebrow: c.mapEyebrow, caption: c.mapCaption,
    },
    mapCluster: {
      type: 'shot', file: (tag ? CLUSTER_SHOT_IPAD : CLUSTER_SHOT)[lang], tint: 'var(--cream2)',
      eyebrow: c.clusterEyebrow, caption: c.clusterCaption,
    },
    event: {
      type: 'shot', file: `event-${lang}.png`, tint: 'var(--cream2)',
      eyebrow: c.eventEyebrow, caption: c.eventCaption,
    },
    create: {
      type: 'shot', file: `new-${lang}.png`, tint: 'var(--cream)',
      eyebrow: c.createEyebrow, caption: c.createCaption,
    },
  }
}

// The iPad canvas is far squarer than the phone one (0.75 vs 0.46), so the
// phone mockup has to be sized off the height instead of the width - at the
// phone's 0.56 width fraction it would be taller than the frame.
function shotHTML(s, w, h, dev = 'phone') {
  const pad = Math.round(w * 0.055)
  const pad13 = dev === 'ipad'
  const pw = Math.round(w * (pad13 ? 0.72 : 0.56))
  const topPad = Math.round(h * (pad13 ? 0.066 : 0.085))
  const capGap = Math.round(h * (pad13 ? 0.037 : 0.045))
  const eyebrowFs = Math.round(w * (pad13 ? 0.0255 : 0.028))
  const captionFs = Math.round(w * (pad13 ? 0.062 : 0.075))
  const wmFs = Math.round(w * (pad13 ? 0.042 : 0.049))
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  background:linear-gradient(160deg,${s.tint},var(--cream2));
  display:flex;flex-direction:column;align-items:center}
</style></head><body>
  <div style="position:absolute;width:${w * 0.56}px;height:${w * 0.56}px;border-radius:50%;background:var(--orange);opacity:.10;top:${-h * 0.08}px;right:${-w * 0.11}px"></div>
  <div style="position:absolute;width:${w * 0.37}px;height:${w * 0.37}px;border-radius:50%;background:var(--grass);opacity:.10;bottom:${h * 0.06}px;left:${-w * 0.13}px"></div>
  ${smiley(w * 0.056, 'var(--berry)', w * 0.074, h * 0.073, -14, .9)}
  ${smiley(w * 0.044, 'var(--sun)', w * 0.87, h * 0.115, 10, .9)}
  <div style="text-align:center;margin-top:${topPad}px;z-index:2;padding:0 ${pad}px">
    <div class="display" style="font-weight:800;font-size:${eyebrowFs}px;letter-spacing:${w * 0.0037}px;color:var(--orange)">${s.eyebrow}</div>
    <div class="display" style="font-weight:900;font-size:${captionFs}px;line-height:1.1;color:var(--ink);margin-top:${h * 0.01}px;white-space:pre-line">${s.caption}</div>
  </div>
  <div style="margin-top:${capGap}px;z-index:2">${(pad13 ? tablet : phone)(`${SHOTS}/${s.file}`, pw)}</div>
  <div style="position:absolute;bottom:${Math.round(h * 0.03)}px">${wordmark(wmFs)}</div>
</body></html>`
}

function introHTML(s, w, h, dev = 'phone') {
  const pad13 = dev === 'ipad'
  const wmFs = w * (pad13 ? 0.13 : 0.17)
  const titleFs = w * (pad13 ? 0.05 : 0.063)
  const subFs = w * (pad13 ? 0.028 : 0.035)
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  background:linear-gradient(160deg,var(--cream),var(--cream2));
  display:flex;flex-direction:column;align-items:center;justify-content:center}
</style></head><body>
  <div style="position:absolute;width:${w * 0.63}px;height:${w * 0.63}px;border-radius:50%;background:var(--sky);opacity:.10;top:${-h * 0.065}px;left:${-w * 0.15}px"></div>
  <div style="position:absolute;width:${w * 0.48}px;height:${w * 0.48}px;border-radius:50%;background:var(--orange);opacity:.10;bottom:${-h * 0.045}px;right:${-w * 0.11}px"></div>
  ${smiley(w * 0.085, 'var(--grass)', w * 0.11, h * 0.19, -12, .95)}
  ${smiley(w * 0.063, 'var(--berry)', w * 0.80, h * 0.25, 12, .95)}
  ${smiley(w * 0.052, 'var(--sun)', w * 0.20, h * 0.73, 8, .95)}
  ${smiley(w * 0.070, 'var(--sky)', w * 0.76, h * 0.71, -10, .95)}
  <div style="text-align:center;z-index:2;padding:0 ${w * 0.075}px">
    ${wordmark(wmFs)}
    <div class="display" style="font-weight:800;font-size:${titleFs}px;line-height:1.15;color:var(--ink);margin-top:${h * 0.017}px">
      ${s.title}
    </div>
    <div class="body" style="font-weight:700;font-size:${subFs}px;color:#8A8580;margin-top:${h * 0.013}px">
      ${s.sub}
    </div>
  </div>
</body></html>`
}

function featureHTML(w, h, lang) {
  const c = COPY[lang]
  return `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:${w}px;height:${h}px;overflow:hidden;position:relative;
  background:linear-gradient(135deg,var(--cream),var(--cream2));}
.blob{position:absolute;border-radius:50%;filter:blur(2px)}
</style></head><body>
  <div class="blob" style="width:220px;height:220px;background:var(--orange);opacity:.12;top:-60px;right:120px"></div>
  <div class="blob" style="width:160px;height:160px;background:var(--sky);opacity:.12;bottom:-50px;left:-30px"></div>
  ${smiley(34, 'var(--berry)', 28, 30, -12, .95)}
  ${smiley(26, 'var(--sun)', 250, 18, 8, .95)}
  <div style="position:absolute;left:40px;top:50%;transform:translateY(-50%);max-width:300px">
    ${wordmark(64)}
    <div class="display" style="font-weight:800;font-size:24px;color:var(--ink);margin-top:14px;line-height:1.15">
      ${c.featTitle}
    </div>
    <div class="body" style="font-weight:700;font-size:14px;color:#8A8580;margin-top:10px">
      ${c.featSub}
    </div>
  </div>
  <div style="position:absolute;right:34px;top:50%;transform:translateY(-50%) rotate(6deg)">
    ${phone(`${SHOTS}/map-${lang}.png`, 150)}
  </div>
</body></html>`
}

function build(scene, w, h, dev = 'phone') {
  if (scene.type === 'intro') return introHTML(scene, w, h, dev)
  return shotHTML(scene, w, h, dev)
}

const manifest = []
// Pass languages as args to limit the run, e.g. `node gen.mjs sl de`.
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COPY)

for (const lang of LANGS) {
  const S = scenesFor(lang)

  // ---- App Store iPhone 6.5" : logical 642x1389 -> 1284x2778 @ dsf2 ----
  const IOS = SETS[lang].ios.map(n => S[n])
  IOS.forEach((scene, i) => {
    const html = `${BUILD}/ios-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(scene, 642, 1389))
    manifest.push({ html, out: `ios-${lang}/shot-${i + 1}.png`, w: 642, h: 1389 })
  })

  // ---- App Store iPad 13" : logical 1024x1366 -> 2048x2732 @ dsf2 ----
  // Required whenever the app ships with TARGETED_DEVICE_FAMILY = "1,2".
  const SP = scenesFor(lang, '-ipad')
  const IPAD = IPAD_SET.map(n => SP[n])
  IPAD.forEach((scene, i) => {
    const html = `${BUILD}/ipad-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(scene, 1024, 1366, 'ipad'))
    manifest.push({ html, out: `ipad-${lang}/shot-${i + 1}.png`, w: 1024, h: 1366 })
  })

  // ---- Android : logical 540x960 -> 1080x1920 @ dsf2 ----
  const AND = SETS[lang].and.map(n => S[n])
  AND.forEach((scene, i) => {
    const html = `${BUILD}/and-${lang}-shot-${i + 1}.html`
    writeFileSync(html, build(scene, 540, 960))
    manifest.push({ html, out: `android-${lang}/phone-${i + 1}.png`, w: 540, h: 960 })
  })

  // ---- Feature graphic 1024x500 (logical 512x250 @ dsf2) ----
  const feat = `${BUILD}/feature-${lang}.html`
  writeFileSync(feat, featureHTML(512, 250, lang))
  manifest.push({ html: feat, out: `android-${lang}/feature-1024x500.png`, w: 512, h: 250 })
}

writeFileSync(`${BUILD}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`HTML written: ${manifest.length} frames (${LANGS.join(', ')}) -> ${BUILD}`)
