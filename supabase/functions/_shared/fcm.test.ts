import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildFcmMessage } from './fcm.ts'

Deno.test('buildFcmMessage maps payload to FCM v1 shape', () => {
  const msg = buildFcmMessage('TOKEN123', {
    title: 'Festyn', body: 'Ala: cześć', type: 'message', eventId: 'e1',
  })
  assertEquals(msg.token, 'TOKEN123')
  assertEquals(msg.notification.title, 'Festyn')
  assertEquals(msg.notification.body, 'Ala: cześć')
  assertEquals(msg.data.eventId, 'e1')
  assertEquals(msg.data.type, 'message')
  assertEquals(msg.android, undefined)
})

Deno.test('buildFcmMessage carries a digest spot as strings and collapses by tag', () => {
  const msg = buildFcmMessage('TOKEN123', {
    title: 'Piątek. Wychodzisz gdzieś?', body: 'Wokół Ciebie jest 5 wydarzeń.',
    type: 'digest', lat: 50.0413, lng: 21.999, km: 8, collapseTag: 'digest',
  })
  assertEquals(msg.data, { type: 'digest', lat: '50.0413', lng: '21.999', km: '8' })
  assertEquals(msg.android, { notification: { tag: 'digest' } })
})
