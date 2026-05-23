import type { Resources } from './pl'

const en: Resources = {
  common: { loading: 'Loading…', cancel: 'Cancel', close: 'Close' },
  welcome: {
    tagline: 'Discover events\naround you',
    google: 'Sign in with Google',
    terms: 'By signing in you accept the terms',
    skip: 'Browse without signing in →',
  },
  map: {
    search: 'Search a place…',
    empty: 'All quiet here…',
    emptyCta: 'be the first!',
    days: {
      yesterday: 'Yesterday', today: 'Today', tomorrow: 'Tomorrow',
      friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
    },
    daysShort: {
      yesterday: 'Yest', today: 'Today', tomorrow: 'Tmrw',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    },
  },
  event: {
    organizer: 'Organizer',
    conversation: 'Conversation is live',
    distanceFrom: '{{dist}} from you',
    messageCount_one: '{{count}} message',
    messageCount_few: '{{count}} messages',
    messageCount_many: '{{count}} messages',
    messageCount_other: '{{count}} messages',
    writeMessage: 'Write a message…',
    loginToWrite: 'Sign in to write',
    today: 'TODAY',
  },
  create: {
    title: "What's happening?",
    myLocation: 'My location',
    gpsBased: 'Based on your GPS',
    namePlaceholder: 'e.g. Picnic at sunset',
    tags: 'Tags',
    descLabel: 'Description (optional)',
    descPlaceholder: 'Say a bit more…',
    submit: 'Add event',
    added: 'Event added ✦',
  },
  profile: {
    guest: 'Guest',
    interests: 'Your interests',
    interestsHint: "We'll notify you about matching events",
    radius: 'Notification radius',
    signOut: 'Sign out',
    language: 'Language',
  },
  tags: { party: 'party', outdoor: 'picnic', family: 'family', culture: 'concert', sport: 'sport', food: 'food' },
  status: { live: 'Live', upcoming: 'Soon', extended: 'Still active', ended: 'Ended' },
}

export default en
