// meuwe Service Worker — Web Push handler
// Vite serwuje public/ bez bundlowania, więc ten plik trafia do /sw.js

const CACHE_NAME = 'meuwe-v1'

// ── Instalacja / aktywacja ───────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push event — pokazuje powiadomienie ─────────────────────────────────────

self.addEventListener('push', e => {
  // e.data is null when decryption fails — show fallback so we know push arrived
  let payload = { title: 'meuwe', body: 'Nowe powiadomienie', type: 'generic' }

  if (e.data) {
    try {
      payload = e.data.json()
    } catch {
      payload = { title: 'meuwe', body: e.data.text() || 'Nowe powiadomienie', type: 'generic' }
    }
  } else {
    console.warn('[sw] push received but e.data is null (decryption failed?)')
  }

  const { title, body, type, eventId, icon } = payload

  const options = {
    body,
    icon: icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: eventId || type || 'meuwe',       // grupuje powiadomienia tego samego eventu
    renotify: type === 'message',           // przy wiadomościach wibruj za każdym razem
    data: { eventId, type },
    actions: type === 'new_event' || type === 'event_start'
      ? [{ action: 'open', title: 'Zobacz' }]
      : [{ action: 'open', title: 'Odpisz' }],
    vibrate: [100, 50, 100],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Kliknięcie powiadomienia ─────────────────────────────────────────────────

self.addEventListener('notificationclick', e => {
  e.notification.close()

  const { eventId } = e.notification.data || {}
  const url = eventId ? `/?event=${eventId}` : '/'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Jeśli apka już otwarta — skieruj ją na właściwy event
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_EVENT', eventId })
          return client.focus()
        }
      }
      // W przeciwnym razie otwórz nowe okno
      return self.clients.openWindow(url)
    })
  )
})

// ── Push subscription change (przeglądarka odnowiła endpoint) ────────────────

self.addEventListener('pushsubscriptionchange', e => {
  // Poinformuj aplikację żeby zaktualizowała subskrypcję w DB
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))
    })
  )
})
