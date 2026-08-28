import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import UpdateSheet from './UpdateSheet'

describe('UpdateSheet', () => {
  it('lets a nudge be waved away', () => {
    const onDismiss = vi.fn()
    render(<UpdateSheet mode="optional" onUpdate={() => {}} onDismiss={onDismiss} />)
    screen.getByText('appUpdate.later').click()
    expect(onDismiss).toHaveBeenCalled()
  })

  it('starts the update from the nudge', () => {
    const onUpdate = vi.fn()
    render(<UpdateSheet mode="optional" onUpdate={onUpdate} onDismiss={() => {}} />)
    screen.getByText('appUpdate.action').click()
    expect(onUpdate).toHaveBeenCalled()
  })

  // The whole point of the blocking mode: no close button, no "not now", no way
  // back to an app that cannot reach its backend.
  it('offers no way out of the blocking screen', () => {
    render(<UpdateSheet mode="blocking" onUpdate={() => {}} />)
    expect(screen.getByText('appUpdate.blockedTitle')).toBeInTheDocument()
    expect(screen.queryByText('appUpdate.later')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('common.close')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
