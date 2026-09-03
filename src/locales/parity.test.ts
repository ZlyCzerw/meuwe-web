import { describe, it, expect } from 'vitest'
import pl from './pl'
import en from './en'
import es from './es'
import de from './de'
import sl from './sl'

const NEW_EVENT_KEYS = [
  'attend', 'attending', 'readMore', 'readLess',
  'backToEvent', 'photoPrev', 'photoNext', 'sendMessage',
  'chainPrev', 'chainNext',
] as const

const MAP_TIMELINE_KEYS = ['modeDay', 'modeRange', 'closeTimeline'] as const

const APP_UPDATE_KEYS = [
  'title', 'body', 'action', 'later', 'blockedTitle', 'blockedBody',
] as const

const MY_DATA_KEYS = [
  'title', 'back', 'avatarColor', 'name', 'namePlaceholder',
  'aboutMe', 'aboutMeHint', 'bio', 'bioPlaceholder', 'home', 'homePlaceholder',
  'creatorKind', 'creatorKind_person', 'creatorKind_organizer', 'creatorKind_venue', 'creatorKind_community',
  'link', 'linkPlaceholder',
  'aboutYou', 'aboutYouHint', 'birthYear', 'birthYearPlaceholder',
  'gender', 'gender_female', 'gender_male', 'gender_other',
  'residence', 'residence_local', 'residence_newcomer', 'residence_visitor',
  'occupation', 'occupation_student', 'occupation_working', 'occupation_other',
  'university', 'fieldOfStudy',
  'foundVia', 'foundVia_friend', 'foundVia_poster', 'foundVia_social', 'foundVia_store', 'foundVia_university', 'foundVia_other',
  'save', 'saved', 'saveFailed',
  'error_tooLong', 'error_invalidUrl', 'error_outOfRange',
] as const

const LANDING_COOKIES_KEYS = [
  'title', 'body', 'acceptAll', 'necessaryOnly', 'customize', 'save', 'close',
  'necessary', 'necessaryDesc', 'analytics', 'analyticsDesc', 'privacy',
] as const

const USER_CARD_KEYS = [
  'follow', 'following', 'followingHint', 'thisIsYou',
  'eventsCount_one', 'eventsCount_few', 'eventsCount_many', 'eventsCount_other',
  'followersCount_one', 'followersCount_few', 'followersCount_many', 'followersCount_other',
  'loadFailed', 'followFailed', 'openProfile',
] as const

const LOCALES = { pl, en, es, de, sl }

describe('locale parity', () => {
  // Brakujący klucz nie wywraca aplikacji — pokazuje użytkownikowi surowy
  // identyfikator, więc bez testu wyciek zauważy dopiero ktoś na produkcji.
  it.each(Object.entries(LOCALES))('%s carries every new event key', (_name, dict) => {
    const event = (dict as { event: Record<string, unknown> }).event
    for (const key of NEW_EVENT_KEYS) {
      expect(typeof event[key]).toBe('string')
      expect(event[key]).not.toBe('')
    }
  })
})

describe('landing headline', () => {
  // H1 był kopią welcome.tagline, więc ta sama treść stała na stronie dwa razy
  // i ani razu nie mówiła "mapa" ani "lokalne wydarzenia".
  it.each(Object.entries(LOCALES))('%s defines landing.h1', (_name, dict) => {
    const landing = (dict as { landing: Record<string, unknown> }).landing
    expect(typeof landing.h1).toBe('string')
    expect(landing.h1).not.toBe('')
  })

  it.each(Object.entries(LOCALES))('%s does not reuse the tagline as h1', (_name, dict) => {
    const d = dict as { landing: Record<string, unknown>; welcome: Record<string, unknown> }
    expect(d.landing.h1).not.toBe(d.welcome.tagline)
  })
})

describe('timeline strip labels', () => {
  it.each(Object.entries(LOCALES))('%s names both modes and the close button', (_name, dict) => {
    const map = (dict as { map: Record<string, unknown> }).map
    for (const key of MAP_TIMELINE_KEYS) {
      expect(typeof map[key]).toBe('string')
      expect(map[key]).not.toBe('')
    }
  })
})

describe('update prompts', () => {
  // The blocking screen is the one text nobody can dismiss their way past, and
  // it reaches people precisely when the app is already failing them.
  it.each(Object.entries(LOCALES))('%s carries every update key', (_name, dict) => {
    const appUpdate = (dict as { appUpdate: Record<string, unknown> }).appUpdate
    for (const key of APP_UPDATE_KEYS) {
      expect(typeof appUpdate[key]).toBe('string')
      expect(appUpdate[key]).not.toBe('')
    }
  })
})

describe('my data panel', () => {
  it.each(Object.entries(LOCALES))('%s carries every myData key and the account entry', (_name, dict) => {
    const d = dict as { myData: Record<string, unknown>; account: Record<string, unknown> }
    for (const key of MY_DATA_KEYS) {
      expect(typeof d.myData[key]).toBe('string')
      expect(d.myData[key]).not.toBe('')
    }
    expect(typeof d.account.myData).toBe('string')
    // Modal nazwy zniknął; jego klucze nie mają prawa zostać jako martwe.
    expect(d.account.nicknameTitle).toBeUndefined()
  })
})

describe('cookie consent', () => {
  // Baner zgody to pierwsza rzecz, jaką widzi nowy gość — surowy klucz zamiast
  // tekstu na przycisku „Akceptuj" podważa całą resztę strony.
  it.each(Object.entries(LOCALES))('%s carries every cookie consent key', (_name, dict) => {
    const cookies = (dict as { landing: { cookies?: Record<string, unknown> } }).landing.cookies ?? {}
    for (const key of LANDING_COOKIES_KEYS) {
      expect(typeof cookies[key]).toBe('string')
      expect(cookies[key]).not.toBe('')
    }
  })
})

describe('followed users', () => {
  it.each(Object.entries(LOCALES))('%s names the menu entry and the empty state', (_name, dict) => {
    const d = dict as { profile: Record<string, unknown>; followedUsers?: Record<string, unknown> }
    expect(typeof d.profile.followedUsers).toBe('string')
    expect(d.profile.followedUsers).not.toBe('')
    expect(typeof d.followedUsers?.empty).toBe('string')
    expect(d.followedUsers?.empty).not.toBe('')
  })
})

describe('list quick actions', () => {
  // Przyciski „−” i „Zakończyć?” w listach mają tylko ikonę; etykieta z i18n
  // jest jedynym tekstem, jaki dostaje czytnik ekranu.
  it.each(Object.entries(LOCALES))('%s names unfollow and the end confirmation', (_name, dict) => {
    const d = dict as { follow: Record<string, unknown>; event: Record<string, unknown> }
    expect(typeof d.follow.unfollow).toBe('string')
    expect(d.follow.unfollow).not.toBe('')
    expect(typeof d.event.endConfirm).toBe('string')
    expect(d.event.endConfirm).not.toBe('')
  })
})

describe('user card', () => {
  // Karta cudzego profilu to pierwszy ekran, na którym ktoś ocenia obcą osobę -
  // surowy klucz zamiast "Obserwuj" podważa i kartę, i tę osobę.
  it.each(Object.entries(LOCALES))('%s carries every userCard key', (_name, dict) => {
    const userCard = (dict as { userCard?: Record<string, unknown> }).userCard ?? {}
    for (const key of USER_CARD_KEYS) {
      expect(typeof userCard[key]).toBe('string')
      expect(userCard[key]).not.toBe('')
    }
  })
})
