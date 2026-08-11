import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../../lib/tokens'
import { authorLabel, authorInitial } from '../../lib/authorLabel'
import type { Message } from '../../lib/types'

export default function EventChatPanel({
  messages,
  meId,
  loc,
  deletedLabels,
  title,
  onBack,
  input,
  onInputChange,
  onSend,
  sendErr,
  canWrite,
}: {
  messages: Message[]
  meId: string | null
  loc: string
  deletedLabels: { deleted: string; unknown: string }
  title: string
  onBack: () => void
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  sendErr: string
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement | null>(null)

  // Rozmowa otwiera się na najnowszej wiadomości i tam zostaje, gdy przyjdzie
  // następna — czat, w którym trzeba doprzewijać do teraźniejszości, jest
  // nieużywalny.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 8, background: '#fff',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 180ms ease',
    }}>
      <div
        data-testid="chat-header"
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid #F1E9DA',
        }}
      >
        <button
          data-testid="chat-back"
          onClick={onBack}
          aria-label={t('event.backToEvent')}
          style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: C.cream, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, fontWeight: 900, color: C.ink,
          }}
        >‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft }}>
            {t('event.messageCount', { count: messages.length })}
          </div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 8px' }}>
        <div style={{
          fontSize: 11, color: C.inkSoft, fontWeight: 700,
          textAlign: 'center', margin: '0 0 16px', letterSpacing: 0.5,
        }}>{t('event.today')}</div>
        {messages.map((m, i) => {
          const isMe = !!meId && m.author_id === meId
          return (
            <div key={m.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 10,
            }}>
              {!isMe && i % 3 === 0 && (
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginBottom: 4, marginLeft: 44 }}>
                  {authorLabel(m.author_id, m.author_name, deletedLabels)} · {new Date(m.created_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
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
                    {authorInitial(m.author_id, m.author_name, deletedLabels)}
                  </div>
                )}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  background: isMe ? C.primarySoft : C.cream, color: C.ink,
                  fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                }}>{m.text}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        flexShrink: 0, padding: '8px 16px calc(20px + env(safe-area-inset-bottom))',
        background: '#fff', borderTop: '1px solid #F1E9DA',
      }}>
        {sendErr && (
          <div style={{
            marginBottom: 8, padding: '6px 12px', borderRadius: 10,
            background: '#FFE8E8', color: '#c0392b', fontSize: 12, fontWeight: 700,
          }}>{sendErr}</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            flex: 1, padding: '10px 18px', borderRadius: 999, background: C.cream,
            display: 'flex', alignItems: 'center',
          }}>
            <input
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSend() }}
              placeholder={canWrite ? t('event.writeMessage') : t('event.loginToWrite')}
              disabled={!canWrite}
              maxLength={500}
              style={{ flex: 1, fontSize: 16, fontWeight: 600 }}
            />
          </div>
          <button
            onClick={onSend}
            disabled={!canWrite || !input.trim()}
            aria-label={t('event.sendMessage')}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && canWrite ? C.primary : '#E8DFD0',
              border: `2px solid ${INK}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M3 10 L17 10 M11 5 L17 10 L11 15"
                stroke={input.trim() && canWrite ? '#fff' : C.inkSoft}
                strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
