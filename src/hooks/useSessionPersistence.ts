import { useEffect, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useTranslationStore } from '../stores/translationStore'
import { useExportStore } from '../stores/exportStore'
import { useSettingsStore } from '../stores/settingsStore'
import api from '../services/api'
import type { TranslatedSegment } from '../types/subtitle'

const DEBOUNCE_MS = 2000

function gatherSessionData() {
  const project = useProjectStore.getState()
  const transcription = useTranscriptionStore.getState()
  const translation = useTranslationStore.getState()
  const exportStore = useExportStore.getState()
  const settings = useSettingsStore.getState()

  // Convert multi-track Maps to serializable format
  const tracksObj: Record<string, TranslatedSegment[]> = {}
  translation.tracks.forEach((track, langCode) => {
    const arr: TranslatedSegment[] = []
    track.forEach((t) => arr.push(t))
    tracksObj[langCode] = arr
  })

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    video: {
      path: project.videoPath,
      url: project.videoUrl,
      duration: project.videoDuration,
      metadata: project.videoMetadata,
    },
    transcription: {
      segments: transcription.segments,
      sourceLanguage: transcription.sourceLanguage,
      detectedLanguage: transcription.detectedLanguage,
      selectedModel: transcription.selectedModel,
    },
    translation: {
      tracks: tracksObj,
      activeTrack: translation.activeTrack,
      targetLanguage: translation.targetLanguage,
    },
    export: {
      style: exportStore.options.style,
      videoCodec: exportStore.options.videoCodec,
      crf: exportStore.options.crf,
      useTranslation: exportStore.options.useTranslation,
    },
    settings: {
      translationEngine: settings.translationEngine,
      transcriptionEngine: settings.transcriptionEngine,
    },
  }
}

function restoreSession(data: Record<string, unknown>) {
  if (!data || !data.version) return false

  const video = data.video as Record<string, unknown> | undefined
  const transcription = data.transcription as Record<string, unknown> | undefined
  const translation = data.translation as Record<string, unknown> | undefined
  const exportData = data.export as Record<string, unknown> | undefined
  const settingsData = data.settings as Record<string, unknown> | undefined

  // Restore video info
  if (video?.path) {
    useProjectStore.getState().setVideoFile(video.path as string)
    if (video.metadata) {
      useProjectStore.getState().setVideoMetadata(video.metadata as any)
    }
    if (video.url) {
      useProjectStore.getState().setYouTubeUrl(video.url as string)
    }
  }

  // Restore transcription
  if (transcription?.segments && Array.isArray(transcription.segments) && transcription.segments.length > 0) {
    useTranscriptionStore.getState().setSegments(transcription.segments as any[])
    if (transcription.sourceLanguage) {
      useTranscriptionStore.getState().setSourceLanguage(transcription.sourceLanguage as string)
    }
    if (transcription.detectedLanguage) {
      useTranscriptionStore.getState().setDetectedLanguage(transcription.detectedLanguage as string)
    }
    if (transcription.selectedModel) {
      useTranscriptionStore.getState().setSelectedModel(transcription.selectedModel as any)
    }
  }

  // Restore translations — support both v1 (single array) and v2 (multi-track)
  if (translation) {
    const translationStore = useTranslationStore.getState()
    if (translation.tracks && typeof translation.tracks === 'object') {
      // v2: multi-track format
      const tracksObj = translation.tracks as Record<string, TranslatedSegment[]>
      for (const [langCode, arr] of Object.entries(tracksObj)) {
        if (Array.isArray(arr) && arr.length > 0) {
          translationStore.setTranslations(arr as TranslatedSegment[], langCode)
        }
      }
      if (translation.activeTrack) {
        translationStore.setActiveTrack(translation.activeTrack as string)
      }
    } else if (Array.isArray(translation.translations) && translation.translations.length > 0) {
      // v1: single translations array — import as a track under targetLanguage
      const lang = (translation.targetLanguage as string) || 'Unknown'
      translationStore.setTranslations(translation.translations as TranslatedSegment[], lang)
    }
    if (translation.targetLanguage) {
      translationStore.setTargetLanguage(translation.targetLanguage as string)
    }
  }

  // Restore export preferences
  if (exportData?.style) {
    useExportStore.getState().setStyle(exportData.style as any)
  }
  if (exportData?.videoCodec) {
    useExportStore.getState().setOptions({ videoCodec: exportData.videoCodec as 'h264' | 'h265' })
  }
  if (exportData?.crf) {
    useExportStore.getState().setOptions({ crf: exportData.crf as number })
  }
  if (typeof exportData?.useTranslation === 'boolean') {
    useExportStore.getState().setOptions({ useTranslation: exportData.useTranslation })
  }

  // Restore engine settings
  if (settingsData?.translationEngine) {
    useSettingsStore.getState().setTranslationEngine(settingsData.translationEngine as any)
  }
  if (settingsData?.transcriptionEngine) {
    useSettingsStore.getState().setTranscriptionEngine(settingsData.transcriptionEngine as any)
  }

  return true
}

export function useSessionPersistence(backendReady: boolean) {
  const restoredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore session once on startup when backend is ready
  useEffect(() => {
    if (!backendReady || restoredRef.current) return
    restoredRef.current = true

    api.loadSession().then((data) => {
      if (data && data.version) {
        const hadSegments = Array.isArray(data.transcription?.segments) && data.transcription.segments.length > 0
        restoreSession(data)
        if (hadSegments) {
          console.log('[Session] Restored previous session with', data.transcription.segments.length, 'segments')
        }
      }
    }).catch(() => {
      // No saved session or backend not ready yet
    })
  }, [backendReady])

  // Subscribe to store changes and auto-save (debounced)
  useEffect(() => {
    if (!backendReady) return

    const save = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const data = gatherSessionData()
        // Only save if there's meaningful data (at least a video or segments)
        if (data.video.path || data.transcription.segments.length > 0) {
          api.saveSession(data).catch(() => {})
        }
      }, DEBOUNCE_MS)
    }

    // Subscribe to all relevant stores
    const unsubs = [
      useProjectStore.subscribe((state, prev) => {
        if (state.videoPath !== prev.videoPath || state.videoMetadata !== prev.videoMetadata) {
          save()
        }
      }),
      useTranscriptionStore.subscribe((state, prev) => {
        if (
          state.segments !== prev.segments ||
          state.sourceLanguage !== prev.sourceLanguage ||
          state.detectedLanguage !== prev.detectedLanguage
        ) {
          save()
        }
      }),
      useTranslationStore.subscribe((state, prev) => {
        if (state.tracks !== prev.tracks || state.targetLanguage !== prev.targetLanguage) {
          save()
        }
      }),
      useExportStore.subscribe((state, prev) => {
        if (state.options !== prev.options) {
          save()
        }
      }),
      useSettingsStore.subscribe((state, prev) => {
        if (
          state.translationEngine !== prev.translationEngine ||
          state.transcriptionEngine !== prev.transcriptionEngine
        ) {
          save()
        }
      }),
    ]

    return () => {
      unsubs.forEach((unsub) => unsub())
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [backendReady])
}
