import { createClient, type Session } from '@supabase/supabase-js'
import type { EventWithMeta, EventWithMsgCount, Message, Profile } from './types'
import { haversineKm } from './geo'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export const db = {
  signInGoogle() { return supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin } }) },
  signOut() { return supabase.auth.signOut() },
  onAuthChange(cb:(s:Session|null)=>void) { return supabase.auth.onAuthStateChange((_e,s)=>cb(s)) },
  async getSession() { const {data}=await supabase.auth.getSession(); return data.session },
  async getProfile(uid:string):Promise<Profile|null> {
    const {data}=await supabase.from('profiles').select('*').eq('id',uid).single(); return data as Profile|null
  },
  async upsertProfile(p:Partial<Profile>&{id:string}) { return supabase.from('profiles').upsert(p) },
  async updateProfileLocation(uid:string, lat:number, lng:number) {
    return supabase.from('profiles').upsert({
      id: uid,
      last_lat: lat,
      last_lng: lng,
      last_seen_at: new Date().toISOString(),
    })
  },
  async updateProfileLanguage(uid: string, language: string) {
    return supabase.from('profiles').upsert({ id: uid, language })
  },
  async getEvents(lat:number,lng:number,km=15,dayOffset=0):Promise<EventWithMeta[]> {
    const d=km/111
    // Compute the target day's start/end in local time, then convert to UTC.
    // This replicates the same semantics as the previous toDateString() comparison.
    const now    = new Date()
    const target = new Date()
    target.setDate(target.getDate() + dayOffset)
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0)
    const dayEnd   = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)
    // For today: hide events whose end_time has already passed.
    // For future days: show all events that overlap that day.
    const endTimeFloor = dayOffset === 0 ? now : dayStart

    const {data,error}=await supabase.from('events')
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
      .gte('lat',lat-d).lte('lat',lat+d).gte('lng',lng-d).lte('lng',lng+d)
      .in('status',['live','upcoming','extended'])
      .lte('start_time', dayEnd.toISOString())
      .gte('end_time',   endTimeFloor.toISOString())
      .order('created_at',{ascending:false})
    if(error){console.error(error);return[]}
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
  async uploadEventPhoto(file:File):Promise<string> {
    const sess=await this.getSession(); if(!sess) throw new Error('not authenticated')
    const ext=file.name.split('.').pop()||'jpg'
    const path=`${sess.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('event-photos').upload(path,file,{contentType:file.type})
    if(error) throw error
    const {data}=supabase.storage.from('event-photos').getPublicUrl(path)
    return data.publicUrl
  },
  async createEvent(ev:{
    title:string; description?:string; lat:number; lng:number;
    placeName?:string; category?:string; tags?:string[];
    start_time?:string; end_time?:string; photos?:string[];
  }) {
    const sess=await this.getSession(); if(!sess) return {data:null,error:{message:'not authenticated'}}
    const {data,error}=await supabase.from('events').insert({
      title:ev.title, description:ev.description, lat:ev.lat, lng:ev.lng,
      place_name:ev.placeName, category:ev.category||'party',
      start_time: ev.start_time || new Date().toISOString(),
      end_time: ev.end_time || new Date(Date.now()+86400000).toISOString(),
      creator_id:sess.user.id, status:'live',
      photos: ev.photos||[],
    }).select().single()
    if(!error && data) {
      if(ev.tags?.length) await supabase.from('event_tags').insert(ev.tags.map(tag=>({event_id:data.id,tag})))
      await supabase.from('event_follows').insert({ user_id: sess.user.id, event_id: data.id })
    }
    return {data,error}
  },
  async getMyEvents(userId: string): Promise<EventWithMsgCount[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(display_name,avatar_color), event_tags(tag)')
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
  async getEventById(id: string): Promise<EventWithMeta | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
      .eq('id', id)
      .single()
    if (error || !data) return null
    const e = data as any
    return { ...e, tags: (e.event_tags || []).map((t: any) => t.tag), distKm: 0, distStr: '' }
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
      .select('*, profiles(display_name,avatar_color), event_tags(tag)')
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
  async getTags():Promise<string[]> {
    const {data}=await supabase.from('event_tags').select('tag').order('tag')
    const unique=[...new Set((data||[]).map((r:any)=>r.tag as string))]
    return unique
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
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
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
  subscribeMessages(eid:string,cb:(m:Message)=>void) {
    return supabase.channel('msgs:'+eid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages',filter:`event_id=eq.${eid}`},(p:any)=>cb(p.new))
      .subscribe()
  },
  trackClick(action: 'browse_guest' | 'signin_google') {
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
