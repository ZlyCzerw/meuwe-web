import { describe, it, expect } from 'vitest'
import { selectEventAudience, haversineKm, MAX_RADIUS_KM, type AudienceProfile } from './audience'

// Rzeszów center-ish
const EVENT = { lat: 50.0413, lng: 21.9990 }

function profile(over: Partial<AudienceProfile> & { id: string }): AudienceProfile {
  return {
    interests: null,
    radius_km: 10,
    last_lat: EVENT.lat,
    last_lng: EVENT.lng,
    ...over,
  }
}

const NEARBY_MUSIC = profile({ id: 'near-music', interests: ['music'] })
const NEARBY_SPORT = profile({ id: 'near-sport', interests: ['sport'] })
const FAR_MUSIC = profile({ id: 'far-music', interests: ['music'], last_lat: 52.2297, last_lng: 21.0122 })

describe('haversineKm', () => {
  it('measures the Rzeszów → Warszawa distance', () => {
    expect(haversineKm(50.0413, 21.9990, 52.2297, 21.0122)).toBeGreaterThan(240)
    expect(haversineKm(50.0413, 21.9990, 52.2297, 21.0122)).toBeLessThan(280)
  })
})

describe('selectEventAudience — public events', () => {
  it('with tags reaches only nearby users sharing an interest', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: ['music'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT, FAR_MUSIC],
      ...EVENT,
    })
    expect(ids).toEqual(['near-music'])
  })

  it('without tags reaches everyone nearby', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT, FAR_MUSIC],
      ...EVENT,
    })
    expect(ids).toEqual(['near-music', 'near-sport'])
  })

  it('drops the creator when asked to', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      creatorId: 'near-music',
      excludeCreator: true,
      profiles: [NEARBY_MUSIC, NEARBY_SPORT],
      ...EVENT,
    })
    expect(ids).toEqual(['near-sport'])
  })

  it('caps the user radius at MAX_RADIUS_KM', () => {
    const greedy = profile({ id: 'greedy', radius_km: 10_000, last_lat: 52.2297, last_lng: 21.0122 })
    expect(selectEventAudience({ isPrivate: false, tags: [], profiles: [greedy], ...EVENT })).toEqual([])
    expect(MAX_RADIUS_KM).toBe(50)
  })
})

describe('selectEventAudience — public events with creator followers', () => {
  // Obserwowanie twórcy to jawne "chcę wiedzieć o wszystkim od tej osoby" -
  // promień i tagi nie mają tu głosu.
  it('adds followers regardless of distance and interests', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: ['music'],
      followerIds: ['far-sport-fan'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['far-sport-fan', 'near-music'])
  })

  it('does not duplicate a follower who is also nearby', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      followerIds: ['near-music'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['near-music', 'near-sport'])
  })

  // Twórca obserwuje własne wydarzenie od chwili utworzenia, więc zawsze jest
  // w followerIds - i nadal nie ma dostać powiadomienia o sobie.
  it('still drops the creator when they are among the followers', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      creatorId: 'creator',
      excludeCreator: true,
      followerIds: ['creator', 'far-music'],
      profiles: [NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['far-music', 'near-sport'])
  })
})

describe('selectEventAudience — private events', () => {
  it('never fans out by location or interests, even to a perfect tag match', () => {
    const ids = selectEventAudience({
      isPrivate: true,
      tags: ['music'],
      creatorId: 'creator',
      followerIds: [],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT, FAR_MUSIC],
      ...EVENT,
    })
    expect(ids).toEqual(['creator'])
  })

  it('without tags still reaches nobody but the creator and followers', () => {
    const ids = selectEventAudience({
      isPrivate: true,
      tags: [],
      creatorId: 'creator',
      followerIds: ['follower-a', 'follower-b'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT, FAR_MUSIC],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['creator', 'follower-a', 'follower-b'])
  })

  it('reaches followers regardless of distance — a follow is an explicit opt-in', () => {
    const ids = selectEventAudience({
      isPrivate: true,
      tags: ['music'],
      creatorId: 'creator',
      followerIds: ['far-music'],
      profiles: [FAR_MUSIC],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['creator', 'far-music'])
  })

  it('does not duplicate the creator when they also follow', () => {
    const ids = selectEventAudience({
      isPrivate: true,
      tags: [],
      creatorId: 'creator',
      followerIds: ['creator', 'follower-a'],
      profiles: [],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['creator', 'follower-a'])
  })

  it('drops the creator when asked to', () => {
    const ids = selectEventAudience({
      isPrivate: true,
      tags: [],
      creatorId: 'creator',
      excludeCreator: true,
      followerIds: ['creator', 'follower-a'],
      profiles: [NEARBY_MUSIC],
      ...EVENT,
    })
    expect(ids).toEqual(['follower-a'])
  })
})
