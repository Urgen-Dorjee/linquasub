import { describe, it, expect, beforeEach } from 'vitest'
import { useTranscriptionStore } from './transcriptionStore'

function resetStore() {
  useTranscriptionStore.setState({
    segments: [],
    isTranscribing: false,
    progress: 0,
    statusMessage: null,
    taskId: null,
    selectedModel: 'small',
    sourceLanguage: 'auto',
    detectedLanguage: null,
  })
}

const seg = (id: string, start: number, end: number, text: string) => ({
  id,
  start,
  end,
  text,
  words: [{ start, end, word: text }],
})

describe('transcriptionStore', () => {
  beforeEach(resetStore)

  it('sets and retrieves segments', () => {
    const store = useTranscriptionStore.getState()
    const segs = [seg('1', 0, 1, 'Hello'), seg('2', 1, 2, 'World')]
    store.setSegments(segs)
    expect(useTranscriptionStore.getState().segments).toHaveLength(2)
  })

  it('appends a segment', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'Hello')])
    store.appendSegment(seg('2', 1, 2, 'World'))
    expect(useTranscriptionStore.getState().segments).toHaveLength(2)
    expect(useTranscriptionStore.getState().segments[1].text).toBe('World')
  })

  it('updates a segment with undo support', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'Hello')])
    store.updateSegment('1', { text: 'Hi' })
    expect(useTranscriptionStore.getState().segments[0].text).toBe('Hi')

    const undone = store.undo()
    expect(undone).toBe(true)
    expect(useTranscriptionStore.getState().segments[0].text).toBe('Hello')
  })

  it('deletes segments with undo support', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'A'), seg('2', 1, 2, 'B'), seg('3', 2, 3, 'C')])
    store.deleteSegments(['2'])
    expect(useTranscriptionStore.getState().segments).toHaveLength(2)

    store.undo()
    expect(useTranscriptionStore.getState().segments).toHaveLength(3)
  })

  it('merges segments', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'A'), seg('2', 1, 2, 'B'), seg('3', 2, 3, 'C')])
    store.mergeSegments(['1', '2'])
    const segs = useTranscriptionStore.getState().segments
    expect(segs).toHaveLength(2)
    expect(segs[0].text).toBe('A B')
    expect(segs[0].start).toBe(0)
    expect(segs[0].end).toBe(2)
  })

  it('splits a segment', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([{
      id: '1', start: 0, end: 2, text: 'Hello World',
      words: [{ start: 0, end: 0.9, word: 'Hello' }, { start: 1.1, end: 2, word: 'World' }],
    }])
    store.splitSegment('1', 1.0)
    const segs = useTranscriptionStore.getState().segments
    expect(segs).toHaveLength(2)
    expect(segs[0].text).toBe('Hello')
    expect(segs[1].text).toBe('World')
  })

  it('redo after undo', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'Hello')])
    store.updateSegment('1', { text: 'Hi' })
    store.undo()
    expect(useTranscriptionStore.getState().segments[0].text).toBe('Hello')

    const redone = store.redo()
    expect(redone).toBe(true)
    expect(useTranscriptionStore.getState().segments[0].text).toBe('Hi')
  })

  it('clears transcription and history', () => {
    const store = useTranscriptionStore.getState()
    store.setSegments([seg('1', 0, 1, 'A')])
    store.updateSegment('1', { text: 'B' })
    store.clearTranscription()

    const state = useTranscriptionStore.getState()
    expect(state.segments).toHaveLength(0)
    expect(state.isTranscribing).toBe(false)
    expect(store.undo()).toBe(false)
  })

  it('sets transcription metadata', () => {
    const store = useTranscriptionStore.getState()
    store.setIsTranscribing(true)
    store.setProgress(50)
    store.setStatusMessage('Processing...')
    store.setTaskId('task-123')
    store.setSelectedModel('large')
    store.setSourceLanguage('en')
    store.setDetectedLanguage('en')

    const state = useTranscriptionStore.getState()
    expect(state.isTranscribing).toBe(true)
    expect(state.progress).toBe(50)
    expect(state.statusMessage).toBe('Processing...')
    expect(state.taskId).toBe('task-123')
    expect(state.selectedModel).toBe('large')
    expect(state.sourceLanguage).toBe('en')
    expect(state.detectedLanguage).toBe('en')
  })
})
