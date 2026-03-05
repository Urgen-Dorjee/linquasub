import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settingsStore'

function resetStore() {
  useSettingsStore.setState({
    deeplApiKey: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    translationEngine: 'gemini',
    transcriptionEngine: 'gemini',
    whisperModelCacheDir: '',
    ffmpegPath: '',
    preferGpu: true,
    theme: 'dark',
    settingsLoaded: false,
  })
}

describe('settingsStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('has correct defaults', () => {
    const state = useSettingsStore.getState()
    expect(state.transcriptionEngine).toBe('gemini')
    expect(state.translationEngine).toBe('gemini')
    expect(state.geminiModel).toBe('gemini-2.5-flash')
    expect(state.preferGpu).toBe(true)
    expect(state.theme).toBe('dark')
  })

  it('stores API keys', () => {
    const store = useSettingsStore.getState()
    store.setGeminiApiKey('test-gemini-key')
    store.setDeeplApiKey('test-deepl-key')

    const state = useSettingsStore.getState()
    expect(state.geminiApiKey).toBe('test-gemini-key')
    expect(state.deeplApiKey).toBe('test-deepl-key')
  })

  it('switches engines', () => {
    const store = useSettingsStore.getState()
    store.setTranscriptionEngine('whisper')
    store.setTranslationEngine('deepl')

    const state = useSettingsStore.getState()
    expect(state.transcriptionEngine).toBe('whisper')
    expect(state.translationEngine).toBe('deepl')
  })

  it('toggles GPU preference', () => {
    const store = useSettingsStore.getState()
    store.setPreferGpu(false)
    expect(useSettingsStore.getState().preferGpu).toBe(false)
  })

  it('tracks settings loaded state', () => {
    const store = useSettingsStore.getState()
    expect(useSettingsStore.getState().settingsLoaded).toBe(false)
    store.setSettingsLoaded(true)
    expect(useSettingsStore.getState().settingsLoaded).toBe(true)
  })
})
