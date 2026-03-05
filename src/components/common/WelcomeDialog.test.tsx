import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WelcomeDialog from './WelcomeDialog'

const WELCOME_DISMISSED_KEY = 'linguasub_welcome_dismissed'

describe('WelcomeDialog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows on first visit', () => {
    render(<WelcomeDialog />)
    expect(screen.getByText('Welcome to LinguaSub')).toBeInTheDocument()
  })

  it('does not show when already dismissed', () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    render(<WelcomeDialog />)
    expect(screen.queryByText('Welcome to LinguaSub')).not.toBeInTheDocument()
  })

  it('shows features on step 0', () => {
    render(<WelcomeDialog />)
    expect(screen.getByText('Import Video')).toBeInTheDocument()
    expect(screen.getByText('AI Transcription')).toBeInTheDocument()
    expect(screen.getByText('Multi-Language')).toBeInTheDocument()
    expect(screen.getByText('Export Anywhere')).toBeInTheDocument()
  })

  it('navigates to shortcuts on Next click', () => {
    render(<WelcomeDialog />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Play / Pause')).toBeInTheDocument()
  })

  it('navigates back from step 1', () => {
    render(<WelcomeDialog />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Import Video')).toBeInTheDocument()
  })

  it('dismisses and saves to localStorage on Get Started', () => {
    render(<WelcomeDialog />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Get Started'))
    expect(screen.queryByText('Welcome to LinguaSub')).not.toBeInTheDocument()
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe('true')
  })

  it('dismisses on X button click', () => {
    render(<WelcomeDialog />)
    // X button is the only button in the header area
    const buttons = screen.getAllByRole('button')
    // First button after header text is the X close button
    fireEvent.click(buttons[0])
    expect(screen.queryByText('Welcome to LinguaSub')).not.toBeInTheDocument()
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe('true')
  })
})
