import { create } from 'zustand'
import type { TranslatedSegment } from '../types/subtitle'

export type TranslationTrack = Map<string, TranslatedSegment>

interface TranslationState {
  tracks: Map<string, TranslationTrack>
  activeTrack: string | null
  targetLanguage: string
  isTranslating: boolean
  progress: number
  taskId: string | null
  deeplUsage: { used: number; limit: number }

  setTranslation: (segmentId: string, translated: TranslatedSegment) => void
  setTranslations: (translations: TranslatedSegment[], langCode?: string) => void
  setTargetLanguage: (lang: string) => void
  setActiveTrack: (langCode: string | null) => void
  removeTrack: (langCode: string) => void
  setIsTranslating: (translating: boolean) => void
  setProgress: (progress: number) => void
  setTaskId: (id: string | null) => void
  setDeeplUsage: (usage: { used: number; limit: number }) => void
  clearTranslations: () => void
}

export const useTranslationStore = create<TranslationState>((set) => ({
  tracks: new Map(),
  activeTrack: null,
  targetLanguage: 'DE',
  isTranslating: false,
  progress: 0,
  taskId: null,
  deeplUsage: { used: 0, limit: 500000 },

  setTranslation: (segmentId, translated) =>
    set((state) => {
      const langCode = state.activeTrack || state.targetLanguage
      const newTracks = new Map(state.tracks)
      const track = new Map(newTracks.get(langCode) || new Map())
      track.set(segmentId, translated)
      newTracks.set(langCode, track)
      return { tracks: newTracks, activeTrack: langCode }
    }),

  setTranslations: (translations, langCode) =>
    set((state) => {
      const lang = langCode || state.targetLanguage
      const newTracks = new Map(state.tracks)
      const track = new Map<string, TranslatedSegment>()
      translations.forEach((t) => track.set(t.id, t))
      newTracks.set(lang, track)
      return { tracks: newTracks, activeTrack: lang }
    }),

  setTargetLanguage: (lang) => set({ targetLanguage: lang }),

  setActiveTrack: (langCode) => set({ activeTrack: langCode }),

  removeTrack: (langCode) =>
    set((state) => {
      const newTracks = new Map(state.tracks)
      newTracks.delete(langCode)
      const newActive = state.activeTrack === langCode
        ? (newTracks.size > 0 ? newTracks.keys().next().value ?? null : null)
        : state.activeTrack
      return { tracks: newTracks, activeTrack: newActive }
    }),

  setIsTranslating: (translating) => set({ isTranslating: translating }),
  setProgress: (progress) => set({ progress }),
  setTaskId: (id) => set({ taskId: id }),
  setDeeplUsage: (usage) => set({ deeplUsage: usage }),

  clearTranslations: () =>
    set({
      tracks: new Map(),
      activeTrack: null,
      isTranslating: false,
      progress: 0,
      taskId: null,
    }),
}))

/** Derive the active track's translations. Use as a selector in components. */
export function selectActiveTranslations(state: TranslationState): TranslationTrack | null {
  if (!state.activeTrack) return null
  return state.tracks.get(state.activeTrack) || null
}
