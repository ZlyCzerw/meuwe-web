import { createClient, type Session } from '@supabase/supabase-js'
import type { EventWithMeta, EventWithMsgCount, Message, Profile } from './types'
import { haversineKm } from './geo'

const SUPABASE_URL = 'https://bcfhsbnbvsuxsiwmeway.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZmhzYm5idnN1eHNpd21ld2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzM5NzgsImV4cCI6MjA5NDk0OTk3OH0.pA-qmhLr0ez3lZ_7WZb6kZGVQMgoMti3CkxM8fbFQbY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export function isOnDay(startTime:string, today:Date, dayOffset:number):boolean {
  const target = new Date(today); target.setDate(today.getDate()+dayOffset)
  const d = new Date(startTime)
  return d.toDateString() === target.toDateString()
}

export const db = {
  signInGoogle() { return supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin } }) },
  signOut() { return supabase.auth.signOut() },
  onAuthChange(cb:(s:Session|null)=>void) { return supabase.auth.onAuthStateChange((_e,s)=>cb(s)) },
  async getSession() { const {data}=await supabase.auth.getSession(); return data.session },
  async getProfile(uid:string):Promise<Profile|null> {
    const {data}=await supabase.from('profiles').select('*').eq('id',uid).single(); return data as Profile|null
  },
  async upsertProfile(p:Partial<Profile>&{id:string}) { return supabase.from('profiles').upsert(p) },
  async getEvents(lat:number,lng:number,km=15,dayOffset=0):Promise<EventWithMeta[]> {
    const d=km/111
    const {data,error}=await supabase.from('events')
      .select('*,profiles!left(display_name,avatar_color),event_tags!left(tag)')
      .gte('lat',lat-d).lte('lat',lat+d).gte('lng',lng-d).lte('lng',lng+d)
      .in('status',['live','upcoming','extended'])
      .order('created_at',{ascending:false})
    if(error){console.error(error);return[]}
    const today=new Date()
    return (data||[])
      .filter((e:any)=>isOnDay(e.start_time,today,dayOffset))
      .map((e:any)=>{
        const dk=haversineKm(lat,lng,e.lat,e.lng)
        return {...e, tags:(e.event_tags||[]).map((t:any)=>t.tag),
          distKm:dk, distStr:dk<1?`${Math.round(dk*1000)} m`:`${dk.toFixed(1)} km`}
      })
  },
  async createEvent(ev:{
    title:string; description?:string; lat:number; lng:number;
    placeName?:string; category?:string; tags?:string[];
    start_time?:string; end_time?:string;
  }) {
    const sess=await this.getSession(); if(!sess) return {data:null,error:{message:'not authenticated'}}
    const {data,error}=await supabase.from('events').insert({
      title:ev.title, description:ev.description, lat:ev.lat, lng:ev.lng,
      place_name:ev.placeName, category:ev.category||'party',
      start_time: ev.start_time || new Date().toISOString(),
      end_time: ev.end_time || new Date(Date.now()+86400000).toISOString(),
      creator_id:sess.user.id, status:'live',
    }).select().single()
    if(!error && ev.tags?.length) await supabase.from('event_tags').insert(ev.tags.map(tag=>({event_id:data!.id,tag})))
    return {data,error}
  },
  async getMyEvents(userId:string):Promise<EventWithMsgCount[]> {
    const {data,error}=await supabase.from('events')
      .select('*, event_tags(tag)')
      .eq('creator_id',userId)
      .order('start_time',{ascending:false})
    if(error){console.error(error);return[]}

    // Get message counts separately — event_messages(count) selects a literal
    // column named "count" (which doesn't exist), not a COUNT aggregate.
    const eventIds=(data||[]).map((e:any)=>e.id)
    let countMap:Record<string,number>={}
    if(eventIds.length>0){
      const {data:counts}=await supabase.from('event_messages')
        .select('event_id')
        .in('event_id',eventIds)
      if(counts){
        counts.forEach((r:any)=>{
          countMap[r.event_id]=(countMap[r.event_id]||0)+1
        })
      }
    }

    return (data||[]).map((e:any)=>({
      ...e,
      tags:(e.event_tags||[]).map((t:any)=>t.tag),
      distKm:0,
      distStr:'',
      profiles:null,
      msgCount:countMap[e.id]??0,
    })) as EventWithMsgCount[]
  },
  async endEvent(eventId:string) {
    return supabase.from('events').update({status:'ended'}).eq('id',eventId)
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
  subscribeEvents(cb:()=>void) {
    return supabase.channel('events:all')
      .on('postgres_changes',{event:'*',schema:'public',table:'events'},()=>cb())
      .subscribe()
  },
  unsub(ch:any){ if(ch) supabase.removeChannel(ch) },
}
