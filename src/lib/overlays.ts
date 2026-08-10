// One answer to "is anything on screen right now".
//
// Two cards let themselves in uninvited — the app-install nudge and the
// notification ask — and both are polled, so both have to know when to keep
// quiet. They used to keep separate hand-written lists of what counts as busy,
// and the lists drifted the moment the first-run chain grew: the install nudge
// still knew nothing about the interests and invite cards, so it fired
// underneath them. Unseen, and counted as shown, which also started its
// three-day cooldown — the nudge simply stopped appearing.
//
// Every flag is required rather than optional on purpose. Adding a layer to the
// app means adding a field here, and then the compiler makes every caller say
// what it is, instead of failing silently the way this did.

export interface OverlayFlags {
  /** Anything but 'map' means the user is somewhere else entirely. */
  screen: string
  authModal: boolean
  selEvent: boolean
  myEventSelected: boolean
  followedEventSelected: boolean
  createOpen: boolean
  profileOpen: boolean
  accountOpen: boolean
  pickingLocation: boolean
  promoOpen: boolean
  locationModalOpen: boolean
  interestsModalOpen: boolean
  inviteModalOpen: boolean
  pushAskOpen: boolean
  attendanceAskOpen: boolean
}

/** True only on a bare map, with nothing above it. */
export function isScreenClear(f: OverlayFlags): boolean {
  if (f.screen !== 'map') return false
  return !f.authModal
    && !f.selEvent
    && !f.myEventSelected
    && !f.followedEventSelected
    && !f.createOpen
    && !f.profileOpen
    && !f.accountOpen
    && !f.pickingLocation
    && !f.promoOpen
    && !f.locationModalOpen
    && !f.interestsModalOpen
    && !f.inviteModalOpen
    && !f.pushAskOpen
    && !f.attendanceAskOpen
}
