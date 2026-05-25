import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import DragHandle from '../components/DragHandle'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import Avatar from '../components/Avatar'
import StatusPill from '../components/StatusPill'
import TagChip from '../components/TagChip'
import { C, INK, F, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import type { EventWithMeta, Message } from '../lib/types'

type Snap = 'peek' | 'half' | 'full'

const HEIGHTS: Record<Snap, string> = { peek: '130px', half: '56%', full: '93%' }

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES' }

function EventSheet({
  event,
  onClose,
  session,
  profile,
}: {
  event: EventWithMeta
  onClose: () => void
  session: Session | null
  profile: { display_name: string | null; avatar_color: string | null } | null
}) {
  const { t, i18n } = useTranslation()
  const [snap, setSnap] = useState<Snap>('half')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const chanRef = useRef<ReturnType<typeof db.subscribeMessages> | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef<number | null>(null)

  const isFull = snap === 'full'
  const isPeek = snap === 'peek'
  const meta = TAG_META[event.category as Category] || TAG_META.party
  const loc = LOC_MAP[i18n.language] || 'en-US'

  useEffect(() => {
    if (!event?.id) return
    db.getMessages(event.id).then(setMessages)
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeMessages(event.id, m => setMessages(p => [...p, m]))
    return () => db.unsub(chanRef.current)
  }, [event?.id])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  async function send() {
    if (!input.trim() || !session) return
    const text = input.trim()
    setInput('')
    const authorName =
      profile?.display_name || session.user?.email?.split('@')[0] || '?'
    const authorColor = profile?.avatar_color || C.primary
    await db.sendMessage(event.id, text, authorName, authorColor)
  }

  async function handleEndEvent() {
    const { error } = await db.endEvent(event.id)
    if (error) {
      console.error('endEvent failed:', error)
      return
    }
    onClose()
  }

  function onTS(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function onTE(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (dy > 80) {
      snap === 'full' ? setSnap('half') : snap === 'half' ? setSnap('peek') : onClose()
    } else if (dy < -80) {
      snap === 'peek' ? setSnap('half') : snap === 'half' ? setSnap('full') : null
    }
  }

  if (!event) return null

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHTS[snap],
      background: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
      boxShadow: '0 -8px 32px rgba(45,43,42,0.12)',
      transition: 'height 380ms cubic-bezier(0.32,1.4,0.4,1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 40,
    }}>
      <div onTouchStart={onTS} onTouchEnd={onTE} style={{ flexShrink: 0, position: 'relative' }}>
        <DragHandle />
        <button
          onClick={() => {
            const next: Snap = snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half'
            setSnap(next)
          }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32 }}
        />
      </div>

      {isPeek
        ? (
          <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <OrganicBlob size={42} color={meta.color} idx={0} face={<BlobFace size={28} />} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{event.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <StatusPill status={event.status} size="sm" />
                <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700 }}>· {event.distStr || '—'}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', background: C.cream,
              fontSize: 18, color: C.ink, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )
        : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {isFull && (
              <div style={{
                padding: '4px 20px 12px', borderBottom: '1px solid #F1E9DA',
                display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.96)',
              }}>
                <OrganicBlob size={36} color={meta.color} idx={0} face={<BlobFace size={24} />} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{event.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', background: C.grass,
                      animation: 'meuwe-breathe-sm 1.4s ease-in-out infinite',
                    }} />
                    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
                      {t('event.messageCount', { count: messages.length })}
                    </div>
                  </div>
                </div>
                <button onClick={onClose} style={{
                  width: 32, height: 32, borderRadius: '50%', background: C.cream,
                  fontSize: 18, color: C.ink, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            )}

            <div
              ref={listRef}
              style={{ flex: 1, overflowY: 'auto', padding: isFull ? '12px 20px 0' : '4px 20px 0' }}
            >
              {!isFull && (
                <>
                  <div style={{
                    fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink,
                    lineHeight: 1.15, marginBottom: 10, letterSpacing: -0.5,
                  }}>{event.title}</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12,
                  }}>
                    <StatusPill status={event.status} />
                    {event.start_time && (
                      <span style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>
                        {new Date(event.start_time).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.inkSoft, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: C.primary, boxShadow: `0 0 0 4px ${C.primarySoft}`,
                    }} />
                    {t('event.distanceFrom', { dist: event.distStr || '—' })}{event.place_name && ` · ${event.place_name}`}
                  </div>
                  {event.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                      {event.tags.map(tag => <TagChip key={tag} category={tag} selected />)}
                    </div>
                  )}
                  {event.photos && event.photos.length > 0 && (
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16,
                      scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                      paddingBottom: 4,
                    }}>
                      {event.photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          style={{
                            width: 160, height: 120, borderRadius: 16,
                            objectFit: 'cover', flexShrink: 0,
                            scrollSnapAlign: 'start',
                            border: `2px solid ${INK}11`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 18, background: C.cream, marginBottom: 14,
                  }}>
                    <Avatar
                      size={40}
                      initials={(event.profiles?.display_name || '?')[0].toUpperCase()}
                      color={event.profiles?.avatar_color || C.sky}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
                        {event.profiles?.display_name || '?'}
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
                        {t('event.organizer')}
                      </div>
                    </div>
                    {session?.user.id === event.creator_id && (
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: C.primarySoft, color: C.primaryPress,
                        fontSize: 11, fontWeight: 800,
                      }}>Moderator</span>
                    )}
                  </div>
                  {session?.user.id === event.creator_id && event.status !== 'ended' && (
                    <button
                      onClick={handleEndEvent}
                      style={{
                        width: '100%', padding: '12px 16px', marginBottom: 14,
                        borderRadius: 999, background: 'transparent',
                        border: `2px solid ${C.primarySoft}`,
                        color: C.primaryPress,
                        fontSize: 14, fontWeight: 800,
                      }}
                    >
                      Zakończ wydarzenie
                    </button>
                  )}
                  {event.description && (
                    <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, lineHeight: 1.55, marginBottom: 12 }}>
                      {event.description}
                    </div>
                  )}
                  <button
                    onClick={() => setSnap('full')}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 20,
                      background: C.cream, border: `2px solid ${INK}22`,
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 80,
                    }}
                  >
                    {messages.length > 0 && (
                      <div style={{ display: 'flex', marginRight: -4 }}>
                        {[...new Map(messages.map(m => [m.author_id, m.author_color])).values()]
                          .slice(0, 3)
                          .map((color, i) => (
                            <div key={i} style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: color || C.sky,
                              border: `2px solid ${INK}`,
                              marginLeft: i === 0 ? 0 : -10,
                            }} />
                          ))
                        }
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{t('event.conversation')}</div>
                      <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
                        {t('event.messageCount', { count: messages.length })}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, color: C.primary, fontWeight: 900 }}>↑</div>
                  </button>
                </>
              )}

              {isFull && (
                <div style={{ paddingBottom: 80 }}>
                  {event.photos && event.photos.length > 0 && (
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12,
                      scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                      marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20,
                    }}>
                      {event.photos.map((url, i) => (
                        <img key={i} src={url} alt="" style={{
                          width: 160, height: 110, borderRadius: 14,
                          objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start',
                        }} />
                      ))}
                    </div>
                  )}
                  {event.description && (
                    <div style={{
                      fontSize: 13, color: C.ink, fontWeight: 500,
                      lineHeight: 1.55, marginBottom: 12,
                      padding: '10px 14px', borderRadius: 16,
                      background: C.cream,
                    }}>
                      {event.description}
                    </div>
                  )}
                  <div style={{
                    fontSize: 11, color: C.inkSoft, fontWeight: 700,
                    textAlign: 'center', margin: '8px 0 16px', letterSpacing: 0.5,
                  }}>{t('event.today')}</div>
                  {messages.map((m, i) => {
                    const isMe = session && m.author_id === session.user.id
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 10,
                        }}
                      >
                        {!isMe && i % 3 === 0 && (
                          <div style={{
                            fontSize: 11, color: C.inkSoft, fontWeight: 700,
                            marginBottom: 4, marginLeft: 44,
                          }}>
                            {m.author_name || '?'} · {new Date(m.created_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '82%' }}>
                          {!isMe && (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: m.author_color || C.sky, border: `2px solid ${INK}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 900, color: INK,
                            }}>
                              {(m.author_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                            background: isMe ? C.primarySoft : '#fff', color: C.ink,
                            fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                            boxShadow: isMe ? 'none' : '0 4px 16px rgba(45,43,42,0.08)',
                            animation: isMe && i === messages.length - 1 ? 'bubble-up 280ms ease' : 'none',
                          }}>{m.text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {isFull && (
              <div style={{
                padding: '12px 16px 28px', background: 'rgba(255,255,255,0.96)',
                borderTop: '1px solid #F1E9DA', display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <div style={{
                  flex: 1, padding: '10px 18px', borderRadius: 999, background: C.cream,
                  display: 'flex', alignItems: 'center',
                }}>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder={session ? t('event.writeMessage') : t('event.loginToWrite')}
                    disabled={!session}
                    style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                <button
                  onClick={send}
                  disabled={!session || !input.trim()}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: input.trim() && session ? C.primary : '#E8DFD0',
                    border: `2px solid ${INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: input.trim() ? '0 4px 12px rgba(255,122,69,0.35)' : 'none',
                    transition: 'all 200ms ease',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <path
                      d="M3 10 L17 10 M11 5 L17 10 L11 15"
                      stroke={input.trim() && session ? '#fff' : C.inkSoft}
                      strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

export default EventSheet
