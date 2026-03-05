import { useEffect, useRef } from 'react'
import { Languages, Loader2, X } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslationStore, selectActiveTranslations } from '../../stores/translationStore'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useProjectStore } from '../../stores/projectStore'
import { getLanguagesForEngine, getDefaultLanguageForEngine } from '../../constants/languages'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function TranslationPanel() {
  const segments = useTranscriptionStore((s) => s.segments)
  const detectedLanguage = useTranscriptionStore((s) => s.detectedLanguage)
  const {
    targetLanguage,
    setTargetLanguage,
    isTranslating,
    progress,
    tracks,
    activeTrack,
    setActiveTrack,
    removeTrack,
    setIsTranslating,
    setTaskId,
    setTranslations,
    setProgress,
    deeplUsage,
  } = useTranslationStore()
  const activeTranslations = useTranslationStore(selectActiveTranslations)

  const deeplApiKey = useSettingsStore((s) => s.deeplApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const translationEngine = useSettingsStore((s) => s.translationEngine)
  const backendReady = useProjectStore((s) => s.backendReady)

  const isGemini = translationEngine === 'gemini'
  const languages = getLanguagesForEngine(translationEngine)
  const hasApiKey = isGemini ? !!geminiApiKey : !!deeplApiKey
  const trackLanguages = Array.from(tracks.keys())

  const listRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  useEffect(() => {
    const validCodes = languages.map((l) => l.code)
    if (!validCodes.includes(targetLanguage)) {
      setTargetLanguage(getDefaultLanguageForEngine(translationEngine))
    }
  }, [translationEngine])

  useEffect(() => {
    if (!backendReady) return
    api.updateSettings({
      deepl_api_key: deeplApiKey,
      gemini_api_key: geminiApiKey,
    }).catch(() => {})
  }, [deeplApiKey, geminiApiKey, backendReady])

  const handleTranslate = async () => {
    if (segments.length === 0 || !hasApiKey) {
      if (!hasApiKey) {
        toast.error(`Please set your ${isGemini ? 'Gemini' : 'DeepL'} API key in Settings`)
      }
      return
    }

    setIsTranslating(true)
    setProgress(0)

    try {
      const result = await api.translate({
        segments: segments.map((s) => ({ id: s.id, text: s.text })),
        source_lang: detectedLanguage?.toUpperCase() || 'auto',
        target_lang: targetLanguage,
        engine: translationEngine,
      })

      setTaskId(result.task_id)

      const poll = setInterval(async () => {
        try {
          const data = await api.getTranslationResult(result.task_id)
          if (data.translations) {
            setTranslations(
              data.translations.map((t: { id: string; original_text: string; translated_text: string }) => ({
                id: t.id,
                originalText: t.original_text,
                translatedText: t.translated_text,
              })),
              targetLanguage
            )
            setIsTranslating(false)
            setProgress(100)
            clearInterval(poll)
            toast.success(`Translation to ${targetLanguage} complete!`)
          } else if (data.progress > 0) {
            setProgress(data.progress)
          }
        } catch {
          // Still processing
        }
      }, 2000)
    } catch {
      toast.error('Translation failed')
      setIsTranslating(false)
    }
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Translation</h3>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
          {isGemini ? 'Gemini' : 'DeepL'}
        </span>
      </div>

      {/* Language track tabs */}
      {trackLanguages.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {trackLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveTrack(lang)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                activeTrack === lang
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang}
              <X
                size={10}
                className="opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTrack(lang)
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Target Language</label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="input-field w-full text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTranslate}
          disabled={isTranslating || segments.length === 0 || !hasApiKey}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          {isTranslating ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Translating... {progress > 0 ? `${Math.round(progress)}%` : ''}
            </>
          ) : (
            <>
              <Languages size={14} />
              {trackLanguages.includes(targetLanguage) ? 'Re-translate' : 'Translate'} to {targetLanguage}
            </>
          )}
        </button>

        {!hasApiKey && (
          <p className="text-xs text-amber-400">
            Set your {isGemini ? 'Gemini' : 'DeepL'} API key in Settings to enable translation.
          </p>
        )}

        {isTranslating && progress > 0 && (
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {!isGemini && (
          <div className="text-xs text-slate-500">
            <div className="flex justify-between mb-1">
              <span>DeepL Usage</span>
              <span>
                {(deeplUsage.used / 1000).toFixed(0)}k / {(deeplUsage.limit / 1000).toFixed(0)}k chars
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full"
                style={{ width: `${(deeplUsage.used / deeplUsage.limit) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Virtualized translated segments preview */}
      <div ref={listRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const seg = segments[virtualRow.index]
            const translation = activeTranslations?.get(seg.id)
            return (
              <div
                key={seg.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="p-2 bg-slate-900 rounded text-xs space-y-1 mr-1">
                  <p className="text-slate-400 truncate">{seg.text}</p>
                  {translation && (
                    <p className="text-blue-300 truncate">{translation.translatedText}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
