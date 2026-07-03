import type { Coords, RegionConfig } from '../types.ts'
import { LagendaSource } from '../sources/lagenda.ts'
import { TribeEventsSource } from '../sources/tribe.ts'
import { EcoEntradasSource } from '../sources/ecoentradas.ts'
import { TenerifeMusicSource } from '../sources/tenerifemusic.ts'
import { RomeriasSource } from '../sources/romerias.ts'
import { AronaSource } from '../sources/arona.ts'
import { AdejeSource } from '../sources/adeje.ts'

// Fallback coordinates for known municipalities, keyed by lowercase name.
// Moved verbatim from mapper.ts (MUNICIPALITY_COORDS).
const CITY_COORDS: Record<string, Coords> = {
  // Tenerife
  'santa cruz de tenerife':       { lat: 28.4636,  lng: -16.2518 },
  'santa cruz':                   { lat: 28.4636,  lng: -16.2518 },
  'san cristóbal de la laguna':   { lat: 28.4854,  lng: -16.3159 },
  'la laguna':                    { lat: 28.4854,  lng: -16.3159 },
  'puerto de la cruz':            { lat: 28.4165,  lng: -16.5506 },
  'arona':                        { lat: 28.0994,  lng: -16.6828 },
  'adeje':                        { lat: 28.1222,  lng: -16.7270 },
  'granadilla de abona':          { lat: 28.1219,  lng: -16.5798 },
  'granadilla':                   { lat: 28.1219,  lng: -16.5798 },
  'los realejos':                 { lat: 28.3913,  lng: -16.5891 },
  'la orotava':                   { lat: 28.3895,  lng: -16.5228 },
  'icod de los vinos':            { lat: 28.3695,  lng: -16.7213 },
  'garachico':                    { lat: 28.3728,  lng: -16.7611 },
  'güímar':                       { lat: 28.3096,  lng: -16.4129 },
  'candelaria':                   { lat: 28.3561,  lng: -16.3734 },
  'san miguel de abona':          { lat: 28.0335,  lng: -16.6315 },
  'el médano':                    { lat: 28.0454,  lng: -16.5341 },
  'los cristianos':               { lat: 28.0532,  lng: -16.7150 },
  'playa de las américas':        { lat: 28.0534,  lng: -16.7289 },
  'costa adeje':                  { lat: 28.0870,  lng: -16.7324 },
  'vilaflor':                     { lat: 28.1567,  lng: -16.6367 },
  'tegueste':                     { lat: 28.5110,  lng: -16.3283 },
  'el sauzal':                    { lat: 28.4726,  lng: -16.4274 },
  'la guancha':                   { lat: 28.3551,  lng: -16.6441 },
  'buenavista del norte':         { lat: 28.3785,  lng: -16.8647 },
  'los silos':                    { lat: 28.3763,  lng: -16.8208 },
  'tacoronte':                    { lat: 28.4728,  lng: -16.4090 },
  'la matanza':                   { lat: 28.4805,  lng: -16.4406 },
  'el rosario':                   { lat: 28.4555,  lng: -16.2973 },
  'arafo':                        { lat: 28.3361,  lng: -16.4180 },
  'arico':                        { lat: 28.1659,  lng: -16.4872 },
  'fasnia':                       { lat: 28.2264,  lng: -16.4404 },
  'punta del hidalgo':            { lat: 28.5706,  lng: -16.3213 },
  'tejina':                       { lat: 28.5270,  lng: -16.3383 },
  'santa úrsula':                 { lat: 28.4297,  lng: -16.4738 },
  'valle san lorenzo':            { lat: 28.0743,  lng: -16.6372 },
  'santiago del teide':           { lat: 28.2949,  lng: -16.8174 },
  'los gigantes':                 { lat: 28.2436,  lng: -16.8417 },
  // Other Canary Islands
  'las palmas de gran canaria':   { lat: 28.1235,  lng: -15.4363 },
  'las palmas':                   { lat: 28.1235,  lng: -15.4363 },
  'gran canaria':                 { lat: 28.1235,  lng: -15.4363 },
  'lanzarote':                    { lat: 29.0469,  lng: -13.5899 },
  'fuerteventura':                { lat: 28.3587,  lng: -14.0537 },
  'la palma':                     { lat: 28.6835,  lng: -17.7642 },
  'la gomera':                    { lat: 28.0916,  lng: -17.1150 },
  'el hierro':                    { lat: 27.7440,  lng: -18.0032 },
}

export const TENERIFE: RegionConfig = {
  id: 'tenerife',
  timezone: 'Atlantic/Canary',
  country: 'ES',
  bbox: { minLat: 27.99, maxLat: 28.62, minLng: -16.95, maxLng: -16.10 },
  center: { lat: 28.2916, lng: -16.6291 },
  cityCoords: CITY_COORDS,
  venues: [], // v1 had no venue registry; backfilling is out of scope
  precision: 'lenient',
  sources: [
    new LagendaSource(),
    // The Events Calendar (Tribe) REST API across municipal WordPress sites.
    // No API key; add more towns in TRIBE_SITES (sources/tribe.ts).
    new TribeEventsSource(),
    // ecoentradas.com — Canary Islands cultural ticketing, filtered to Tenerife.
    new EcoEntradasSource(),
    // tenerife.music — island-wide concert/music agenda via JSON-LD ItemList.
    new TenerifeMusicSource(),
    // Casa de los Balcones — island-wide romerías & fiestas calendar (HTML).
    new RomeriasSource(),
    // Ayuntamiento de Arona — municipal agenda (DNN), page 1 (near-term).
    new AronaSource(),
    // Ayuntamiento de Adeje — municipal agenda (LIST view, single page).
    new AdejeSource(),
  ],
}
