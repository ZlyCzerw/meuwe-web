import type { Resources } from './pl'

const es: Resources = {
  common: { loading: 'Cargando…', cancel: 'Cancelar', close: 'Cerrar' },
  welcome: {
    tagline: 'Descubre eventos\na tu alrededor',
    google: 'Inicia sesión con Google',
    terms: 'Al iniciar sesión aceptas los términos',
    skip: 'Explorar sin iniciar sesión →',
  },
  map: {
    search: 'Busca un lugar…',
    empty: 'Todo tranquilo aquí…',
    emptyCta: '¡sé el primero!',
    days: {
      yesterday: 'Ayer', today: 'Hoy', tomorrow: 'Mañana',
      friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
    },
  },
  event: {
    organizer: 'Organizador',
    conversation: 'La conversación está activa',
    distanceFrom: '{{dist}} de ti',
    messageCount_one: '{{count}} mensaje',
    messageCount_few: '{{count}} mensajes',
    messageCount_many: '{{count}} mensajes',
    messageCount_other: '{{count}} mensajes',
    writeMessage: 'Escribe un mensaje…',
    loginToWrite: 'Inicia sesión para escribir',
    today: 'HOY',
  },
  create: {
    title: '¿Qué está pasando?',
    myLocation: 'Mi ubicación',
    gpsBased: 'Según tu GPS',
    namePlaceholder: 'p. ej. Picnic al atardecer',
    tags: 'Etiquetas',
    descLabel: 'Descripción (opcional)',
    descPlaceholder: 'Cuenta algo más…',
    submit: 'Añadir evento',
    added: 'Evento añadido ✦',
  },
  profile: {
    guest: 'Invitado',
    interests: 'Tus intereses',
    interestsHint: 'Te avisaremos de eventos que coincidan',
    radius: 'Radio de notificaciones',
    signOut: 'Cerrar sesión',
    language: 'Idioma',
  },
  tags: { party: 'fiesta', outdoor: 'picnic', family: 'familiar', culture: 'concierto', sport: 'deporte', food: 'comida' },
  status: { live: 'En curso', upcoming: 'Pronto', extended: 'Aún activo', ended: 'Terminado' },
}

export default es
