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
    today: 'Dziś', yesterday: 'Wczoraj',
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
  tags: {
    party: 'impreza', outdoor: 'piknik', family: 'rodzinne', culture: 'kultura', sport: 'sport', food: 'jedzenie',
    music: 'muzyka', art: 'sztuka', film: 'film', gaming: 'gaming', tech: 'tech', nature: 'przyroda',
    travel: 'podróże', yoga: 'yoga', dance: 'taniec', comedy: 'komedia', kids: 'dzieci', pets: 'zwierzęta',
    volunteering: 'wolontariat', workshop: 'warsztaty',
  },
  status: { live: 'Trwa', upcoming: 'Wkrótce', extended: 'Wciąż aktywne', ended: 'Zakończone' },
}

export default pl
export type Resources = typeof pl
