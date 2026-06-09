import type { CSSProperties } from 'react'
import { C, F } from './tokens'

const paraStyle: CSSProperties = { fontFamily: F.body, fontSize: 16, color: C.inkSoft, lineHeight: 1.7, marginBottom: 24 }
const h3Style: CSSProperties  = { fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.ink, marginBottom: 16, marginTop: 32 }
const h4Style: CSSProperties  = { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 12, marginTop: 24 }
const h5Style: CSSProperties  = { fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8,  marginTop: 20 }
const linkStyle: CSSProperties = { color: C.primary, textDecoration: 'underline' }

export function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/\S+)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) parts.push(<strong key={i} style={{ fontWeight: 800, color: C.ink }}>{m[1]}</strong>)
    else if (m[2] !== undefined) parts.push(<em key={i}>{m[2]}</em>)
    else if (m[3] !== undefined) parts.push(<a key={i} href={m[4]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[3]}</a>)
    else if (m[5] !== undefined) parts.push(<a key={i} href={m[5]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[5]}</a>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function renderArticle(markdown: string): React.ReactNode {
  const blocks = markdown.split(/\n\n+/)
  return blocks.map((block, idx) => {
    const line = block.trim()
    if (line.startsWith('### ')) return <h5 key={idx} style={h5Style}>{renderInline(line.slice(4))}</h5>
    if (line.startsWith('## '))  return <h4 key={idx} style={h4Style}>{renderInline(line.slice(3))}</h4>
    if (line.startsWith('# '))   return <h3 key={idx} style={h3Style}>{renderInline(line.slice(2))}</h3>
    return <p key={idx} style={paraStyle}>{renderInline(line)}</p>
  })
}
