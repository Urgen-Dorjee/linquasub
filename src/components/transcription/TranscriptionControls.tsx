import { Loader2, Play, Check, X, Download } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTranslationStore } from '../../stores/translationStore'
import api from '../../services/api'
import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'

export default function TranscriptionControls() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const transcriptionEngine = useSettingsStore((s) => s.transcriptionEngine)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const geminiModel = useSettingsStore((s) => s.geminiModel)
  const deeplApiKey = useSettingsStore((s) => s.deeplApiKey)
  const {
    isTranscribing,
    progress,
    statusMessage,
    selectedModel,
    sourceLanguage,
    segments,
    taskId,
    setIsTranscribing,
    setTaskId,
    setSegments,
    setDetectedLanguage,
    setProgress,
    setStatusMessage,
  } = useTranscriptionStore()

  const targetLanguage = useTranslationStore((s) => s.targetLanguage)

  const isDownloadingModel = statusMessage?.includes('Downloading') ?? false
  const isGemini = transcriptionEngine === 'gemini'

  const handleTranscribe = async () => {
    if (!videoPath) return

    if (isGemini && !geminiApiKey) {
      toast.error('Gemini API key required. Set it in Settings.')
      return
    }

    setIsTranscribing(true)
    setProgress(0)
    setStatusMessage(null)

    try {
      // Sync API keys and model to backend before starting (ensures backend has current settings)
      await api.updateSettings({
        gemini_api_key: geminiApiKey,
        deepl_api_key: deeplApiKey,
        gemini_model: geminiModel,
      })

      const result = await api.transcribe({
        video_path: videoPath,
        model: selectedModel,
        language: sourceLanguage,
        engine: transcriptionEngine,
        ...(isGemini && targetLanguage ? { target_lang: targetLanguage } : {}),
      })

      setTaskId(result.task_id)

      let errorCount = 0

      // Poll for progress and completion
      const poll = setInterval(async () => {
        try {
          const data = await api.getTranscriptionResult(result.task_id)
          errorCount = 0 // Reset on success
          if (data.segments) {
            setSegments(data.segments)
            setDetectedLanguage(data.detected_language)
            // Handle combined transcription + translation result
            if (data.translations) {
              useTranslationStore.getState().setTranslations(
                data.translations.map((t: { id: string; original_text: string; translated_text: string }) => ({
                  id: t.id,
                  originalText: t.original_text,
                  translatedText: t.translated_text,
                }))
              )
            }
            setIsTranscribing(false)
            setProgress(100)
            setStatusMessage(null)
            clearInterval(poll)
            const msg = data.translations
              ? `Transcription & translation complete! ${data.segments.length} segments.`
              : `Transcription complete! ${data.segments.length} segments detected.`
            toast.success(msg)
          } else if (data.progress > 0 && data.progress >= useTranscriptionStore.getState().progress) {
            setProgress(data.progress)
          }
        } catch (err) {
          const axiosErr = err as AxiosError<{ detail?: string }>
          if (axiosErr?.response?.status === 500) {
            // Task failed with an error
            const errorMsg = axiosErr.response?.data?.detail || 'Transcription failed'
            clearInterval(poll)
            setIsTranscribing(false)
            setProgress(0)
            setStatusMessage(null)
            setTaskId(null)
            toast.error(errorMsg, { duration: 8000 })
          } else {
            // Network error or backend not ready yet - tolerate a few
            errorCount++
            if (errorCount > 15) {
              clearInterval(poll)
              setIsTranscribing(false)
              setProgress(0)
              setStatusMessage(null)
              setTaskId(null)
              toast.error('Lost connection to backend.')
            }
          }
        }
      }, 2000)
    } catch (err) {
      toast.error('Transcription failed. Check that the Python backend is running.')
      setIsTranscribing(false)
      setStatusMessage(null)
    }
  }

  const handleCancel = async () => {
    if (!taskId) {
      // No task to cancel, just reset UI
      setIsTranscribing(false)
      setProgress(0)
      setStatusMessage(null)
      return
    }
    try {
      await api.cancelTask(taskId)
    } catch {
      // Cancel might fail if task already finished, that's OK
    }
    setIsTranscribing(false)
    setProgress(0)
    setStatusMessage(null)
    setTaskId(null)
    toast('Transcription cancelled')
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transcription</h3>
        {segments.length > 0 && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check size={16} />
            <span>{segments.length} segments</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleTranscribe}
          disabled={isTranscribing || !videoPath}
          className="btn-primary flex items-center gap-2"
        >
          {isTranscribing ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              {isDownloadingModel
                ? 'Downloading model...'
                : `Transcribing... ${progress > 0 ? `${Math.round(progress)}%` : ''}`
              }
            </>
          ) : segments.length > 0 ? (
            <>
              <Play size={16} />
              Re-transcribe
            </>
          ) : (
            <>
              <Play size={16} />
              Start Transcription
            </>
          )}
        </button>

        {isTranscribing && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors text-sm font-medium"
          >
            <X size={16} />
            Cancel
          </button>
        )}
      </div>

      {isTranscribing && statusMessage && (
        <p className="text-xs text-slate-400">
          {isDownloadingModel && <Download size={12} className="inline mr-1" />}
          {statusMessage}
        </p>
      )}

      {isTranscribing && progress > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
