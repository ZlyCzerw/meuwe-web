import { describe, it, expect } from 'vitest'
import { pinHTML, privateHTML, clusterHTML } from './mapIcons'
import { pinImageUrl } from './pinImages'
import { TAG_META } from '../lib/tokens'

const now = Date.now()
const LIVE_S = new Date(now - 3600e3).toISOString()
const LIVE_E = new Date(now + 3600e3).toISOString()
const PAST_S = '2020-01-01T10:00:00Z'
const PAST_E = '2020-01-01T12:00:00Z'

function parse(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}
const elements = (html: string) => parse(html).querySelectorAll('*').length

describe('pin markup', () => {
  it('plain pin: 4 elements, image of its variant, no CSS filter', () => {
    const html = pinHTML('music', 4, 'upcoming', PAST_S, PAST_E)
    expect(elements(html)).toBe(4)
    expect(parse(html).querySelector('img')!.getAttribute('src')).toBe(pinImageUrl({ kind: 'public', category: 'music', blob: 1 }))
    expect(html).not.toContain('filter')
  })

  it('live pin adds the two halos (6 elements)', () => {
    expect(elements(pinHTML('music', 0, 'live', LIVE_S, LIVE_E))).toBe(6)
  })

  it('scale from interactions stays on the 44x44 box', () => {
    expect(pinHTML('art', 0, undefined, undefined, undefined, 1.25)).toContain('transform:scale(1.250);transform-origin:bottom center;')
  })

  it('unknown category falls back to party', () => {
    const html = pinHTML('nope', 0)
    expect(html).toContain(pinImageUrl({ kind: 'public', category: 'party', blob: 0 }))
    expect(html).toContain(`background:${TAG_META.party.color}`)
  })

  it('private pin: 4 elements, 6 when live, white dot', () => {
    expect(elements(privateHTML(false))).toBe(4)
    expect(elements(privateHTML(true))).toBe(6)
    expect(privateHTML(false)).toContain('background:white')
  })

  it('cluster: 7 elements, 9 when live, count as text', () => {
    expect(elements(clusterHTML('food', 0, 'upcoming', PAST_S, PAST_E, 3))).toBe(7)
    expect(elements(clusterHTML('food', 0, 'live', LIVE_S, LIVE_E, 3))).toBe(9)
    expect(parse(clusterHTML('food', 0, 'upcoming', PAST_S, PAST_E, 12)).textContent).toContain('>9')
  })

  it('images do not take clicks or drags', () => {
    const img = parse(pinHTML('music', 0)).querySelector('img')!
    expect(img.getAttribute('draggable')).toBe('false')
    expect(img.getAttribute('style')).toContain('pointer-events:none')
  })
})
