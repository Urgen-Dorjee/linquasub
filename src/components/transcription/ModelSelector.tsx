import { useEffect, useState } from 'react'
import { Cpu, Zap, Sparkles } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { GpuInfo, WhisperModelSize } from '../../types/project'
import api from '../../services/api'
import { clsx } from 'clsx'

interface ModelOption {
  name: WhisperModelSize
  vramMb: number
  quality: string
  speed: string
}

const MODELS: ModelOption[] = [
  { name: 'tiny', vramMb: 75, quality: 'Low', speed: 'Fastest' },
  { name: 'base', vramMb: 150, quality: 'Fair', speed: 'Fast' },
  { name: 'small', vramMb: 500, quality: 'Good', speed: 'Medium' },
  { name: 'medium', vramMb: 1500, quality: 'Great', speed: 'Slow' },
  { name: 'large', vramMb: 3000, quality: 'Best', speed: 'Slowest' },
]

const WHISPER_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ne', name: 'Nepali' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
]

const GEMINI_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ne', name: 'Nepali' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'ka', name: 'Georgian' },
  { code: 'am', name: 'Amharic' },
  { code: 'sw', name: 'Swahili' },
  { code: 'my', name: 'Burmese' },
  { code: 'km', name: 'Khmer' },
]

export default function ModelSelector() {
  const { selectedModel, setSelectedModel, sourceLanguage, setSourceLanguage } = useTranscriptionStore()
  const { transcriptionEngine, setTranscriptionEngine, geminiApiKey } = useSettingsStore()
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)

  useEffect(() => {
    api.gpuInfo().then(setGpuInfo).catch(() => {})
  }, [])

  const getModelStatus = (model: ModelOption) => {
    if (!gpuInfo?.cudaAvailable) return 'cpu'
    if (model.vramMb <= gpuInfo.vramTotalMb * 0.7) return 'gpu'
    if (model.vramMb <= gpuInfo.vramTotalMb) return 'tight'
    return 'cpu'
  }

  const isGemini = transcriptionEngine === 'gemini'
  const languages = isGemini ? GEMINI_LANGUAGES : WHISPER_LANGUAGES

  return (
    <div className="card space-y-4">
      {/* Engine selector */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">Transcription Engine</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTranscriptionEngine('whisper')}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              !isGemini
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900'
            )}
          >
            <div className="flex items-center gap-2">
              <Cpu size={16} className={!isGemini ? 'text-blue-400' : 'text-slate-400'} />
              <span className="font-medium text-sm text-white">Whisper AI</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Local, offline. Best for major languages.</p>
          </button>
          <button
            onClick={() => setTranscriptionEngine('gemini')}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              isGemini
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900'
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className={isGemini ? 'text-purple-400' : 'text-slate-400'} />
              <span className="font-medium text-sm text-white">Google Gemini</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Cloud AI. Best for Tibetan, rare languages.</p>
          </button>
        </div>
        {isGemini && !geminiApiKey && (
          <p className="text-xs text-amber-400 mt-2">
            Gemini API key required. Set it in Settings.
          </p>
        )}
      </div>

      {/* Whisper model cards - only show when Whisper is selected */}
      {!isGemini && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Whisper Model</h3>
            {gpuInfo && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Cpu size={14} />
                <span>
                  {gpuInfo.gpuName} ({gpuInfo.vramTotalMb}MB VRAM)
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {MODELS.map((model) => {
              const status = getModelStatus(model)
              const isSelected = selectedModel === model.name

              return (
                <button
                  key={model.name}
                  onClick={() => setSelectedModel(model.name)}
                  className={clsx(
                    'p-3 rounded-lg border text-left transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900'
                  )}
                >
                  <p className="font-medium text-sm text-white capitalize">{model.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{model.quality}</p>
                  <p className="text-xs text-slate-500">{model.speed}</p>
                  <div className="mt-2 flex items-center gap-1">
                    {status === 'gpu' ? (
                      <Zap size={10} className="text-green-400" />
                    ) : status === 'tight' ? (
                      <Zap size={10} className="text-yellow-400" />
                    ) : (
                      <Cpu size={10} className="text-slate-500" />
                    )}
                    <span
                      className={clsx(
                        'text-[10px]',
                        status === 'gpu' && 'text-green-400',
                        status === 'tight' && 'text-yellow-400',
                        status === 'cpu' && 'text-slate-500'
                      )}
                    >
                      {status === 'gpu' ? 'GPU' : status === 'tight' ? 'GPU (tight)' : 'CPU only'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Language selector */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Source Language</label>
        <select
          value={sourceLanguage}
          onChange={(e) => setSourceLanguage(e.target.value)}
          className="input-field w-48"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
