import { BLOBS, TAG_META, type Category } from '../lib/tokens'
import { isCurrentlyLive } from '../lib/eventStatus'

export function pinHTML(category: string, idx: number, _dbStatus?: string, startTime?: string, endTime?: string, scale = 1): string {
  const meta = TAG_META[category as Category] || TAG_META.party
  const path = BLOBS[idx % BLOBS.length]
  const isLive = startTime && endTime
    ? isCurrentlyLive({ start_time: startTime, end_time: endTime })
    : false
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
  ` : ''
  const scaleStyle = scale !== 1 ? `transform:scale(${scale.toFixed(3)});transform-origin:bottom center;` : ''
  return `<div style="position:relative;width:44px;height:56px;">
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;${scaleStyle}">
      ${halos}
      <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
        <path d="${path}" fill="${meta.color}" stroke="#2D2B2A" stroke-width="5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;top:10px;left:0;width:44px;display:flex;align-items:center;justify-content:center;font-size:18px;pointer-events:none">${meta.glyph}</div>
    </div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${meta.color};border:2.5px solid #2D2B2A"></div>
  </div>`
}

export function meHTML(): string {
  return `<div style="position:relative;width:72px;height:72px">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s ease-out infinite;opacity:0"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s 1.4s ease-out infinite;opacity:0"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;animation:breathe-sm 3s ease-in-out infinite">
      <div style="width:26px;height:26px;border-radius:52% 48% 50% 50%/50% 52% 48% 50%;background:#FF7A45;border:3px solid #2D2B2A;box-shadow:0 3px 0 #2D2B2A33"></div>
    </div>
  </div>`
}

export function privateHTML(isLive = false): string {
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #ffffff;animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #ffffff;animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
  ` : ''
  // BLOBS[0] is the first blob shape — fixed for all private pins (consistent look)
  const path = BLOBS[0]
  return `<div style="position:relative;width:44px;height:56px;">
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;">
      ${halos}
      <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
        <path d="${path}" fill="#2D2B2A" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;top:11px;left:0;width:44px;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
          <rect x="1" y="1" width="20" height="9" rx="4" fill="white"/>
          <ellipse cx="7" cy="5.5" rx="2.5" ry="2.2" fill="#2D2B2A"/>
          <ellipse cx="15" cy="5.5" rx="2.5" ry="2.2" fill="#2D2B2A"/>
        </svg>
      </div>
    </div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:#2D2B2A;border:2.5px solid #ffffff"></div>
  </div>`
}
