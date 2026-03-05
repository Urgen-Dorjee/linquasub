import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useTranslationStore } from '../stores/translationStore'
import { useSettingsStore } from '../stores/settingsStore'
import api from './api'
import toast from 'react-hot-toast'

interface TranslationResponse {
  id: string
  original_text: string
  translated_text: string
}

function mapTranslations(raw: TranslationResponse[]) {
  return raw.map((t) => ({
    id: t.id,
    originalText: t.original_text,
    translatedText: t.translated_text,
  }))
}

export async function autoStartTranscription(videoPath: string) {
  const transcription = useTranscriptionStore.getState()
  const settings = useSettingsStore.getState()
  const translation = useTranslationStore.getState()

  if (transcription.isTranscribing) return

  const isGemini = settings.transcriptionEngine === 'gemini'
  const targetLang = translation.targetLanguage

  transcription.setIsTranscribing(true)
  transcription.setProgress(0)
  transcription.setSegments([])

  try {
    const result = await api.transcribe({
      video_path: videoPath,
      model: transcription.selectedModel,
      language: transcription.sourceLanguage,
      engine: settings.transcriptionEngine,
      ...(isGemini && targetLang ? { target_lang: targetLang } : {}),
    })
    transcription.setTaskId(result.task_id)
    toast.success('Transcription started automatically!')

    pollTranscriptionResult(result.task_id)
  } catch {
    toast.error('Auto-transcription failed. You can start it manually.')
    transcription.setIsTranscribing(false)
  }
}

export function pollTranscriptionResult(taskId: string) {
  const poll = setInterval(async () => {
    const transcription = useTranscriptionStore.getState()
    try {
      const data = await api.getTranscriptionResult(taskId)
      if (data.segments) {
        transcription.setSegments(data.segments)
        transcription.setDetectedLanguage(data.detected_language)

        if (data.translations) {
          useTranslationStore.getState().setTranslations(
            mapTranslations(data.translations)
          )
        }

        transcription.setIsTranscribing(false)
        transcription.setProgress(100)
        transcription.setStatusMessage(null)
        clearInterval(poll)

        const msg = data.translations
          ? `Transcription & translation complete! ${data.segments.length} segments.`
          : `Transcription complete! ${data.segments.length} segments detected.`
        toast.success(msg)
      } else if (data.progress > 0 && data.progress >= transcription.progress) {
        transcription.setProgress(data.progress)
      }
    } catch {
      // Still processing
    }
  }, 2000)

  return poll
}
