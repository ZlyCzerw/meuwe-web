import { createClient, type Session } from '@supabase/supabase-js'
import type { EventWithMeta, EventWithMsgCount, Message, Profile, ProfilePrivate } from './types'
import type { SignupContext } from './signupContext'
import { bboxDeltas, haversineKm, MAX_MAP_KM } from './geo'
import { PROBE_DAYS, type ProbeEvent } from './emptyState'
import { ASK_MAX_AGE_MS, type AskCandidate } from './attendanceAsk'
import { markSignedOut, takeSignedOutFlag, googleOAuthOptions } from './authPrompt'
import { isNativePlatform, isIOS } from './platform'
import { WEB_ORIGIN } from './appConfig'
import { langFromPath } from './i18n'
import { downscaleImage } from './imageResize'
import { rangeWindow } from './timeline'
import type { EventHit } from './searchResults'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce' },
})

// Where Supabase should send the browser back after OAuth.
//
// The trailing slash is load-bearing. Supabase validates this against the
// project's Redirect URLs and silently falls back to Site URL when it does not
// match: a bare "https://meuwe.eu" can miss a "https://meuwe.eu/**" pattern, and
// then a real user is thrown at whatever Site URL happens to say. With the slash
// it matches both the exact entry and the wildcard one.
// Natywnie `location.origin` to wewnętrzny origin WebView (https://localhost na
// Androidzie), pod który przeglądarka systemowa nie ma jak wrócić — logowanie
// kończyło się w Chrome na nieosiągalnym adresie. Odsyłamy więc na App Link
// meuwe.eu, który aplikacja przechwytuje (intent-filter w AndroidManifest), i
// dokańczamy wymianę kodu w `appUrlOpen`.
function authRedirectTo(): string {
  if (isNativePlatform()) return `${WEB_ORIGIN}/`
  // Wejście z /de/ ma wrócić na /de/, inaczej adres przestaje być sobą: nie da
  // się go udostępnić, a ktoś bez ręcznie wybranego języka dostaje po powrocie
  // język przeglądarki. Prefiks czytamy tym samym langFromPath, którego używa
  // detectInitialLang — dwa źródła prawdy rozjechałyby się przy pierwszej zmianie.
  const lang = langFromPath(location.pathname)
  return lang ? `${location.origin}/${lang}/` : `${location.origin}/`
}

// Nazwa pokazywana obok wydarzeń i wiadomości liczona jest w bazie
// (profiles.name_shown = nickname, a w jego braku display_name). Aliasujemy ją
// z powrotem na `display_name`, żeby każdy ekran czytał jedno pole i żeby
// reguła nie rozłaziła się po pięciu zapytaniach.
const PROFILE_PUBLIC = 'display_name:name_shown,avatar_color'

/** Ceiling on rows one map query may return. See getEvents. */
const MAP_EVENT_LIMIT = 1500
/** Ile trafień po tytule pobiera wyszukiwarka - lista pokaże kilka, reszta jest
 *  zapasem na sortowanie po odległości po stronie klienta. */
const SEARCH_EVENT_LIMIT = 20

