import { create } from 'zustand'

interface SettingsState {
  deeplApiKey: string
  geminiApiKey: string
  geminiModel: string
  translationEngine: 'gemini' | 'deepl'
  transcriptionEngine: 'whisper' | 'gemini'
  whisperModelCacheDir: string
  ffmpegPath: string
  preferGpu: boolean
  theme: 'dark' | 'light'
  settingsLoaded: boolean

  setDeeplApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setGeminiModel: (model: string) => void
  setTranslationEngine: (engine: 'gemini' | 'deepl') => void
  setTranscriptionEngine: (engine: 'whisper' | 'gemini') => void
  setWhisperModelCacheDir: (dir: string) => void
  setFfmpegPath: (path: string) => void
  setPreferGpu: (prefer: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  setSettingsLoaded: (loaded: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
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

  setDeeplApiKey: (key) => set({ deeplApiKey: key }),
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),
  setGeminiModel: (model) => set({ geminiModel: model }),
  setTranslationEngine: (engine) => set({ translationEngine: engine }),
  setTranscriptionEngine: (engine) => set({ transcriptionEngine: engine }),
  setWhisperModelCacheDir: (dir) => set({ whisperModelCacheDir: dir }),
  setFfmpegPath: (path) => set({ ffmpegPath: path }),
  setPreferGpu: (prefer) => set({ preferGpu: prefer }),
  setTheme: (theme) => set({ theme }),
  setSettingsLoaded: (loaded) => set({ settingsLoaded: loaded }),
}))
