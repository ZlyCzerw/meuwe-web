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

// ---- Polish scenes (no long dashes; middot is fine) ----
const SCENES = {
  intro: {
    type: 'intro', tint: 'var(--cream)',
    title: 'Lokalne wydarzenia,<br>na żywo',
    sub: 'Bez reklam. Bez algorytmów.',
  },
  mapTenerife: {
    type: 'shot', file: 'map-pl.png', tint: 'var(--cream)',
    eyebrow: 'WYDARZENIA W POBLIŻU', caption: 'Odkryj, co dzieje się\nwokół Ciebie',
  },
  mapRzeszow: {
    type: 'shot', file: 'map-rzeszow-pl.png', tint: 'var(--cream2)',
    eyebrow: 'WIELE WYDARZEŃ, JEDNO MIEJSCE', caption: 'Zobacz wszystkie\nw jednym pinie',
  },
  event: {
    type: 'shot', file: 'event-pl.png', tint: 'var(--cream2)',
    eyebrow: 'JEDNO DOTKNIĘCIE, BY DOŁĄCZYĆ', caption: 'Dotknij pina i\ndołącz do wydarzenia',
  },
  create: {
    type: 'shot', file: 'new-pl.png', tint: 'var(--cream)',
    eyebrow: 'STWÓRZ SWÓJ PLAN', caption: 'Twoje wydarzenie\nw 10 sekund',
  },
}

function shotHTML(s, w, h) {
  const pad = Math.round(w * 0.055)
  const pw = Math.round(w * 0.56)
  const topPad = Math.round(h * 0.085)
  const capGap = Math.round(h * 0.045)
  const eyebrowFs = Math.round(w * 0.028)
  const captionFs = Math.round(w * 0.075)
  const wmFs = Math.round(w * 0.049)
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
  <div style="margin-top:${capGap}px;z-index:2">${phone(`${SHOTS}/${s.file}`, pw)}</div>
  <div style="position:absolute;bottom:${Math.round(h * 0.03)}px">${wordmark(wmFs)}</div>
</body></html>`
}

function introHTML(s, w, h) {
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
    ${wordmark(w * 0.17)}
    <div class="display" style="font-weight:800;font-size:${w * 0.063}px;line-height:1.15;color:var(--ink);margin-top:${h * 0.017}px">
      ${s.title}
    </div>
    <div class="body" style="font-weight:700;font-size:${w * 0.035}px;color:#8A8580;margin-top:${h * 0.013}px">
      ${s.sub}
    </div>
  </div>
</body></html>`
}

function featureHTML(w, h) {
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
      Odkrywaj wydarzenia<br>wokół Ciebie
    </div>
    <div class="body" style="font-weight:700;font-size:14px;color:#8A8580;margin-top:10px">
      Mapa · Czat · Społeczność
    </div>
  </div>
  <div style="position:absolute;right:34px;top:50%;transform:translateY(-50%) rotate(6deg)">
    ${phone(`${SHOTS}/map-pl.png`, 150)}
  </div>
</body></html>`
}

function build(scene, w, h) {
  if (scene.type === 'intro') return introHTML(scene, w, h)
  return shotHTML(scene, w, h)
}

const manifest = []

// ---- App Store iPhone 6.5" : logical 642x1389 -> 1284x2778 @ dsf2 ----
const IOS = [SCENES.intro, SCENES.mapTenerife, SCENES.mapRzeszow, SCENES.event, SCENES.create]
IOS.forEach((scene, i) => {
  const html = `${BUILD}/ios-shot-${i + 1}.html`
  writeFileSync(html, build(scene, 642, 1389))
  manifest.push({ html, out: 'ios-pl/shot-' + (i + 1) + '.png', w: 642, h: 1389 })
})

// ---- Android (Polish) : logical 540x960 -> 1080x1920 @ dsf2 ----
const AND = [SCENES.mapTenerife, SCENES.event, SCENES.create, SCENES.intro]
AND.forEach((scene, i) => {
  const html = `${BUILD}/and-shot-${i + 1}.html`
  writeFileSync(html, build(scene, 540, 960))
  manifest.push({ html, out: 'android-pl/phone-' + (i + 1) + '.png', w: 540, h: 960 })
})

// ---- Feature graphic 1024x500 (logical 512x250 @ dsf2) ----
const feat = `${BUILD}/feature.html`
writeFileSync(feat, featureHTML(512, 250))
manifest.push({ html: feat, out: 'android-pl/feature-1024x500.png', w: 512, h: 250 })

writeFileSync(`${BUILD}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`HTML written: ${manifest.length} frames -> ${BUILD}`)
