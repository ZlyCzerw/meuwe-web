import { BLOBS, TAG_META, type Category } from '../lib/tokens'

export function pinHTML(category: string, idx: number, status?: string): string {
  const meta = TAG_META[category as Category] || TAG_META.party
  const path = BLOBS[idx % BLOBS.length]
  const isLive = status === 'live' || status === 'extended'
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
  ` : ''
  return `<div style="position:relative;width:44px;height:56px;">
    ${halos}
    <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
      <path d="${path}" fill="${meta.color}" stroke="#2D2B2A" stroke-width="5" stroke-linejoin="round"/>
    </svg>
    <div style="position:absolute;top:10px;left:0;width:44px;display:flex;align-items:center;justify-content:center;font-size:18px;pointer-events:none">${meta.glyph}</div>
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
