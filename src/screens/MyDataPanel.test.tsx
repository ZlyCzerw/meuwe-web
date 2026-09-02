import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import MyDataPanel from './MyDataPanel'
import type { Profile, ProfilePrivate } from '../lib/types'
import type { PlaceResult } from '../lib/placeSearch'
import '../lib/i18n'

const updateProfile = vi.fn()
const getProfilePrivate = vi.fn<() => Promise<ProfilePrivate | null>>()
const upsertProfilePrivate = vi.fn()
const trackClick = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    getProfilePrivate: () => getProfilePrivate(),
    upsertProfilePrivate: (...a: unknown[]) => upsertProfilePrivate(...a),
    trackClick: (...a: unknown[]) => trackClick(...a),
  },
  supabase: {},
}))

// Photon nie jest tu potrzebny: pole miejscowości dostaje atrapę, która na
// kliknięcie „pick” oddaje gotowy wynik, a na „clear” zgłasza pusty tekst.
vi.mock('../components/PlaceSearchInput', () => ({
  default: ({ onSelect, onQueryChange, initialQuery }: {
    onSelect: (r: PlaceResult) => void; onQueryChange?: (q: string) => void; initialQuery?: string
  }) => (
    <div>
      <span data-testid="home-query">{initialQuery}</span>
      <button onClick={() => onSelect({ id: '1', primary: 'Rzeszów', secondary: 'Podkarpackie, Polska', lat: 50.04, lng: 22.0 })}>pick</button>
      <button onClick={() => onQueryChange?.('')}>clear</button>
    </div>
  ),
}))

const session = { user: { id: 'u1', email: 'a@b.c' } } as unknown as Session

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1', display_name: 'Kasia', nickname: 'Ala', name_shown: 'Ala',
    avatar_color: '#FF7A45', bio: null, home_name: null, creator_kind: null, link_url: null,
    radius_km: 10, interests: [], interests_onboarded_at: null,
    last_lat: null, last_lng: null, last_seen_at: null,
    created_at: '2026-09-01T00:00:00Z', push_enabled: false, language: 'en',
    ...over,
  }
}

function renderPanel(p: Profile = profile(), onSaved = vi.fn()) {
  render(<MyDataPanel open onClose={() => {}} session={session} profile={p} onSaved={onSaved} />)
  return onSaved
}

beforeEach(() => {
  vi.clearAllMocks()
  updateProfile.mockResolvedValue({ data: [{ id: 'u1' }], error: null })
  upsertProfilePrivate.mockResolvedValue({ data: [{ id: 'u1' }], error: null })
  getProfilePrivate.mockResolvedValue(null)
})

describe('MyDataPanel', () => {
  it('starts from the current name and colour', async () => {
    renderPanel()
    expect((await screen.findByLabelText('Name') as HTMLInputElement).value).toBe('Ala')
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows university and field only for a student', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    expect(screen.queryByLabelText('University')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Student'))
    expect(screen.getByLabelText('University')).toBeInTheDocument()
    expect(screen.getByLabelText('Field of study')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Working'))
    expect(screen.queryByLabelText('University')).not.toBeInTheDocument()
  })

  it('tapping a selected chip deselects it', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    const chip = screen.getByText('A venue')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('previews a colour on the avatar before saving', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByLabelText('colour #4FC3F7'))
    expect(screen.getByTestId('avatar-preview')).toHaveStyle({ background: '#4FC3F7' })
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves public fields to profiles and private ones to profiles_private', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ala  Nowa ' } })
    fireEvent.click(screen.getByLabelText('colour #4FC3F7'))
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: ' koncerty w piwnicy ' } })
    fireEvent.click(screen.getByText('pick'))
    fireEvent.click(screen.getByText('A venue'))
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'instagram.com/klub' } })
    fireEvent.change(screen.getByLabelText('Year of birth'), { target: { value: '1998' } })
    fireEvent.click(screen.getByText('Student'))
    fireEvent.change(screen.getByLabelText('University'), { target: { value: 'PRz' } })
    fireEvent.click(screen.getByText('A poster'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({
      id: 'u1', nickname: 'Ala Nowa', avatar_color: '#4FC3F7',
      bio: 'koncerty w piwnicy', home_name: 'Rzeszów, Podkarpackie, Polska',
      creator_kind: 'venue', link_url: 'https://instagram.com/klub',
    })
    expect(upsertProfilePrivate).toHaveBeenCalledWith({
      id: 'u1', birth_year: 1998, gender: null, residence_status: null, occupation: 'student',
      university: 'PRz', field_of_study: null, found_via: 'poster', home_lat: 50.04, home_lng: 22.0,
    })
    expect(trackClick).toHaveBeenCalledWith('profile_save')
  })

  it('an empty name means "use the provider name" - nickname null, no error', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ nickname: null }))
  })

  it('does not create a private row when nothing private was filled in', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'tylko bio' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(upsertProfilePrivate).not.toHaveBeenCalled()
  })

  it('clearing the town clears name and both coordinates', async () => {
    getProfilePrivate.mockResolvedValue({
      id: 'u1', birth_year: null, gender: null, residence_status: null, occupation: null,
      university: null, field_of_study: null, found_via: null, home_lat: 50.04, home_lng: 22.0,
      signup_ip_lat: null, signup_ip_lng: null, signup_country: null, signup_gps_lat: null, signup_gps_lng: null,
      signup_platform: null, signup_app_version: null, signup_provider: null, signup_source: null,
      signup_recorded_at: null, updated_at: '',
    })
    const onSaved = renderPanel(profile({ home_name: 'Rzeszów, Podkarpackie, Polska' }))
    expect(await screen.findByTestId('home-query')).toHaveTextContent('Rzeszów, Podkarpackie, Polska')
    fireEvent.click(screen.getByText('clear'))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ home_name: null }))
    // Wiersz istnieje, więc upsert idzie mimo pustych pól - i zeruje współrzędne.
    expect(upsertProfilePrivate).toHaveBeenCalledWith(expect.objectContaining({ home_lat: null, home_lng: null }))
  })

  it('shows a field error and does not save', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'tylko tekst' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('That does not look like a web address')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('a rejected name keeps the panel open with the nickname message', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('That name is too short')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('states a failed write and stays open', async () => {
    updateProfile.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('Could not save, please try again')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
