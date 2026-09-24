import { describe, it, expect } from 'vitest'
import L from 'leaflet'

// Kadrowanie trzyma markery poza mapą i zmienia im ikonę, zanim wrócą.
// To sprawdza, że Leaflet przyjmuje setIcon/setLatLng bez mapy i pokazuje
// najnowszą ikonę po addTo.
describe('Leaflet marker off the map', () => {
  it('setIcon and setLatLng while removed, then addTo shows the latest icon', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const map = L.map(el).setView([50, 20], 10)
    const icon = (html: string) => L.divIcon({ html, className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56] })
    const m = L.marker([50, 20], { icon: icon('<b>old</b>') }).addTo(map)
    m.remove()
    m.setIcon(icon('<b>new</b>'))
    m.setLatLng([50.1, 20.1])
    let clicks = 0
    m.on('click', () => { clicks++ })
    m.addTo(map)
    expect(m.getElement()!.innerHTML).toContain('new')
    m.fire('click')
    expect(clicks).toBe(1)
    map.remove()
    el.remove()
  })
})
