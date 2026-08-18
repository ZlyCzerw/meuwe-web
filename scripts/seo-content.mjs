// Treści SEO dla statycznych wariantów językowych landingu.
//
// Dlaczego osobno od src/locales/: te napisy nigdy nie trafiają do Reacta —
// wstrzykuje je build (scripts/build-seo-pages.mjs) do <head> gotowych plików
// HTML, zanim jakikolwiek JS się uruchomi. Roboty LLM-owe (GPTBot, ClaudeBot,
// PerplexityBot) nie renderują JS, więc to jedyna treść, jaką w ogóle widzą.
// Node musiałby transpilować .ts z src/locales, żeby je odczytać — stąd .mjs.

export const SITE = 'https://meuwe.eu'

// Kolejność ma znaczenie: pierwszy wpis to wariant serwowany z '/' i x-default.
export const LANGS = ['en', 'pl', 'de', 'es', 'sl']

// '' oznacza korzeń serwisu — angielski jest wariantem neutralnym dla reszty świata.
export const PATHS = { en: '', pl: 'pl', de: 'de', es: 'es', sl: 'sl' }

export const url = lang => (PATHS[lang] ? `${SITE}/${PATHS[lang]}` : `${SITE}/`)

export const SEO = {
  en: {
    htmlLang: 'en',
    title: 'meuwe — local events on a map',
    description:
      'meuwe — discover local events on a map. Picnics, concerts, sports, markets and neighbourhood meetups near you. No ads, no account needed.',
    keywords:
      'local events, event map, what is on near me, events nearby, picnic, concert, sports, Tenerife, hyperlocal',
    ogTitle: 'meuwe — local events on a map',
    ogDescription:
      "Discover what's happening nearby. Picnics, concerts, sports, markets. No ads.",
    orgDescription:
      'meuwe is a hyperlocal event map. Discover what is happening around you, with no ads.',
    appDescription:
      'Hyperlocal event map — picnics, concerts, sports, markets and neighbourhood meetups near you. No ads, no account required.',
    featureList: [
      'Live event map updating in real time',
      'Create an event in 10 seconds',
      'Private events shared by invite link',
      'Push notifications for events you follow',
      'Category filters: party, music, sports, food, culture and more',
      'Works without an account',
      '5 languages: English, Polish, German, Spanish, Slovenian',
    ],
    faq: [
      {
        q: 'What is meuwe?',
        a: 'meuwe is a real-time map of local events. Open the app and immediately see what is happening around you — picnics, concerts, sports, markets, meetups. No account, no ads.',
      },
      {
        q: 'Is meuwe free?',
        a: 'Yes, meuwe is completely free. Browsing the map does not even require an account. Signing in with Google is only needed to add your own events.',
      },
      {
        q: 'How do I add an event on meuwe?',
        a: 'Tap the + button on the map, type a title and you are done — the event appears on the map instantly. The title is the only required field. Description, photos and time are optional.',
      },
      {
        q: 'What are private events on meuwe?',
        a: 'A private event is visible only to people you share the link with. It never appears on the public map. On the map it stands out as a white pin with a mask — only invited people know it exists.',
      },
      {
        q: 'What devices does meuwe work on?',
        a: 'meuwe runs as a web app in the browser on any device. Native apps for iOS and Android are available in the App Store and Google Play.',
      },
    ],
    noscript: {
      h1: 'meuwe — local events on a map',
      intro:
        'meuwe is a hyperlocal event map. Open it and immediately see what is happening around you — picnics, concerts, sports, markets and neighbourhood meetups. No ads, and no account is needed to browse.',
      sections: [
        {
          h2: 'The home screen is a map of today’s events',
          p: 'Every pin is a different event. Browse by date or filter the categories you care about.',
        },
        {
          h2: 'One tap to join',
          p: 'Tap a pin to see the details — when, where and who is organising. Follow it, chat with the other attendees and stay up to date without leaving the map.',
        },
        {
          h2: 'An event in 10 seconds',
          p: 'The title is the only required field. Everything else is optional. Your event shows up on the map instantly and anyone nearby can find it.',
        },
        {
          h2: 'Private events',
          p: 'Invite only the people you choose — nobody else will even see that the event exists.',
        },
      ],
    },
  },

  pl: {
    htmlLang: 'pl',
    title: 'meuwe — lokalne wydarzenia na mapie',
    description:
      'meuwe — odkrywaj lokalne wydarzenia na mapie. Pikniki, koncerty, sport, targi i spotkania sąsiedzkie w Twojej okolicy. Bez reklam, bez konta.',
    keywords:
      'lokalne wydarzenia, mapa wydarzeń, co się dzieje w okolicy, eventy, piknik, koncert, sport, Teneryfa, hyperlocal',
    ogTitle: 'meuwe — lokalne wydarzenia na mapie',
    ogDescription:
      'Odkrywaj co się dzieje w pobliżu. Pikniki, koncerty, sport, targi. Bez reklam.',
    orgDescription:
      'meuwe to hiperlokalna mapa wydarzeń. Odkrywaj co się dzieje w okolicy, bez reklam.',
    appDescription:
      'Hiperlokalna mapa wydarzeń — pikniki, koncerty, sport, targi i spotkania sąsiedzkie w Twojej okolicy. Bez reklam, bez wymogu konta.',
    featureList: [
      'Mapa wydarzeń na żywo w czasie rzeczywistym',
      'Tworzenie eventu w 10 sekund',
      'Prywatne wydarzenia z linkiem zaproszenia',
      'Push notyfikacje dla obserwowanych eventów',
      'Filtry kategorii: impreza, muzyka, sport, jedzenie, kultura i inne',
      'Działa bez konta',
      '5 języków: polski, angielski, niemiecki, hiszpański, słoweński',
    ],
    faq: [
      {
        q: 'Czym jest meuwe?',
        a: 'meuwe to mapa lokalnych wydarzeń w czasie rzeczywistym. Otwierasz aplikację i od razu widzisz co się dzieje w okolicy — pikniki, koncerty, sporty, targi, spotkania. Bez konta, bez reklam.',
      },
      {
        q: 'Czy meuwe jest bezpłatne?',
        a: 'Tak, meuwe jest całkowicie bezpłatne. Przeglądanie mapy nie wymaga nawet zakładania konta. Logowanie przez Google potrzebne jest tylko do dodawania własnych wydarzeń.',
      },
      {
        q: 'Jak dodać wydarzenie na meuwe?',
        a: 'Dotknij przycisku + na mapie, wpisz tytuł i gotowe — wydarzenie pojawia się na mapie natychmiast. Tytuł to jedyne wymagane pole. Opis, zdjęcia i czas są opcjonalne.',
      },
      {
        q: 'Czym są wydarzenia prywatne w meuwe?',
        a: 'Wydarzenie prywatne jest widoczne tylko dla osób, którym udostępnisz link. Nie pojawia się na publicznej mapie. Na mapie wyróżnia się jako biały pin z maską — tylko zaproszeni wiedzą że istnieje.',
      },
      {
        q: 'Na jakich urządzeniach działa meuwe?',
        a: 'meuwe działa jako aplikacja webowa w przeglądarce na każdym urządzeniu. Aplikacja natywna na iOS i Android jest dostępna w App Store i Google Play.',
      },
    ],
    noscript: {
      h1: 'meuwe — lokalne wydarzenia na mapie',
      intro:
        'meuwe to hiperlokalna mapa wydarzeń. Otwierasz ją i od razu widzisz co się dzieje w Twojej okolicy — pikniki, koncerty, sport, targi i spotkania sąsiedzkie. Bez reklam, a przeglądanie nie wymaga konta.',
      sections: [
        {
          h2: 'Ekran główny to mapa dzisiejszych wydarzeń',
          p: 'Każdy pin to inne wydarzenie. Przeglądaj po dacie albo filtruj interesujące cię kategorie.',
        },
        {
          h2: 'Jedno dotknięcie, żeby dołączyć',
          p: 'Dotknij pinu, żeby zobaczyć szczegóły. Sprawdź kiedy, gdzie i kto organizuje. Obserwuj, czatuj z uczestnikami i bądź na bieżąco — wszystko bez opuszczania mapy.',
        },
        {
          h2: 'Wydarzenie w 10 sekund',
          p: 'Tytuł to jedyne wymagane pole. Reszta informacji jest opcjonalna. Twoje wydarzenie pojawia się na mapie natychmiast i każdy w okolicy może je znaleźć.',
        },
        {
          h2: 'Wydarzenie prywatne',
          p: 'Zaproś tylko wybranych — inni nie zobaczą nawet, że spotkanie istnieje.',
        },
      ],
    },
  },

  de: {
    htmlLang: 'de',
    title: 'meuwe — lokale Events auf der Karte',
    description:
      'meuwe — entdecke lokale Events auf der Karte. Picknicks, Konzerte, Sport, Märkte und Nachbarschaftstreffen in deiner Nähe. Keine Werbung, kein Konto nötig.',
    keywords:
      'lokale Events, Eventkarte, was ist los in meiner Nähe, Veranstaltungen in der Nähe, Picknick, Konzert, Sport, Teneriffa, hyperlokal',
    ogTitle: 'meuwe — lokale Events auf der Karte',
    ogDescription:
      'Entdecke, was in deiner Nähe passiert. Picknicks, Konzerte, Sport, Märkte. Keine Werbung.',
    orgDescription:
      'meuwe ist eine hyperlokale Eventkarte. Entdecke ohne Werbung, was in deiner Umgebung passiert.',
    appDescription:
      'Hyperlokale Eventkarte — Picknicks, Konzerte, Sport, Märkte und Nachbarschaftstreffen in deiner Nähe. Keine Werbung, kein Konto erforderlich.',
    featureList: [
      'Live-Eventkarte in Echtzeit',
      'Event in 10 Sekunden erstellen',
      'Private Events per Einladungslink',
      'Push-Benachrichtigungen für Events, denen du folgst',
      'Kategoriefilter: Party, Musik, Sport, Essen, Kultur und mehr',
      'Funktioniert ohne Konto',
      '5 Sprachen: Deutsch, Englisch, Polnisch, Spanisch, Slowenisch',
    ],
    faq: [
      {
        q: 'Was ist meuwe?',
        a: 'meuwe ist eine Echtzeitkarte lokaler Events. Du öffnest die App und siehst sofort, was in deiner Umgebung passiert — Picknicks, Konzerte, Sport, Märkte, Treffen. Ohne Konto, ohne Werbung.',
      },
      {
        q: 'Ist meuwe kostenlos?',
        a: 'Ja, meuwe ist vollständig kostenlos. Für das Stöbern auf der Karte brauchst du nicht einmal ein Konto. Die Anmeldung mit Google ist nur nötig, um eigene Events hinzuzufügen.',
      },
      {
        q: 'Wie füge ich bei meuwe ein Event hinzu?',
        a: 'Tippe auf der Karte auf die Schaltfläche +, gib einen Titel ein und fertig — das Event erscheint sofort auf der Karte. Der Titel ist das einzige Pflichtfeld. Beschreibung, Fotos und Uhrzeit sind optional.',
      },
      {
        q: 'Was sind private Events bei meuwe?',
        a: 'Ein privates Event sehen nur die Personen, denen du den Link schickst. Es taucht nie auf der öffentlichen Karte auf. Auf der Karte fällt es als weißer Pin mit Maske auf — nur Eingeladene wissen, dass es existiert.',
      },
      {
        q: 'Auf welchen Geräten funktioniert meuwe?',
        a: 'meuwe läuft als Web-App im Browser auf jedem Gerät. Native Apps für iOS und Android gibt es im App Store und bei Google Play.',
      },
    ],
    noscript: {
      h1: 'meuwe — lokale Events auf der Karte',
      intro:
        'meuwe ist eine hyperlokale Eventkarte. Öffne sie und sieh sofort, was in deiner Nähe passiert — Picknicks, Konzerte, Sport, Märkte und Nachbarschaftstreffen. Keine Werbung, und zum Stöbern brauchst du kein Konto.',
      sections: [
        {
          h2: 'Der Startbildschirm ist eine Karte der heutigen Events',
          p: 'Jeder Pin ist ein anderes Event. Stöbere nach Datum oder filtere die Kategorien, die dich interessieren.',
        },
        {
          h2: 'Ein Tippen, um dabei zu sein',
          p: 'Tippe auf einen Pin, um die Details zu sehen — wann, wo und wer organisiert. Folge dem Event, chatte mit den anderen Teilnehmenden und bleib auf dem Laufenden, ohne die Karte zu verlassen.',
        },
        {
          h2: 'Ein Event in 10 Sekunden',
          p: 'Der Titel ist das einzige Pflichtfeld. Alles andere ist optional. Dein Event erscheint sofort auf der Karte und jeder in der Nähe kann es finden.',
        },
        {
          h2: 'Private Events',
          p: 'Lade nur die Menschen ein, die du auswählst — alle anderen sehen nicht einmal, dass das Event existiert.',
        },
      ],
    },
  },

  es: {
    htmlLang: 'es',
    title: 'meuwe — eventos locales en el mapa',
    description:
      'meuwe — descubre eventos locales en el mapa. Picnics, conciertos, deportes, mercados y quedadas de barrio cerca de ti. Sin anuncios, sin necesidad de cuenta.',
    keywords:
      'eventos locales, mapa de eventos, qué hacer cerca de mí, eventos cerca, picnic, concierto, deporte, Tenerife, hiperlocal',
    ogTitle: 'meuwe — eventos locales en el mapa',
    ogDescription:
      'Descubre qué pasa cerca de ti. Picnics, conciertos, deportes, mercados. Sin anuncios.',
    orgDescription:
      'meuwe es un mapa hiperlocal de eventos. Descubre qué pasa a tu alrededor, sin anuncios.',
    appDescription:
      'Mapa hiperlocal de eventos — picnics, conciertos, deportes, mercados y quedadas de barrio cerca de ti. Sin anuncios, sin necesidad de cuenta.',
    featureList: [
      'Mapa de eventos en directo y en tiempo real',
      'Crea un evento en 10 segundos',
      'Eventos privados con enlace de invitación',
      'Notificaciones push de los eventos que sigues',
      'Filtros por categoría: fiesta, música, deporte, comida, cultura y más',
      'Funciona sin cuenta',
      '5 idiomas: español, inglés, polaco, alemán, esloveno',
    ],
    faq: [
      {
        q: '¿Qué es meuwe?',
        a: 'meuwe es un mapa de eventos locales en tiempo real. Abres la app y ves al instante qué pasa a tu alrededor — picnics, conciertos, deportes, mercados, quedadas. Sin cuenta, sin anuncios.',
      },
      {
        q: '¿meuwe es gratis?',
        a: 'Sí, meuwe es totalmente gratis. Explorar el mapa ni siquiera requiere crear una cuenta. Iniciar sesión con Google solo hace falta para publicar tus propios eventos.',
      },
      {
        q: '¿Cómo añado un evento en meuwe?',
        a: 'Toca el botón + en el mapa, escribe un título y listo — el evento aparece en el mapa al instante. El título es el único campo obligatorio. La descripción, las fotos y la hora son opcionales.',
      },
      {
        q: '¿Qué son los eventos privados en meuwe?',
        a: 'Un evento privado solo lo ven las personas con las que compartes el enlace. Nunca aparece en el mapa público. En el mapa destaca como un pin blanco con antifaz — solo los invitados saben que existe.',
      },
      {
        q: '¿En qué dispositivos funciona meuwe?',
        a: 'meuwe funciona como aplicación web en el navegador de cualquier dispositivo. Las apps nativas para iOS y Android están disponibles en la App Store y en Google Play.',
      },
    ],
    noscript: {
      h1: 'meuwe — eventos locales en el mapa',
      intro:
        'meuwe es un mapa hiperlocal de eventos. Ábrelo y ve al instante qué pasa cerca de ti — picnics, conciertos, deportes, mercados y quedadas de barrio. Sin anuncios, y explorar no requiere cuenta.',
      sections: [
        {
          h2: 'La pantalla principal es un mapa de los eventos de hoy',
          p: 'Cada pin es un evento distinto. Explora por fecha o filtra las categorías que te interesan.',
        },
        {
          h2: 'Un toque para unirte',
          p: 'Toca un pin para ver los detalles: cuándo, dónde y quién organiza. Síguelo, chatea con los demás asistentes y mantente al día sin salir del mapa.',
        },
        {
          h2: 'Un evento en 10 segundos',
          p: 'El título es el único campo obligatorio. Todo lo demás es opcional. Tu evento aparece en el mapa al instante y cualquiera de la zona puede encontrarlo.',
        },
        {
          h2: 'Eventos privados',
          p: 'Invita solo a quien tú elijas — el resto ni siquiera verá que el evento existe.',
        },
      ],
    },
  },

  sl: {
    htmlLang: 'sl',
    title: 'meuwe — lokalni dogodki na zemljevidu',
    description:
      'meuwe — odkrij lokalne dogodke na zemljevidu. Pikniki, koncerti, šport, tržnice in soseska srečanja v tvoji okolici. Brez oglasov, brez računa.',
    keywords:
      'lokalni dogodki, zemljevid dogodkov, kaj se dogaja v bližini, dogodki v bližini, piknik, koncert, šport, Tenerife, hiperlokalno',
    ogTitle: 'meuwe — lokalni dogodki na zemljevidu',
    ogDescription:
      'Odkrij, kaj se dogaja v bližini. Pikniki, koncerti, šport, tržnice. Brez oglasov.',
    orgDescription:
      'meuwe je hiperlokalni zemljevid dogodkov. Odkrij, kaj se dogaja v tvoji okolici, brez oglasov.',
    appDescription:
      'Hiperlokalni zemljevid dogodkov — pikniki, koncerti, šport, tržnice in soseska srečanja v tvoji okolici. Brez oglasov, brez obveznega računa.',
    featureList: [
      'Zemljevid dogodkov v živo, v realnem času',
      'Ustvarjanje dogodka v 10 sekundah',
      'Zasebni dogodki s povezavo za povabilo',
      'Potisna obvestila za dogodke, ki jim slediš',
      'Filtri kategorij: zabava, glasba, šport, hrana, kultura in drugo',
      'Deluje brez računa',
      '5 jezikov: slovenščina, angleščina, poljščina, nemščina, španščina',
    ],
    faq: [
      {
        q: 'Kaj je meuwe?',
        a: 'meuwe je zemljevid lokalnih dogodkov v realnem času. Odpreš aplikacijo in takoj vidiš, kaj se dogaja v okolici — pikniki, koncerti, šport, tržnice, srečanja. Brez računa, brez oglasov.',
      },
      {
        q: 'Ali je meuwe brezplačen?',
        a: 'Da, meuwe je popolnoma brezplačen. Za brskanje po zemljevidu ne potrebuješ niti računa. Prijava z Googlom je potrebna samo za dodajanje lastnih dogodkov.',
      },
      {
        q: 'Kako dodam dogodek na meuwe?',
        a: 'Pritisni gumb + na zemljevidu, vpiši naslov in to je vse — dogodek se takoj pojavi na zemljevidu. Naslov je edino obvezno polje. Opis, fotografije in čas so neobvezni.',
      },
      {
        q: 'Kaj so zasebni dogodki na meuwe?',
        a: 'Zasebni dogodek vidijo samo tisti, s katerimi deliš povezavo. Na javnem zemljevidu se ne pojavi. Na zemljevidu izstopa kot bela oznaka z masko — samo povabljeni vedo, da obstaja.',
      },
      {
        q: 'Na katerih napravah deluje meuwe?',
        a: 'meuwe deluje kot spletna aplikacija v brskalniku na vsaki napravi. Domorodni aplikaciji za iOS in Android sta na voljo v App Store in Google Play.',
      },
    ],
    noscript: {
      h1: 'meuwe — lokalni dogodki na zemljevidu',
      intro:
        'meuwe je hiperlokalni zemljevid dogodkov. Odpri ga in takoj vidiš, kaj se dogaja v tvoji bližini — pikniki, koncerti, šport, tržnice in soseska srečanja. Brez oglasov, za brskanje pa ne potrebuješ računa.',
      sections: [
        {
          h2: 'Glavni zaslon je zemljevid današnjih dogodkov',
          p: 'Vsaka oznaka je drug dogodek. Brskaj po datumu ali filtriraj kategorije, ki te zanimajo.',
        },
        {
          h2: 'En dotik za pridružitev',
          p: 'Pritisni oznako in si oglej podrobnosti — kdaj, kje in kdo organizira. Sledi dogodku, klepetaj z ostalimi udeleženci in ostani na tekočem, ne da bi zapustil zemljevid.',
        },
        {
          h2: 'Dogodek v 10 sekundah',
          p: 'Naslov je edino obvezno polje. Vse ostalo je neobvezno. Tvoj dogodek se takoj pojavi na zemljevidu in vsak v okolici ga lahko najde.',
        },
        {
          h2: 'Zasebni dogodki',
          p: 'Povabi samo tiste, ki jih izbereš — drugi ne bodo niti videli, da dogodek obstaja.',
        },
      ],
    },
  },
}
