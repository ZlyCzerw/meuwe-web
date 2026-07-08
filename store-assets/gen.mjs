import { writeFileSync } from 'node:fs'

const SHOTS = '/Users/wiktormarc/meuwe-web/public/screenshots'

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

// smiley mascot (grass blob + face) reused from icon
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
  return `<div class="display" style="font-weight:900;font-size:${fs}px;letter-spacing:-${fs*0.03}px;line-height:1">
    <span style="color:var(--orange)">me</span><span style="color:var(--sky)">u</span><span style="color:var(--grass)">we</span>
  </div>`
}

function phone(img, w) {
  const h = Math.round(w / 0.463)
  return `<div style="width:${w}px;height:${h}px;border-radius:${w*0.13}px;border:3px solid var(--ink);
    box-shadow:${w*0.03}px ${w*0.03}px 0 var(--ink);overflow:hidden;background:#fff;flex:none">
    <img src="file://${img}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>
  </div>`
}

// ---- FEATURE GRAPHIC 1024x500 (logical 512x250, dsf2) ----
const feature = `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:512px;height:250px;overflow:hidden;position:relative;
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
      Descubre eventos<br>a tu alrededor
    </div>
    <div class="body" style="font-weight:700;font-size:14px;color:#8A8580;margin-top:10px">
      Mapa · Chat · Comunidad
    </div>
  </div>
  <div style="position:absolute;right:34px;top:50%;transform:translateY(-50%) rotate(6deg)">
    ${phone(`${SHOTS}/map-es.png`, 150)}
  </div>
</body></html>`
writeFileSync('/Users/wiktormarc/meuwe-web/store-assets/_feature.html', feature)

// ---- PHONE SCREENSHOTS 1080x1920 (logical 540x960, dsf2) ----
const screens = [
  { file: 'map-es.png',   tint: 'var(--cream)',  eyebrow: 'EVENTOS CERCA DE TI',  caption: 'Descubre qué pasa\na tu alrededor' },
  { file: 'event-es.png', tint: 'var(--cream2)', eyebrow: 'UN TOQUE PARA UNIRTE', caption: 'Toca un pin y\núnete al momento' },
  { file: 'new-es.png',   tint: 'var(--cream)',  eyebrow: 'CREA TU PLAN',          caption: 'Tu evento en\n10 segundos' },
]

screens.forEach((s, i) => {
  const html = `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:540px;height:960px;overflow:hidden;position:relative;
  background:linear-gradient(160deg,${s.tint},var(--cream2));
  display:flex;flex-direction:column;align-items:center}
</style></head><body>
  <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:var(--orange);opacity:.10;top:-80px;right:-60px"></div>
  <div style="position:absolute;width:200px;height:200px;border-radius:50%;background:var(--grass);opacity:.10;bottom:60px;left:-70px"></div>
  ${smiley(30, 'var(--berry)', 40, 70, -14, .9)}
  ${smiley(24, 'var(--sun)', 470, 110, 10, .9)}
  <div style="text-align:center;margin-top:80px;z-index:2;padding:0 30px">
    <div class="display" style="font-weight:800;font-size:15px;letter-spacing:2px;color:var(--orange)">${s.eyebrow}</div>
    <div class="display" style="font-weight:900;font-size:40px;line-height:1.1;color:var(--ink);margin-top:10px;white-space:pre-line">${s.caption}</div>
  </div>
  <div style="margin-top:46px;z-index:2">${phone(`${SHOTS}/${s.file}`, 300)}</div>
  <div style="position:absolute;bottom:30px">${wordmark(26)}</div>
</body></html>`
  writeFileSync(`/Users/wiktormarc/meuwe-web/store-assets/_shot${i + 1}.html`, html)
})

// ---- INTRO SCREENSHOT (shot4) ----
const intro = `<!doctype html><html><head><meta charset="utf-8">${fontHead}<style>${base}
body{width:540px;height:960px;overflow:hidden;position:relative;
  background:linear-gradient(160deg,var(--cream),var(--cream2));
  display:flex;flex-direction:column;align-items:center;justify-content:center}
</style></head><body>
  <div style="position:absolute;width:340px;height:340px;border-radius:50%;background:var(--sky);opacity:.10;top:-90px;left:-80px"></div>
  <div style="position:absolute;width:260px;height:260px;border-radius:50%;background:var(--orange);opacity:.10;bottom:-60px;right:-60px"></div>
  ${smiley(46, 'var(--grass)', 60, 180, -12, .95)}
  ${smiley(34, 'var(--berry)', 430, 240, 12, .95)}
  ${smiley(28, 'var(--sun)', 110, 700, 8, .95)}
  ${smiley(38, 'var(--sky)', 410, 680, -10, .95)}
  <div style="text-align:center;z-index:2;padding:0 40px">
    ${wordmark(92)}
    <div class="display" style="font-weight:800;font-size:34px;line-height:1.15;color:var(--ink);margin-top:24px">
      Eventos locales,<br>en tiempo real
    </div>
    <div class="body" style="font-weight:700;font-size:19px;color:#8A8580;margin-top:18px">
      Sin anuncios. Sin algoritmos.
    </div>
  </div>
</body></html>`
writeFileSync('/Users/wiktormarc/meuwe-web/store-assets/_shot4.html', intro)

console.log('HTML written')
