import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeleteAccountModal from './DeleteAccountModal'
// The modal itself does not pull in i18n; without this the translator returns
// raw keys and every assertion below would be meaningless.
import '../lib/i18n'

const deleteAccount = vi.fn<() => Promise<'ok' | 'failed'>>()
vi.mock('../lib/account', () => ({ deleteAccount: () => deleteAccount() }))
vi.mock('../lib/supabase', () => ({ db: { trackClick: vi.fn() }, supabase: {} }))

beforeEach(() => vi.clearAllMocks())

describe('DeleteAccountModal', () => {
  it('says exactly what survives, so the promise matches what happens', () => {
    render(<DeleteAccountModal onDeleted={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/Events you added stay on the map/)).toBeInTheDocument()
    expect(screen.getByText(/chat messages stay/)).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('does nothing until the confirm button is pressed', () => {
    const onDeleted = vi.fn()
    render(<DeleteAccountModal onDeleted={onDeleted} onClose={() => {}} />)
    expect(deleteAccount).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('hands control back only after the deletion really succeeded', async () => {
    deleteAccount.mockResolvedValue('ok')
    const onDeleted = vi.fn()
    render(<DeleteAccountModal onDeleted={onDeleted} onClose={() => {}} />)

    fireEvent.click(screen.getByText('Delete account for good'))

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  it('states a failure and keeps the user where they are', async () => {
    deleteAccount.mockResolvedValue('failed')
    const onDeleted = vi.fn()
    const onClose = vi.fn()
    render(<DeleteAccountModal onDeleted={onDeleted} onClose={onClose} />)

    fireEvent.click(screen.getByText('Delete account for good'))

    await waitFor(() => {
      expect(screen.getByText(/Could not delete the account/)).toBeInTheDocument()
    })
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancels without touching the account', () => {
    const onClose = vi.fn()
    render(<DeleteAccountModal onDeleted={() => {}} onClose={onClose} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })
})
