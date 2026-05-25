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
    today: 'Hoy', yesterday: 'Ayer',
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
    myEvents: 'Mis eventos',
    signOut: 'Cerrar sesión',
    language: 'Idioma',
  },
  tags: {
    party: 'fiesta', outdoor: 'aire libre', family: 'familiar', culture: 'cultura', sport: 'deporte', food: 'comida',
    music: 'música', art: 'arte', film: 'cine', gaming: 'gaming', tech: 'tech', nature: 'naturaleza',
    travel: 'viajes', yoga: 'yoga', dance: 'baile', comedy: 'comedia', kids: 'niños', pets: 'mascotas',
    volunteering: 'voluntariado', workshop: 'taller',
  },
  status: { live: 'En curso', upcoming: 'Pronto', extended: 'Aún activo', ended: 'Terminado' },
}

export default es
