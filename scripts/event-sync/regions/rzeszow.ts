import type { RegionConfig } from '../types.ts'
import { RZESZOW_VENUES } from './rzeszow-venues.ts'
import { EbiletSource } from '../sources/ebilet.ts'
import { EstradaSource } from '../sources/estrada.ts'
import { MgokTyczynSource } from '../sources/mgoktyczyn.ts'
import { TribeEventsSource } from '../sources/tribe.ts'
import { BiletynaSource } from '../sources/biletyna.ts'

export const RZESZOW: RegionConfig = {
  id: 'rzeszow',
  timezone: 'Europe/Warsaw',
  country: 'PL',
  // Covers Rzeszów + Tyczyn, Boguchwała, Łańcut, Jasionka with margin.
  bbox: { minLat: 49.90, maxLat: 50.20, minLng: 21.80, maxLng: 22.35 },
  center: { lat: 50.0412, lng: 21.9991 },
  cityCoords: {
    'rzeszów':            { lat: 50.0412, lng: 21.9991 },
    'rzeszow':            { lat: 50.0412, lng: 21.9991 },
    'tyczyn':             { lat: 49.9628, lng: 22.0333 },
    'boguchwała':         { lat: 49.9864, lng: 21.9426 },
    'boguchwala':         { lat: 49.9864, lng: 21.9426 },
    'łańcut':             { lat: 50.0687, lng: 22.2291 },
    'lancut':             { lat: 50.0687, lng: 22.2291 },
    'jasionka':           { lat: 50.1109, lng: 22.0242 },
    'trzebownisko':       { lat: 50.0790, lng: 22.0570 },
    'krasne':             { lat: 50.0350, lng: 22.0940 },
    'głogów małopolski':  { lat: 50.1500, lng: 21.9611 },
    'świlcza':            { lat: 50.0530, lng: 21.9070 },
  },
  venues: RZESZOW_VENUES,
  precision: 'strict',
  sources: [
    // eBilet city landing pages (rzeszow, lancut, jasionka) → internal JSON API.
    new EbiletSource(),
    // Estrada Rzeszowska — city culture agency calendar (listing + detail pages).
    new EstradaSource(),
    // MGOK Tyczyn — WP RSS, event dates parsed from post titles.
    new MgokTyczynSource(),
    // Rzeszowski Dom Kultury — open Tribe REST API (same adapter as Tenerife).
    // Events carry a venue name + city but no geo → geocoder resolves them.
    new TribeEventsSource([
      { id: 'rdk', url: 'https://rdk.rzeszow.pl', city: 'Rzeszów', country: 'PL' },
    ]),
    // biletyna.pl — ticketing, JSON-LD ItemList with venue+street+city.
    new BiletynaSource(),
  ],
}
