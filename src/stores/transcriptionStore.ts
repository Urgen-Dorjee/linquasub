import { create } from 'zustand'
import type { Segment } from '../types/subtitle'
import type { WhisperModelSize } from '../types/project'
import { SegmentHistory } from './historyMiddleware'

const history = new SegmentHistory()

interface TranscriptionState {
  segments: Segment[]
  isTranscribing: boolean
  progress: number
  statusMessage: string | null
  taskId: string | null
  selectedModel: WhisperModelSize
  sourceLanguage: string
  detectedLanguage: string | null

  setSegments: (segments: Segment[]) => void
  appendSegment: (segment: Segment) => void
  updateSegment: (id: string, patch: Partial<Segment>) => void
  splitSegment: (id: string, splitTime: number) => void
  mergeSegments: (ids: string[]) => void
  deleteSegments: (ids: string[]) => void
  undo: () => boolean
  redo: () => boolean
  setIsTranscribing: (transcribing: boolean) => void
  setProgress: (progress: number) => void
  setStatusMessage: (msg: string | null) => void
  setTaskId: (id: string | null) => void
  setSelectedModel: (model: WhisperModelSize) => void
  setSourceLanguage: (lang: string) => void
  setDetectedLanguage: (lang: string | null) => void
  clearTranscription: () => void
}

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  segments: [],
  isTranscribing: false,
  progress: 0,
  statusMessage: null,
  taskId: null,
  selectedModel: 'small',
  sourceLanguage: 'auto',
  detectedLanguage: null,

  setSegments: (segments) => set({ segments }),
  appendSegment: (segment) => set((state) => ({ segments: [...state.segments, segment] })),

  updateSegment: (id, patch) => {
    history.push(get().segments)
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  },

  splitSegment: (id, splitTime) => {
    const state = get()
    const index = state.segments.findIndex((s) => s.id === id)
    if (index === -1) return
    const segment = state.segments[index]
    if (splitTime <= segment.start || splitTime >= segment.end) return

    history.push(state.segments)

    const wordsA = segment.words.filter((w) => w.end <= splitTime)
    const wordsB = segment.words.filter((w) => w.start >= splitTime)

    const segA: Segment = {
      ...segment,
      id: `${segment.id}_a`,
      end: splitTime,
      text: wordsA.map((w) => w.word).join(' '),
      words: wordsA,
    }
    const segB: Segment = {
      id: `${segment.id}_b`,
      start: splitTime,
      end: segment.end,
      text: wordsB.map((w) => w.word).join(' '),
      words: wordsB,
    }

    const newSegments = [...state.segments]
    newSegments.splice(index, 1, segA, segB)
    set({ segments: newSegments })
  },

  mergeSegments: (ids) => {
    const state = get()
    const toMerge = state.segments.filter((s) => ids.includes(s.id))
    if (toMerge.length < 2) return

    history.push(state.segments)

    toMerge.sort((a, b) => a.start - b.start)
    const merged: Segment = {
      id: toMerge[0].id,
      start: toMerge[0].start,
      end: toMerge[toMerge.length - 1].end,
      text: toMerge.map((s) => s.text).join(' '),
      words: toMerge.flatMap((s) => s.words),
    }

    const firstIdx = state.segments.findIndex((s) => s.id === toMerge[0].id)
    const filtered = state.segments.filter((s) => !ids.includes(s.id))
    filtered.splice(firstIdx, 0, merged)
    set({ segments: filtered })
  },

  deleteSegments: (ids) => {
    history.push(get().segments)
    set((state) => ({
      segments: state.segments.filter((s) => !ids.includes(s.id)),
    }))
  },

  undo: () => {
    const restored = history.undo(get().segments)
    if (!restored) return false
    set({ segments: restored })
    return true
  },

  redo: () => {
    const restored = history.redo(get().segments)
    if (!restored) return false
    set({ segments: restored })
    return true
  },

  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  setProgress: (progress) => set({ progress }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setTaskId: (id) => set({ taskId: id }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  clearTranscription: () => {
    history.clear()
    set({
      segments: [],
      isTranscribing: false,
      progress: 0,
      statusMessage: null,
      taskId: null,
      detectedLanguage: null,
    })
  },
}))
