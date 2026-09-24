import { TAG_META, type Category } from '../lib/tokens'
import { isCurrentlyLive } from '../lib/eventStatus'
import { formatClusterCount } from '../lib/eventClusters'
import { pinImageUrl, PIN_IMG_W, PIN_IMG_H, BADGE_IMG, BADGE_IMG_H } from './pinImages'

// Pinezka to obrazek z pinImages.ts (blob + cień + glif) plus to, czego obrazek
// nie umie: pulsujące halo, kropka pod spodem i liczba w odznace, pisana
// fontem strony, do którego <img> nie ma dostępu.

function halosHTML(color: string): string {
  const ring = (delay: string) =>
    `<div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${color};animation:halo 2.8s${delay} ease-out infinite;opacity:0;pointer-events:none"></div>`
  return ring('') + ring(' 1.4s')
}

function imgHTML(url: string, w: number, h: number): string {
  return `<img src="${url}" width="${w}" height="${h}" alt="" draggable="false" style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;pointer-events:none">`
}

function pinBody(url: string, haloColor: string, dotColor: string, live: boolean, scale: number, extra = ''): string {
  const scaleStyle = scale !== 1 ? `transform:scale(${scale.toFixed(3)});transform-origin:bottom center;` : ''
  return `<div style="position:relative;width:44px;height:56px;">`
    + `<div style="position:absolute;top:0;left:0;width:44px;height:44px;${scaleStyle}">`
    + (live ? halosHTML(haloColor) : '')
    + imgHTML(url, PIN_IMG_W, PIN_IMG_H)
    + `</div>`
    + `<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${dotColor};border:2.5px solid #2D2B2A"></div>`
    + extra
    + `</div>`
}

function knownCategory(category: string): Category {
  return (TAG_META[category as Category] ? category : 'party') as Category
}

export function pinHTML(category: string, idx: number, _dbStatus?: string, startTime?: string, endTime?: string, scale = 1): string {
  const cat = knownCategory(category)
  const color = TAG_META[cat].color
  const live = startTime && endTime
    ? isCurrentlyLive({ start_time: startTime, end_time: endTime })
    : false
  return pinBody(pinImageUrl({ kind: 'public', category: cat, blob: idx }), color, color, live, scale)
}

export function meHTML(): string {
  return `<div style="position:relative;width:72px;height:72px">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s ease-out infinite;opacity:0"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s 1.4s ease-out infinite;opacity:0"></div>
    </div>
    <!-- Direction indicator: orbiting chevron, ink stroke matching the marker outline.
         Hidden until a compass heading is applied (see MapScreen). transform-origin
         is the marker centre so rotate() makes the chevron orbit the "me" dot. -->
    <div class="me-heading" style="position:absolute;inset:0;opacity:0;transform-origin:36px 36px;transition:transform .15s linear,opacity .25s ease">
      <svg width="72" height="72" viewBox="0 0 72 72" style="overflow:visible">
        <g transform="translate(36,12)" style="filter:drop-shadow(0 1.5px 0 #2D2B2A22)">
          <path d="M-7 6 L0 -5 L7 6" fill="none" stroke="#2D2B2A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;animation:breathe-sm 3s ease-in-out infinite">
      <div style="width:26px;height:26px;border-radius:52% 48% 50% 50%/50% 52% 48% 50%;background:#FF7A45;border:3px solid #2D2B2A;box-shadow:0 3px 0 #2D2B2A33"></div>
    </div>
  </div>`
}

export function privateHTML(isLive = false): string {
  return pinBody(pinImageUrl({ kind: 'private' }), '#2D2B2A', 'white', isLive, 1)
}

// Representative pin for a same-zone cluster (size >= 2): the normal pin plus a
// comic circle badge (white, ink outline, no tail) in the upper-right carrying
// the event count. Same 44x56 icon box as pinHTML; the badge sits in the pin's
// own container rather than in an extra wrapper.
export function clusterHTML(
  category: string,
  idx: number,
  _dbStatus: string | undefined,
  startTime: string,
  endTime: string,
  count: number,
): string {
  const cat = knownCategory(category)
  const color = TAG_META[cat].color
  const live = isCurrentlyLive({ start_time: startTime, end_time: endTime })
  const label = formatClusterCount(count)
  const fontSize = label.length > 1 ? 11 : 14
  const badge = `<div style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;pointer-events:none">`
    + imgHTML(pinImageUrl({ kind: 'badge' }), BADGE_IMG, BADGE_IMG_H)
    + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Hanken Grotesk','Nunito',sans-serif;font-size:${fontSize}px;font-weight:900;color:#2D2B2A">${label}</div>`
    + `</div>`
  return pinBody(pinImageUrl({ kind: 'public', category: cat, blob: idx }), color, color, live, 1, badge)
}
