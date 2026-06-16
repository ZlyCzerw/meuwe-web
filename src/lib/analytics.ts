declare function gtag(...args: unknown[]): void

function g(event: string, params?: Record<string, unknown>) {
  if (typeof gtag === 'undefined') return
  gtag('event', event, params)
}

export const track = {
  viewEvent: (id: string, title: string) =>
    g('view_event', { event_id: id, event_title: title }),

  openCreate: () => g('open_create'),

  createEvent: (id: string) => g('create_event', { event_id: id }),

  editEvent: (id: string) => g('edit_event', { event_id: id }),

  login: () => g('login', { method: 'Google' }),

  share: (id: string) => g('share', { event_id: id }),

  followEvent: (id: string) => g('follow_event', { event_id: id }),
}
