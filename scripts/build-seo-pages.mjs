// Buduje statyczne warianty językowe landingu z dist/index.html.
//
// Vite wypluwa jeden index.html z angielskim <head>. Ten skrypt bierze go jako
// szablon i podmienia oznaczony blok SEO na wersję w każdym z pięciu języków,
// zapisując dist/index.html (en), dist/pl/index.html, /de, /es, /sl.
//
// Powód istnienia: <title>, <meta description> i JSON-LD są czytane, zanim
// jakikolwiek JS się wykona. Google indeksuje po nich snippet, a roboty LLM-owe
// w ogóle nie renderują JS, więc bez tego widzą jeden język dla całego świata.
// hreflang mówi Google, którą wersję pokazać komu — dlatego każdy plik wskazuje
// pełny zestaw alternatyw, łącznie z samym sobą, oraz x-default na angielski.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO, LANGS, PATHS, SITE, url } from './seo-content.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

const HEAD_START = '<!-- seo:start -->'
const HEAD_END = '<!-- seo:end -->'
const BODY_START = '<!-- seo-body:start -->'
const BODY_END = '<!-- seo-body:end -->'

// Atrybuty HTML trafiają w content="…", więc cudzysłów musi zniknąć razem z &<>.
const attr = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const text = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// og:locale chce podkreślnika i regionu; dla naszych języków wystarczy powielenie.
const OG_LOCALE = {
  en: 'en_US',
  pl: 'pl_PL',
  de: 'de_DE',
  es: 'es_ES',
  sl: 'sl_SI',
}

function jsonLd(lang) {
  const s = SEO[lang]
  const page = url(lang)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: 'meuwe',
        url: SITE,
        description: s.orgDescription,
        email: 'wiktor.marc@gmail.com',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: SITE,
        name: 'meuwe',
        inLanguage: s.htmlLang,
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${page}#webpage`,
        url: page,
        name: s.title,
        description: s.description,
        inLanguage: s.htmlLang,
        isPartOf: { '@id': `${SITE}/#website` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE}/#product`,
        name: 'meuwe',
        applicationCategory: 'SocialNetworkingApplication',
        operatingSystem: 'Web, iOS, Android',
        description: s.appDescription,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        featureList: s.featureList,
        inLanguage: LANGS.map(l => SEO[l].htmlLang),
        provider: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${page}#faq`,
        inLanguage: s.htmlLang,
        mainEntity: s.faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

function headBlock(lang) {
  const s = SEO[lang]
  const page = url(lang)

  // Każdy wariant wymienia wszystkie alternatywy łącznie z sobą — Google odrzuca
  // niesymetryczne zestawy hreflang i wtedy ignoruje je w całości.
  const alternates = LANGS.map(
    l => `    <link rel="alternate" hreflang="${SEO[l].htmlLang}" href="${url(l)}"/>`
  ).join('\n')

  const ogAlternates = LANGS.filter(l => l !== lang)
    .map(l => `    <meta property="og:locale:alternate" content="${OG_LOCALE[l]}"/>`)
    .join('\n')

  return `${HEAD_START}
    <title>${text(s.title)}</title>
    <meta name="description" content="${attr(s.description)}"/>
    <meta name="keywords" content="${attr(s.keywords)}"/>
    <meta name="author" content="meuwe"/>

    <meta property="og:title" content="${attr(s.ogTitle)}"/>
    <meta property="og:description" content="${attr(s.ogDescription)}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:url" content="${page}"/>
    <meta property="og:locale" content="${OG_LOCALE[lang]}"/>
${ogAlternates}
    <meta property="og:image" content="${SITE}/og-image.png"/>
    <meta property="og:image:secure_url" content="${SITE}/og-image.png"/>
    <meta property="og:image:width" content="1200"/>
    <meta property="og:image:height" content="630"/>
    <meta property="og:image:type" content="image/png"/>
    <meta property="og:site_name" content="meuwe"/>

    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="${attr(s.ogTitle)}"/>
    <meta name="twitter:description" content="${attr(s.ogDescription)}"/>
    <meta name="twitter:image" content="${SITE}/og-image.png"/>

    <link rel="canonical" href="${page}"/>
${alternates}
    <link rel="alternate" hreflang="x-default" href="${url(LANGS[0])}"/>

    <script type="application/ld+json">
${JSON.stringify(jsonLd(lang), null, 2)}
    </script>
${HEAD_END}`
}

function bodyBlock(lang) {
  const n = SEO[lang].noscript
  const sections = n.sections
    .map(sec => `      <h2>${text(sec.h2)}</h2>\n      <p>${text(sec.p)}</p>`)
    .join('\n')

  // <noscript> zamiast prerenderu: React montuje się do #root i nigdy tego nie
  // dotyka, więc treść nie miga użytkownikowi, a roboty bez JS mają co czytać.
  return `${BODY_START}
    <noscript>
      <h1>${text(n.h1)}</h1>
      <p>${text(n.intro)}</p>
${sections}
    </noscript>
${BODY_END}`
}

function sliceBetween(html, start, end, label) {
  const a = html.indexOf(start)
  const b = html.indexOf(end)
  if (a === -1 || b === -1 || b < a) {
    throw new Error(
      `build-seo-pages: nie znalazłem znaczników ${label} w dist/index.html. ` +
        `Czy index.html nadal zawiera ${start} … ${end}?`
    )
  }
  return [html.slice(0, a), html.slice(b + end.length)]
}

const template = readFileSync(join(DIST, 'index.html'), 'utf8')

// Walidacja obu bloków przed pierwszym zapisem — inaczej częściowy przebieg
// zostawiłby dist w stanie, w którym część języków ma stary <head>.
sliceBetween(template, HEAD_START, HEAD_END, 'seo:start/seo:end')
sliceBetween(template, BODY_START, BODY_END, 'seo-body:start/seo-body:end')

for (const lang of LANGS) {
  const [headBefore, headAfter] = sliceBetween(template, HEAD_START, HEAD_END, 'head')
  let html = headBefore + headBlock(lang) + headAfter

  const [bodyBefore, bodyAfter] = sliceBetween(html, BODY_START, BODY_END, 'body')
  html = bodyBefore + bodyBlock(lang) + bodyAfter

  html = html.replace(/<html lang="[^"]*"/, `<html lang="${SEO[lang].htmlLang}"`)

  const out = PATHS[lang] ? join(DIST, PATHS[lang], 'index.html') : join(DIST, 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html, 'utf8')
  console.log(`  ${SEO[lang].htmlLang.padEnd(2)} → ${out.replace(ROOT + '/', '')}`)
}

console.log(`build-seo-pages: zapisano ${LANGS.length} wariantów językowych`)
