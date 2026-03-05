import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentHistory } from './historyMiddleware'
import type { Segment } from '../types/subtitle'

const seg = (id: string, text: string): Segment => ({
  id, text, start: 0, end: 1, words: [{ start: 0, end: 1, word: text }],
})

describe('SegmentHistory', () => {
  let history: SegmentHistory

  beforeEach(() => {
    history = new SegmentHistory()
  })

  it('starts with no undo/redo available', () => {
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('undo restores previous state', () => {
    const v1 = [seg('1', 'Hello')]
    history.push(v1)

    const restored = history.undo([seg('1', 'Changed')])
    expect(restored).not.toBeNull()
    expect(restored![0].text).toBe('Hello')
  })

  it('redo restores forward state', () => {
    const v1 = [seg('1', 'Hello')]
    history.push(v1)
    const current = [seg('1', 'Changed')]
    history.undo(current)

    const restored = history.redo([seg('1', 'Hello')])
    expect(restored).not.toBeNull()
    expect(restored![0].text).toBe('Changed')
  })

  it('push clears redo stack', () => {
    history.push([seg('1', 'v1')])
    history.undo([seg('1', 'v2')])
    expect(history.canRedo).toBe(true)

    history.push([seg('1', 'v3')])
    expect(history.canRedo).toBe(false)
  })

  it('limits history to 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      history.push([seg('1', `v${i}`)])
    }
    let undoCount = 0
    while (history.canUndo) {
      history.undo([seg('1', 'current')])
      undoCount++
    }
    expect(undoCount).toBe(50)
  })

  it('clear removes all history', () => {
    history.push([seg('1', 'v1')])
    history.push([seg('1', 'v2')])
    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('undo returns null when empty', () => {
    expect(history.undo([seg('1', 'x')])).toBeNull()
  })

  it('redo returns null when empty', () => {
    expect(history.redo([seg('1', 'x')])).toBeNull()
  })

  it('clones segments to avoid mutation', () => {
    const original = [seg('1', 'Hello')]
    history.push(original)
    original[0].text = 'Mutated'

    const restored = history.undo([seg('1', 'Current')])
    expect(restored![0].text).toBe('Hello') // not mutated
  })
})
