import type { CSSProperties } from 'react'
import { C } from './tokens'
import { findLinks } from './links'

/** Ten sam styl, co linki w `renderArticle.tsx` — brandowy pomarańcz i podkreślenie. */
const linkStyle: CSSProperties = { color: C.primary, textDecoration: 'underline' }

/**
 * Tekst z klikalnymi adresami.
 *
 * `target="_blank"` to tutaj droga do domyślnej przeglądarki, nie ozdoba: na
 * webie otwiera nową kartę, a w powłoce Capacitora nawigacja poza origin
 * aplikacji trafia do przeglądarki systemowej. Tak samo działa przycisk
 * "dojazd" w karcie wydarzenia.
 */
export function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0

  findLinks(text).forEach((link, i) => {
    if (link.start > last) parts.push(text.slice(last, link.start))
    parts.push(
      <a href={link.href} key={i} rel="noopener noreferrer" style={linkStyle} target="_blank">
        {link.text}
      </a>,
    )
    last = link.end
  })

  if (last < text.length) parts.push(text.slice(last))
  return parts
}
