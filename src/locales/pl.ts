const pl = {
  common: { loading: 'Ładowanie…', cancel: 'Anuluj', close: 'Zamknij' },
  welcome: {
    tagline: 'Odkrywaj wydarzenia\nwokół Ciebie',
    google: 'Zaloguj się przez Google',
    terms: 'Logując się akceptujesz regulamin',
    skip: 'Przeglądaj bez logowania →',
  },
  map: {
    search: 'Szukaj miejsca…',
    empty: 'Tu jeszcze cisza…',
    emptyCta: 'bądź pierwszy!',
    days: {
      yesterday: 'Wczoraj', today: 'Dziś', tomorrow: 'Jutro',
      friday: 'Piątek', saturday: 'Sobota', sunday: 'Niedziela',
    },
    daysShort: {
      yesterday: 'Wcz', today: 'Dziś', tomorrow: 'Jutro',
      friday: 'Pt', saturday: 'Sb', sunday: 'Nd',
    },
  },
  event: {
    organizer: 'Organizator',
    conversation: 'Rozmowa trwa',
    distanceFrom: '{{dist}} od Ciebie',
    messageCount_one: '{{count}} wiadomość',
    messageCount_few: '{{count}} wiadomości',
    messageCount_many: '{{count}} wiadomości',
    messageCount_other: '{{count}} wiadomości',
    writeMessage: 'Napisz wiadomość…',
    loginToWrite: 'Zaloguj się aby pisać',
    today: 'DZIŚ',
  },
  create: {
    title: 'Co się dzieje?',
    myLocation: 'Moja lokalizacja',
    gpsBased: 'Oparte na Twoim GPS',
    namePlaceholder: 'np. Piknik o zachodzie słońca',
    tags: 'Tagi',
    descLabel: 'Opis (opcjonalnie)',
    descPlaceholder: 'Powiedz coś więcej…',
    submit: 'Dodaj wydarzenie',
    added: 'Wydarzenie dodane ✦',
  },
  profile: {
    guest: 'Gość',
    interests: 'Twoje zainteresowania',
    interestsHint: 'Powiadomimy Cię o pasujących wydarzeniach',
    radius: 'Promień powiadomień',
    myEvents: 'Moje wydarzenia',
    signOut: 'Wyloguj',
    language: 'Język',
  },
  tags: { party: 'impreza', outdoor: 'piknik', family: 'rodzinne', culture: 'koncert', sport: 'sport', food: 'food' },
  status: { live: 'Trwa', upcoming: 'Wkrótce', extended: 'Wciąż aktywne', ended: 'Zakończone' },
}

export default pl
export type Resources = typeof pl
