import { describe, it, expect, beforeEach } from 'vitest'
import { useTranslationStore, selectActiveTranslations } from './translationStore'

function resetStore() {
  useTranslationStore.setState({
    tracks: new Map(),
    activeTrack: null,
    targetLanguage: 'DE',
    isTranslating: false,
    progress: 0,
    taskId: null,
    deeplUsage: { used: 0, limit: 500000 },
  })
}

describe('translationStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('setTranslations', () => {
    it('creates a translation track with all segments', () => {
      const store = useTranslationStore.getState()
      store.setTranslations([
        { id: '1', originalText: 'Hello', translatedText: 'Hallo' },
        { id: '2', originalText: 'World', translatedText: 'Welt' },
      ], 'DE')

      const state = useTranslationStore.getState()
      expect(state.tracks.size).toBe(1)
      expect(state.activeTrack).toBe('DE')

      const track = state.tracks.get('DE')!
      expect(track.size).toBe(2)
      expect(track.get('1')!.translatedText).toBe('Hallo')
    })
  })

  describe('setTranslation', () => {
    it('adds a single translation to the active track', () => {
      const store = useTranslationStore.getState()
      store.setTranslation('1', { id: '1', originalText: 'Hello', translatedText: 'Bonjour' })

      const state = useTranslationStore.getState()
      expect(state.activeTrack).toBe('DE')
      const track = state.tracks.get('DE')!
      expect(track.get('1')!.translatedText).toBe('Bonjour')
    })
  })

  describe('removeTrack', () => {
    it('removes a track and updates activeTrack', () => {
      const store = useTranslationStore.getState()
      store.setTranslations([{ id: '1', originalText: 'Hello', translatedText: 'Hallo' }], 'DE')
      store.setTranslations([{ id: '1', originalText: 'Hello', translatedText: 'Salut' }], 'FR')

      store.removeTrack('DE')

      const state = useTranslationStore.getState()
      expect(state.tracks.size).toBe(1)
      expect(state.tracks.has('DE')).toBe(false)
    })
  })

  describe('selectActiveTranslations', () => {
    it('returns null when no active track', () => {
      const state = useTranslationStore.getState()
      expect(selectActiveTranslations(state)).toBeNull()
    })

    it('returns the active track translations', () => {
      const store = useTranslationStore.getState()
      store.setTranslations([{ id: '1', originalText: 'Hello', translatedText: 'Hallo' }], 'DE')

      const state = useTranslationStore.getState()
      const result = selectActiveTranslations(state)
      expect(result).not.toBeNull()
      expect(result!.get('1')!.translatedText).toBe('Hallo')
    })
  })

  describe('clearTranslations', () => {
    it('resets all translation state', () => {
      const store = useTranslationStore.getState()
      store.setTranslations([{ id: '1', originalText: 'Hello', translatedText: 'Hallo' }], 'DE')
      store.clearTranslations()

      const state = useTranslationStore.getState()
      expect(state.tracks.size).toBe(0)
      expect(state.activeTrack).toBeNull()
      expect(state.isTranslating).toBe(false)
    })
  })
})
