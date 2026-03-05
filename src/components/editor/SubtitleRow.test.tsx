import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubtitleRow from './SubtitleRow'

const mockSegment = {
  id: 'seg-1',
  text: 'Hello world',
  start: 1.5,
  end: 4.2,
}

describe('SubtitleRow', () => {
  it('renders segment text and timing', () => {
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('2.7s')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // index + 1
  })

  it('calls onSelect on click', () => {
    const onSelect = vi.fn()
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Hello world'))
    expect(onSelect).toHaveBeenCalledWith('seg-1', false)
  })

  it('enters edit mode on double click', () => {
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    fireEvent.doubleClick(screen.getByText('Hello world'))
    const input = screen.getByDisplayValue('Hello world')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('calls onUpdate when editing is committed via blur', () => {
    const onUpdate = vi.fn()
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    fireEvent.doubleClick(screen.getByText('Hello world'))
    const input = screen.getByDisplayValue('Hello world')
    fireEvent.change(input, { target: { value: 'Updated text' } })
    fireEvent.blur(input)
    expect(onUpdate).toHaveBeenCalledWith('seg-1', { text: 'Updated text' })
  })

  it('does not call onUpdate if text is unchanged', () => {
    const onUpdate = vi.fn()
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    fireEvent.doubleClick(screen.getByText('Hello world'))
    fireEvent.blur(screen.getByDisplayValue('Hello world'))
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('cancels editing on Escape', () => {
    render(
      <SubtitleRow
        index={0}
        segment={mockSegment}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    fireEvent.doubleClick(screen.getByText('Hello world'))
    const input = screen.getByDisplayValue('Hello world')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    // Should exit edit mode and show original text
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument()
  })
})
