import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import api from '../services/api'
import PluginManager from '../components/settings/PluginManager'
import { getErrorLog, clearErrorLog } from '../services/errorLogger'

export default function SettingsPage() {
  const {
    deeplApiKey,
    setDeeplApiKey,
    geminiApiKey,
    setGeminiApiKey,
    geminiModel,
    setGeminiModel,
    translationEngine,
    setTranslationEngine,
    preferGpu,
    setPreferGpu,
    settingsLoaded,
    setSettingsLoaded,
  } = useSettingsStore()

  const isInitialLoad = useRef(true)

  // Load persisted settings from backend on first mount
  useEffect(() => {
    api.getSettings().then((data) => {
      if (data.gemini_api_key) {
        setGeminiApiKey(data.gemini_api_key)
      }
      if (data.deepl_api_key) {
        setDeeplApiKey(data.deepl_api_key)
      }
      if (data.gemini_model) {
        setGeminiModel(data.gemini_model)
      }
      setSettingsLoaded(true)
      isInitialLoad.current = false
    }).catch(() => {
      setSettingsLoaded(true)
      isInitialLoad.current = false
    })
  }, [])

  // Sync API keys to backend whenever they change (but not on initial load)
  useEffect(() => {
    if (!settingsLoaded) return
    const timeout = setTimeout(() => {
      api.updateSettings({
        deepl_api_key: deeplApiKey,
        gemini_api_key: geminiApiKey,
        gemini_model: geminiModel,
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(timeout)
  }, [deeplApiKey, geminiApiKey, geminiModel, settingsLoaded])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
        <p className="text-slate-400">Configure your LinguaSub preferences.</p>
      </div>

      {/* API Keys */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-white">API Keys</h3>

        {/* Gemini API Key */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Gemini API Key</label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="Enter your Gemini API key..."
            className="input-field w-full"
          />
          <p className="text-xs text-slate-500 mt-1">
            Used for both transcription (Gemini engine) and translation.{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Get your API key
            </a>
          </p>
        </div>

        {/* Gemini Model Selection */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Gemini Model</label>
          <select
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            className="input-field w-full"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
            <option value="gemini-3-flash">Gemini 3 Flash</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Check your free tier limits at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              AI Studio
            </a>
            . Some models may have 0 quota on the free tier.
          </p>
        </div>

        {/* DeepL API Key */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">DeepL API Key</label>
          <input
            type="password"
            value={deeplApiKey}
            onChange={(e) => setDeeplApiKey(e.target.value)}
            placeholder="Enter your DeepL API key..."
            className="input-field w-full"
          />
          <p className="text-xs text-slate-500 mt-1">
            Only needed if using DeepL for translation. Free tier: 500,000 characters/month.{' '}
            <a
              href="https://www.deepl.com/pro-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Get your API key
            </a>
          </p>
        </div>
      </div>

      {/* Translation Engine */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-white">Translation</h3>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Translation Engine</label>
          <select
            value={translationEngine}
            onChange={(e) => setTranslationEngine(e.target.value as 'gemini' | 'deepl')}
            className="input-field w-full"
          >
            <option value="gemini">Google Gemini (Recommended)</option>
            <option value="deepl">DeepL</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Gemini supports more languages including Tibetan, Hindi, Nepali, and many others.
          </p>
        </div>
      </div>

      {/* GPU Settings */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-white">Performance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Prefer GPU for Whisper transcription</p>
            <p className="text-xs text-slate-500">
              Uses NVIDIA GPU when available. Falls back to CPU for large models.
            </p>
          </div>
          <button
            onClick={() => setPreferGpu(!preferGpu)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferGpu ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferGpu ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Plugins */}
      <PluginManager />

      {/* Error Log */}
      <ErrorLogSection />
    </div>
  )
}

function ErrorLogSection() {
  const [log, setLog] = useState(() => getErrorLog())
  const [expanded, setExpanded] = useState(false)

  if (log.length === 0 && !expanded) {
    return null
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Error Log</h3>
        <div className="flex gap-2">
          {log.length > 0 && (
            <>
              <button
                onClick={() => {
                  const text = log.map((e) => `[${e.timestamp}] ${e.context || 'error'}: ${e.message}\n${e.stack || ''}`).join('\n---\n')
                  navigator.clipboard.writeText(text)
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Copy to clipboard
              </button>
              <button
                onClick={() => { clearErrorLog(); setLog([]) }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            {expanded ? 'Hide' : `Show (${log.length})`}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="max-h-48 overflow-auto space-y-2">
          {log.length === 0 ? (
            <p className="text-xs text-slate-500">No errors recorded.</p>
          ) : (
            log.slice().reverse().map((entry, i) => (
              <div key={i} className="text-xs bg-slate-800 rounded p-2">
                <div className="flex justify-between text-slate-500">
                  <span>{entry.context || 'error'}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-red-400 mt-1">{entry.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