export const db = {
  signInGoogle() {
    if (isNativePlatform()) {
      // native: dynamic import keeps the Firebase plugin out of the web bundle
      return import('./nativeAuth').then(m => m.signInGoogleNative())
    }
    // Google reuses whatever account the browser is already in unless asked
    // otherwise, so someone who just signed out to switch accounts would be put
    // straight back into the one they left. See lib/authPrompt.
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: googleOAuthOptions(authRedirectTo(), takeSignedOutFlag()),
    })
  },
  signInApple() {
    if (isIOS()) {
      // iOS: native Apple sign-in; dynamic import keeps Firebase out of the web bundle
      return import('./nativeAuth').then(m => m.signInAppleNative())
    }
    // web + Android: Supabase OAuth redirect
    return supabase.auth.signInWithOAuth({ provider:'apple', options:{ redirectTo: authRedirectTo() } })
  },
  // Dokończenie logowania, które wróciło App Linkiem z przeglądarki. Rzuca
  // wyjątkiem, żeby wywołujący mógł pokazać błąd zamiast zostawić użytkownika
  // na ekranie logowania bez słowa wyjaśnienia.
  async completeOAuth(code: string) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw new Error(error.message)
  },
  /**
   * Signing out has to end at Supabase whatever else happens, so the provider
   * cleanup is best-effort and logged rather than awaited into the happy path.
   * Without it the native Google client keeps the account and the next sign-in
   * skips the picker entirely.
   */
  async signOut() {
    markSignedOut()
    if (isNativePlatform()) {
      try {
        const m = await import('./nativeAuth')
        await m.signOutNative()
      } catch (err) {
        console.error('[auth] native signOut failed:', err)
      }
    }
    return supabase.auth.signOut()
  },
  onAuthChange(cb:(s:Session|null)=>void) { return supabase.auth.onAuthStateChange((_e,s)=>cb(s)) },
  async getSession() { const {data}=await supabase.auth.getSession(); return data.session },
  async getProfile(uid:string):Promise<Profile|null> {
    // Explicit columns (not '*'): anon/authenticated lack SELECT on the location
    // columns (last_lat/last_lng/last_seen_at), so 'select=*' 403s. getProfile
    // never needs location — it's write-only from the client.
    const {data}=await supabase.from('profiles').select('id,display_name,nickname,name_shown,avatar_color,bio,home_name,creator_kind,link_url,radius_km,interests,interests_onboarded_at,created_at,push_enabled,language').eq('id',uid).single(); return data as Profile|null
  },
  // UPDATE, never upsert. A profile row is created in exactly one place: the
  // handle_new_user trigger on auth.users (migration 20260729). An upsert here
  // would quietly create a second birthplace for profiles — one that only knows
  // the id and the single field being written, so it produces rows with no
  // display_name. That is what made every staging event read "Dodane przez ?".
  //
  // NOTE: the trailing `.select('id')` is load-bearing.
  // profiles has a column-level SELECT grant that omits the location columns
  // (last_lat/last_lng/last_seen_at) to hide them from other users' reads
  // (migration 20260702_profiles_hide_location). A bare write makes PostgREST
  // return the FULL row representation (RETURNING *), which needs SELECT on every
  // column — including the ungranted location ones — and fails with
  // 42501 "permission denied for table profiles". Selecting only `id` (which IS
  // granted) narrows the RETURNING to a readable column, so the write succeeds
  // while location stays hidden. Do not remove the `.select('id')`.
  async updateProfile(p:Partial<Profile>&{id:string}) {
    const { id, ...fields } = p
    const res = await supabase.from('profiles').update(fields).eq('id', id).select('id')
    // Zero rows means the profile does not exist, which after the trigger fix
    // should be impossible. Say so instead of letting the write vanish.
    if (!res.error && (res.data?.length ?? 0) === 0) {
      console.error('[updateProfile] no profile row for', id, '— the signup trigger did not run')
    }
    return res
  },
  // Unlike the other profiles writes, location touches the SELECT-hidden columns
  // (last_lat/last_lng/last_seen_at), so even `.select('id')` can't save a direct
  // upsert — writing columns the caller can't SELECT trips 42501 at the merge/
  // on-conflict step. Location writes therefore go through a SECURITY DEFINER RPC
  // that runs as owner (bypasses column grants + RLS) and returns void, keeping the
  // columns hidden. See migration 20260708_update_my_location_rpc.sql.
  // `_uid` is unused — the RPC derives the user from auth.uid().
  async updateProfileLocation(_uid:string, lat:number, lng:number) {
    return supabase.rpc('update_my_location', { p_lat: lat, p_lng: lng })
  },
  async updateProfileLanguage(uid: string, language: string) {
    return this.updateProfile({ id: uid, language })
  },
  // profiles_private: tylko własny wiersz (RLS), wszystkie kolumny czytelne dla
  // właściciela - stąd '*' jest tu bezpieczne, inaczej niż w getProfile.
  // maybeSingle, bo wiersz powstaje leniwie i może go jeszcze nie być.
  async getProfilePrivate(uid: string): Promise<ProfilePrivate | null> {
    const { data, error } = await supabase.from('profiles_private').select('*').eq('id', uid).maybeSingle()
    if (error) { console.error('[getProfilePrivate]', error); return null }
    return (data as ProfilePrivate | null) ?? null
  },
  // Jedyna tabela profilu, w której upsert jest właściwy: nie ma triggera, który
  // zakładałby wiersz przy rejestracji, więc pierwszy zapis musi go stworzyć.
  async upsertProfilePrivate(p: Partial<ProfilePrivate> & { id: string }) {
    return supabase.from('profiles_private').upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select('id')
  },
  // RPC „wypełnij tylko puste” - patrz migracja 20260902_profile_fields.
  async recordSignupContext(ctx: SignupContext) {
    return supabase.rpc('record_signup_context', {
      p_ip_lat: ctx.ipLat, p_ip_lng: ctx.ipLng, p_country: ctx.country,
      p_gps_lat: ctx.gpsLat, p_gps_lng: ctx.gpsLng,
      p_platform: ctx.platform, p_app_version: ctx.appVersion,
      p_provider: ctx.provider, p_source: ctx.source,
    })
  },
  /**
   * Zakończone wydarzenia, które użytkownik obserwuje, wraz z informacją, czy
   * już sam odpowiedział. Dwa zapytania zamiast joina: PostgREST nie zagnieżdża
   * tabeli, do której filtr idzie po innym użytkowniku.
   */
  async getAttendanceCandidates(uid: string): Promise<AskCandidate[]> {
    const since = new Date(Date.now() - ASK_MAX_AGE_MS).toISOString()
    const { data: follows, error } = await supabase
      .from('event_follows')
      .select('event_id, events!inner(id, title, end_time)')
      .eq('user_id', uid)
      .gte('events.end_time', since)
      .lte('events.end_time', new Date().toISOString())
    if (error) { console.error('[attendance] follows query failed:', error); return [] }

    const rows = (follows ?? []) as unknown as {
      event_id: string
      events: { title: string; end_time: string }
    }[]
    if (rows.length === 0) return []

    const { data: answers } = await supabase
      .from('event_attendance')
      .select('event_id, source')
      .eq('user_id', uid)
      .in('event_id', rows.map(r => r.event_id))
    const answered = new Set(
      ((answers ?? []) as { event_id: string; source: string }[])
        .filter(a => a.source === 'self')
        .map(a => a.event_id),
    )

    return rows.map(r => ({
      eventId: r.event_id,
      title: r.events.title,
      endTime: r.events.end_time,
      answered: answered.has(r.event_id),
    }))
  },

  /** Deklaracja użytkownika nadpisuje automat — on wie lepiej. */
  async recordAttendance(eventId: string, attended: boolean) {
    const sess = await this.getSession()
    if (!sess) return { error: { message: 'not authenticated' } }
    return supabase.from('event_attendance').upsert(
      {
        user_id: sess.user.id,
        event_id: eventId,
        attended,
        source: 'self',
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' },
    )
  },
  /**
   * Four coordinates per event and nothing else, for the week ahead.
   *
   * getEvents is the wrong tool for "is there anything around here at all": it
   * joins profiles and tags and then makes a second round trip for interaction
   * counts, and an empty map would have paid that three times over. This asks
   * the one question the empty card and the startup zoom both need, once.
   *
   * Returns null — not an empty array — when the query fails, so callers can
   * tell "nothing is happening" apart from "we could not find out".
   */
  async probeNearby(lat: number, lng: number): Promise<ProbeEvent[] | null> {
    const { dLat, dLng } = bboxDeltas(MAX_MAP_KM, lat)
    const now = new Date()
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + PROBE_DAYS + 1)
    horizon.setHours(0, 0, 0, 0)

    const { data, error } = await supabase.from('events')
      .select('lat, lng, start_time, end_time')
      .gte('lat', lat - dLat).lte('lat', lat + dLat).gte('lng', lng - dLng).lte('lng', lng + dLng)
      .in('status', ['live', 'upcoming', 'extended'])
      .lte('start_time', horizon.toISOString())
      .gte('end_time', now.toISOString())
    if (error) { console.error('[probeNearby]', error); return null }
    return (data ?? []) as ProbeEvent[]
  },
  /**
   * Returns null — not an empty array — when the query fails, the same
   * convention probeNearby uses above and for the same reason: the map keeps
   * the events it already has across a pan, and a failed request that looked
   * like "there is nothing here" would delete perfectly good pins.
   */
  /**
   * `dayOffsetEnd` domyślnie równa się początkowi, więc wywołanie jednodniowe
   * pyta dokładnie o to samo, co przed wprowadzeniem zakresów.
   */
  async getEvents(lat:number,lng:number,km=15,dayOffsetStart=0,dayOffsetEnd=dayOffsetStart):Promise<EventWithMeta[]|null> {
    const {dLat,dLng}=bboxDeltas(km,lat)
    const { dayEnd, endTimeFloor } = rangeWindow(dayOffsetStart, dayOffsetEnd)

    const {data,error}=await supabase.from('events')
      .select(`*,profiles(${PROFILE_PUBLIC}),event_tags(tag)`)
      .gte('lat',lat-dLat).lte('lat',lat+dLat).gte('lng',lng-dLng).lte('lng',lng+dLng)
      .in('status',['live','upcoming','extended'])
      .lte('start_time', dayEnd.toISOString())
      .gte('end_time',   endTimeFloor.toISOString())
      .order('created_at',{ascending:false})
      // The fetch radius is no longer capped at the notification radius, so one
      // pinch-out over a dense city can address a very large box. Newest first,
      // so what falls off the end is the oldest — invisible at that zoom.
      .limit(MAP_EVENT_LIMIT)
    if(error){console.error(error);return null}
    const events = (data||[]).map((e:any)=>{
      const dk=haversineKm(lat,lng,e.lat,e.lng)
      return {...e, tags:(e.event_tags||[]).map((t:any)=>t.tag),
        distKm:dk, distStr:dk<1?`${Math.round(dk*1000)} m`:`${dk.toFixed(1)} km`}
    })
    const eventIds = events.map((e:any) => e.id)
    let interactionMap: Record<string, number> = {}
    if (eventIds.length > 0) {
      const { data: counts } = await supabase.rpc('get_event_interactions', { event_ids: eventIds })
      if (counts) {
        ;(counts as { event_id: string; interaction_count: number }[]).forEach(r => {
          interactionMap[r.event_id] = Number(r.interaction_count)
        })
      }
    }
    return events.map((e:any) => ({ ...e, interactionCount: interactionMap[e.id] ?? 0 }))
  },
  // Jedyne miejsce, w którym zdjęcie trafia do bucketa — aparat i oba
  // `input[type=file]` schodzą się tutaj. Dlatego zbijanie rozmiaru siedzi w
  // tym miejscu, a nie w trzech miejscach w `CreateSheet`.
  async uploadEventPhoto(file:File):Promise<string> {
    const sess=await this.getSession(); if(!sess) throw new Error('not authenticated')
    const photo=await downscaleImage(file)
    const ext=photo.name.split('.').pop()||'jpg'
    const path=`${sess.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('event-photos').upload(path,photo,{contentType:photo.type})
    if(error) throw error
    const {data}=supabase.storage.from('event-photos').getPublicUrl(path)
    return data.publicUrl
  },
  // Fast pre-check mirroring the DB trigger; returns true if a public pin's
  // 3x3 m zone overlaps this candidate during an overlapping time window.
  // Fails OPEN (returns false) on error — the BEFORE-INSERT trigger (MW001) is
  // the real guard, so a transient RPC failure must not block a valid create.
  async eventZoneConflict(p: {
    lat: number; lng: number; start: string; end: string; excludeId?: string | null
  }): Promise<boolean> {
    const { data, error } = await supabase.rpc('event_zone_conflict', {
      p_lat: p.lat, p_lng: p.lng, p_start: p.start, p_end: p.end,
      p_exclude_id: p.excludeId ?? null,
    })
    if (error) { console.error('[eventZoneConflict]', error); return false }
    return data === true
  },
  async createEvent(ev: {
    title: string; description?: string; lat: number; lng: number;
    placeName?: string; category?: string; tags?: string[];
    start_time?: string; end_time?: string; photos?: string[];
    is_private?: boolean;
  }) {
    const sess = await this.getSession(); if (!sess) return { data: null, error: { message: 'not authenticated' } }
    const { data, error } = await supabase.from('events').insert({
      title: ev.title, description: ev.description, lat: ev.lat, lng: ev.lng,
      place_name: ev.placeName, category: ev.category || 'party',
      start_time: ev.start_time || new Date().toISOString(),
      end_time: ev.end_time || new Date(Date.now() + 86400000).toISOString(),
      creator_id: sess.user.id, status: 'live',
      photos: ev.photos || [],
      is_private: ev.is_private ?? false,
    }).select().single()
    if (!error && data) {
      if (ev.tags?.length) await supabase.from('event_tags').insert(ev.tags.map(tag => ({ event_id: data.id, tag })))
      await supabase.from('event_follows').insert({ user_id: sess.user.id, event_id: data.id })
    }
    return { data, error }
  },
  async getMyEvents(userId: string): Promise<EventWithMsgCount[]> {
    const { data, error } = await supabase
      .from('events')
      .select(`*, profiles(${PROFILE_PUBLIC}), event_tags(tag)`)
      .eq('creator_id', userId)
      .order('start_time', { ascending: false })
    if (error) { console.error(error); return [] }

    const eventIds = (data || []).map((e: any) => e.id)
    let countMap: Record<string, number> = {}

    if (eventIds.length > 0) {
      // Single SQL COUNT query via RPC — replaces fetching all message rows
      const { data: counts, error: countErr } = await supabase
        .rpc('get_event_message_counts', { event_ids: eventIds })
      if (countErr) console.error('[getMyEvents] count rpc error:', countErr)
      if (counts) {
        ;(counts as { event_id: string; msg_count: number }[]).forEach(r => {
          countMap[r.event_id] = r.msg_count
        })
      }
    }

    return (data || []).map((e: any) => ({
      ...e,
      tags: (e.event_tags || []).map((t: any) => t.tag),
      distKm: 0,
      distStr: '',
      msgCount: countMap[e.id] ?? 0,
    })) as EventWithMsgCount[]
  },
  /** Wyszukiwarka na mapie: publiczne, trwające lub przyszłe wydarzenia
   *  z frazą w tytule. Fraza ma być już oczyszczona (patrz sanitizeSearchQuery). */
  async searchEvents(query: string): Promise<EventHit[]> {
    const { data, error } = await supabase.from('events')
      .select('id,title,category,place_name,start_time,lat,lng')
      .ilike('title', `%${query}%`)
      .eq('is_private', false)
      .in('status', ['live', 'upcoming', 'extended'])
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(SEARCH_EVENT_LIMIT)
    if (error) { console.error('[searchEvents]', error); return [] }
    return (data || []) as EventHit[]
  },
  async getEventById(id: string): Promise<EventWithMeta | null> {
    // Use SECURITY DEFINER RPC to bypass RLS — needed so private events
    // are fetchable by anyone who has the share link (UUID = credential).
    const { data: evData, error } = await supabase
      .rpc('get_event_by_id', { p_event_id: id })
      .single()
    if (error || !evData) return null
    const e = evData as any
    // Fetch joins separately — profiles and event_tags have open RLS (USING true).
    // creator_id is null when the account was deleted (the FK is ON DELETE SET
    // NULL), and `.eq('id', null)` would be a nonsense filter — skip the lookup.
    const [{ data: prof, error: profErr }, { data: tagRows, error: tagErr }] = await Promise.all([
      e.creator_id
        ? supabase.from('profiles').select(PROFILE_PUBLIC).eq('id', e.creator_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('event_tags').select('tag').eq('event_id', id),
    ])
    if (profErr) console.error('[getEventById] profiles fetch:', profErr)
    if (tagErr) console.error('[getEventById] event_tags fetch:', tagErr)
    return {
      ...e,
      profiles: prof || null,
      tags: (tagRows || []).map((t: any) => t.tag),
      distKm: 0,
      distStr: '',
    }
  },
  async isFollowingEvent(eventId: string): Promise<boolean> {
    const sess = await this.getSession(); if (!sess) return false
    const { data } = await supabase.from('event_follows')
      .select('event_id').eq('user_id', sess.user.id).eq('event_id', eventId).maybeSingle()
    return !!data
  },
  async followEvent(eventId: string) {
    const sess = await this.getSession(); if (!sess) return
    await supabase.from('event_follows').insert({ user_id: sess.user.id, event_id: eventId })
  },
  async unfollowEvent(eventId: string) {
    const sess = await this.getSession(); if (!sess) return
    await supabase.from('event_follows').delete().eq('user_id', sess.user.id).eq('event_id', eventId)
  },
  async getEventFollowers(eventId: string): Promise<{ avatar_color: string | null; display_name: string | null }[]> {
    const { data } = await supabase.rpc('get_event_follower_colors', { p_event_id: eventId })
    return (data || []).map((r: any) => ({ avatar_color: r.avatar_color ?? null, display_name: r.display_name ?? null }))
  },
  async getFollowedEvents(userId: string): Promise<EventWithMsgCount[]> {
    const { data: follows } = await supabase
      .from('event_follows').select('event_id').eq('user_id', userId)
    const eventIds = (follows ?? []).map((f: any) => f.event_id)
    if (eventIds.length === 0) return []
    const { data, error } = await supabase
      .from('events')
      .select(`*, profiles(${PROFILE_PUBLIC}), event_tags(tag)`)
      .in('id', eventIds)
      .neq('creator_id', userId)
      .order('start_time', { ascending: false })
    if (error) { console.error(error); return [] }
    const ids = (data || []).map((e: any) => e.id)
    let countMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: counts } = await supabase.rpc('get_event_message_counts', { event_ids: ids })
      if (counts) {
        ;(counts as { event_id: string; msg_count: number }[]).forEach(r => {
          countMap[r.event_id] = r.msg_count
        })
      }
    }
    return (data || []).map((e: any) => ({
      ...e,
      tags: (e.event_tags || []).map((t: any) => t.tag),
      distKm: 0, distStr: '',
      msgCount: countMap[e.id] ?? 0,
    })) as EventWithMsgCount[]
  },
  upsertTag(name:string):string {
    return name.trim().toLowerCase().replace(/\s+/g,'-')
  },
  // Custom-tag suggestions for the picker: ONLY the current user's tags. RLS on
  // user_tags scopes this to auth.uid(), so other users' tags never leak here;
  // logged-out users get an empty list.
  async getTags():Promise<string[]> {
    const {data}=await supabase.from('user_tags').select('tag').order('tag')
    const unique=[...new Set((data||[]).map((r:any)=>r.tag as string))]
    return unique
  },
  // Record that the current user has used a custom tag: dedup it into the global
  // `tags` catalogue and link it to the user in user_tags. No-op when logged out.
  // Called whenever a custom tag is typed in the picker (create / filter / interests).
  async addUserTag(rawTag:string):Promise<void> {
    const sess=await this.getSession(); if(!sess) return
    const tag=this.upsertTag(rawTag); if(!tag) return
    await supabase.from('tags').upsert({name:tag},{onConflict:'name',ignoreDuplicates:true})
    await supabase.from('user_tags').upsert({user_id:sess.user.id,tag},{onConflict:'user_id,tag',ignoreDuplicates:true})
  },
  async endEvent(eventId: string) {
    const sess = await this.getSession()
    if (!sess) return { data: null, error: { message: 'not authenticated' } }
    // `.eq('creator_id', sess.user.id)` is a defense-in-depth check.
    // The DB already enforces this via RLS (events_update policy).
    return supabase
      .from('events')
      .update({ status: 'ended', end_time: new Date().toISOString() })
      .eq('id', eventId)
      .eq('creator_id', sess.user.id)
  },
  async updateEvent(eventId: string, ev: {
    title: string; description?: string; lat: number; lng: number;
    category?: string; tags?: string[];
    start_time: string; end_time: string; photos: string[];
  }) {
    const sess = await this.getSession()
    if (!sess) return { data: null, error: { message: 'not authenticated' } }
    // `.eq('creator_id', …)` is defense-in-depth; RLS already enforces it (mirrors endEvent).
    const { data, error } = await supabase
      .from('events')
      .update({
        title: ev.title, description: ev.description, lat: ev.lat, lng: ev.lng,
        category: ev.category || 'party',
        start_time: ev.start_time, end_time: ev.end_time, photos: ev.photos,
      })
      .eq('id', eventId)
      .eq('creator_id', sess.user.id)
      .select(`*,profiles(${PROFILE_PUBLIC}),event_tags(tag)`)
      .single()
    if (!error && data) {
      await supabase.from('event_tags').delete().eq('event_id', eventId)
      if (ev.tags?.length) {
        await supabase.from('event_tags').insert(ev.tags.map(tag => ({ event_id: eventId, tag })))
      }
    }
    return { data, error }
  },
  async getMessages(eid:string,limit=60):Promise<Message[]> {
    const {data}=await supabase.from('event_messages').select('*').eq('event_id',eid).order('created_at',{ascending:true}).limit(limit)
    return (data||[]) as Message[]
  },
  async sendMessage(eid:string,text:string,name:string,color:string) {
    const sess=await this.getSession(); if(!sess) return
    return supabase.from('event_messages').insert({ event_id:eid, author_id:sess.user.id, author_name:name, author_color:color, text })
  },
  subscribeFollowers(eid: string, cb: () => void) {
    return supabase.channel('follows:' + eid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_follows', filter: `event_id=eq.${eid}` }, () => cb())
      .subscribe()
  },
  subscribeMessages(eid:string,cb:(m:Message)=>void) {
    return supabase.channel('msgs:'+eid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages',filter:`event_id=eq.${eid}`},(p:any)=>cb(p.new))
      .subscribe()
  },
  trackClick(action:
    | 'browse_guest' | 'signin_google' | 'signin_apple'
    | 'follow_push_enable' | 'follow_calendar' | 'follow_calendar_google'
    | 'push_ask_enable' | 'digest_open'
    | 'event_calendar' | 'store_ios' | 'store_android'
    | 'invite_friends' | 'delete_account' | 'nickname_save' | 'profile_save'
  ) {
    // fire-and-forget — never block UI on analytics
    supabase.from('analytics_clicks').insert({ action }).then(() => {})
  },
  async markEventRead(eventId:string) {
    const sess=await this.getSession(); if(!sess) return
    return supabase.from('event_reads').upsert(
      { user_id:sess.user.id, event_id:eventId, last_read_at:new Date().toISOString() },
      { onConflict:'user_id,event_id' },
    )
  },
  async getUnreadEventIds():Promise<{eventId:string;isOwner:boolean}[]> {
    const {data,error}=await supabase.rpc('get_unread_event_ids')
    if(error){ console.error('[getUnreadEventIds]',error); return [] }
    return (data||[]).map((r:any)=>({ eventId:r.event_id, isOwner:r.is_owner }))
  },
  async getNotifContext():Promise<{followedIds:string[];ownedIds:string[]}> {
    const sess=await this.getSession(); if(!sess) return { followedIds:[], ownedIds:[] }
    const uid=sess.user.id
    // Followed events joined to their event row, so we can exclude ended events
    // (keeps the realtime reducer's sets consistent with get_unread_event_ids).
    // owned ⊆ followed (creators auto-follow), so derive owned from creator_id here.
    const {data}=await supabase
      .from('event_follows')
      .select('event_id, events!inner(creator_id, status, end_time)')
      .eq('user_id',uid)
    const now=Date.now()
    const followedIds:string[]=[]; const ownedIds:string[]=[]
    for(const r of (data||[]) as any[]) {
      const e=r.events; if(!e) continue
      if(e.status==='ended') continue
      if(new Date(e.end_time).getTime()+3_600_000<=now) continue
      followedIds.push(r.event_id)
      if(e.creator_id===uid) ownedIds.push(r.event_id)
    }
    return { followedIds, ownedIds }
  },
  subscribeAllMessages(cb:(m:Message)=>void) {
    return supabase.channel('msgs:all')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages'},(p:any)=>cb(p.new))
      .subscribe()
  },
  subscribeEvents(cb:()=>void) {
    return supabase.channel('events:all')
      .on('postgres_changes',{event:'*',schema:'public',table:'events'},()=>cb())
      .subscribe()
  },
  unsub(ch:any){ if(ch) supabase.removeChannel(ch) },
}
