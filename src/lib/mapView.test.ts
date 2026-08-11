import { describe, it, expect } from 'vitest'
import { nextFetchView, fetchBox, FETCH_MARGIN, MAX_FETCH_KM } from './mapView'

// Warsaw-ish, where a degree of longitude is ~0.62 of a degree of latitude.
const LAT = 52
const LNG = 21

describe('fetchBox', () => {
  it('reaches further in longitude than in latitude away from the equator', () => {
    const b = fetchBox({ lat: LAT, lng: LNG, km: 4 })
    expect(b.maxLat - LAT).toBeCloseTo(4 / 111, 6)
    expect(b.maxLng - LNG).toBeGreaterThan(b.maxLat - LAT)
  })
})

describe('nextFetchView', () => {
  it('fetches when nothing has been fetched yet', () => {
    const next = nextFetchView(null, { lat: LAT, lng: LNG, km: 3 })
    expect(next).not.toBeNull()
    expect(next!.lat).toBe(LAT)
    expect(next!.lng).toBe(LNG)
  })

  it('fetches a box wider than the viewport, by the margin', () => {
    const next = nextFetchView(null, { lat: LAT, lng: LNG, km: 10 })
    expect(next!.km).toBe(Math.ceil(10 * FETCH_MARGIN))
  })

  it('asks for nothing while the viewport stays inside what was fetched', () => {
    const covered = { lat: LAT, lng: LNG, km: 4 }
    expect(nextFetchView(covered, { lat: LAT, lng: LNG, km: 3 })).toBeNull()
    // Zooming in is always covered by the wider view it came from.
    expect(nextFetchView(covered, { lat: LAT, lng: LNG, km: 1 })).toBeNull()
  })

  it('asks again once the viewport leaves any one side', () => {
    const covered = { lat: LAT, lng: LNG, km: 4 }
    const escapes = [
      { lat: LAT + 0.01, lng: LNG, km: 3 },  // north
      { lat: LAT - 0.01, lng: LNG, km: 3 },  // south
      { lat: LAT, lng: LNG + 0.02, km: 3 },  // east
      { lat: LAT, lng: LNG - 0.02, km: 3 },  // west
    ]
    escapes.forEach(v => expect(nextFetchView(covered, v)).not.toBeNull())
  })

  it('asks again when the viewport zooms out past what was fetched', () => {
    const covered = { lat: LAT, lng: LNG, km: 4 }
    const next = nextFetchView(covered, { lat: LAT, lng: LNG, km: 12 })
    expect(next).not.toBeNull()
    expect(next!.km).toBe(Math.ceil(12 * FETCH_MARGIN))
  })

  // The longitude delta is the wider of the two up here, so the same numeric
  // offset can sit inside the box east-west and outside it north-south. A box
  // built with one delta for both axes gets this backwards.
  it('judges longitude with the longitude delta at a high latitude', () => {
    const covered = { lat: 70, lng: 20, km: 4 }
    expect(nextFetchView(covered, { lat: 70, lng: 20.02, km: 3 })).toBeNull()
    expect(nextFetchView(covered, { lat: 70.02, lng: 20, km: 3 })).not.toBeNull()
  })

  it('never asks for more than the ceiling, however far the map is zoomed out', () => {
    const next = nextFetchView(null, { lat: LAT, lng: LNG, km: 4000 })
    expect(next!.km).toBe(MAX_FETCH_KM)
  })

  // At the ceiling the fetched box cannot contain the viewport, so a
  // requirement equal to the viewport would refetch on every single moveend.
  // The requirement shrinks to the ceiling less the margin instead.
  it('keeps its margin at the ceiling instead of refetching on every pan', () => {
    const covered = nextFetchView(null, { lat: LAT, lng: LNG, km: 500 })!
    expect(covered.km).toBe(MAX_FETCH_KM)
    expect(nextFetchView(covered, { lat: LAT + 0.05, lng: LNG, km: 500 })).toBeNull()
    // Far enough out and it does ask again.
    expect(nextFetchView(covered, { lat: LAT + 1, lng: LNG, km: 500 })).not.toBeNull()
  })
})
