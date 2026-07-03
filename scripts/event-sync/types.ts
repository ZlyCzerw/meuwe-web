// ─── Scrape options passed to every source ───────────────────────────────────

export interface ScrapeOptions {
  dateFrom: Date;  // inclusive
  dateTo: Date;    // inclusive
}

// ─── Raw event as returned by any source ─────────────────────────────────────
// Sources produce RawEvents; the orchestrator geocodes + maps them to MeuweEvents.

export interface RawEvent {
  /** Globally unique. Format: '{sourceId}:{nativeId}', e.g. 'lagenda:41994' */
  externalId: string;
  title: string;
  description: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' in local time, or null if unknown */
  startHour: string | null;
  /** 'HH:MM' in local time, or null if unknown */
  endHour: string | null;
  /** Specific venue/place name */
  venueName: string;
  /** City or municipality */
  city: string;
  /** Street address if the source provides one, e.g. 'Chopina 30' */
  address?: string;
  /** ISO country code, e.g. 'ES'. Used as hint for geocoding. */
  country: string;
  /** Raw category strings from the source (will be mapped to meuwe categories) */
  categories: string[];
  /** Original URL of the event page, for debugging */
  sourceUrl?: string;
  /** Cover image URL (e.g. og:image), if any */
  imageUrl?: string;
}

// ─── Source interface — implement this for every new event website ────────────

export interface Source {
  /** Short identifier, e.g. 'lagenda'. Used as prefix in externalId. */
  readonly id: string;
  /** Human-readable name for logging */
  readonly name: string;
  scrape(options: ScrapeOptions): Promise<RawEvent[]>;
}

// ─── Internal types used after geocoding + mapping ───────────────────────────

export interface Coords {
  lat: number;
  lng: number;
}

// ─── Region configuration ─────────────────────────────────────────────────────

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** A hand-verified venue with normalized name aliases for registry matching. */
export interface VenueEntry {
  /** Canonical display name */
  name: string;
  /** Normalized aliases (lowercase, no diacritics — see geocoder normalizeName) */
  aliases: string[];
  city: string;
  lat: number;
  lng: number;
}

export interface RegionConfig {
  id: string;
  /** IANA timezone, e.g. 'Europe/Warsaw' */
  timezone: string;
  /** ISO country code, e.g. 'PL' */
  country: string;
  /** Every strict-mode geocode result must fall inside this box */
  bbox: Bbox;
  /** Last-resort coords (lenient mode only) */
  center: Coords;
  /** Municipality fallback coords, keyed by lowercase city name */
  cityCoords: Record<string, Coords>;
  venues: VenueEntry[];
  sources: Source[];
  /** 'strict': venue or drop. 'lenient': v1 fallback chain. */
  precision: 'strict' | 'lenient';
}

export interface MeuweEvent {
  externalId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  placeName: string;
  category: string;
  /** UTC */
  startTime: Date;
  /** UTC */
  endTime: Date;
  tags: string[];
  /** Cover image URLs (maps to events.photos text[]) */
  photos: string[];
}
