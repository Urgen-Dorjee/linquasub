import { useState, useEffect } from 'react'
import { X, Video, Languages, Download, Sparkles, Keyboard } from 'lucide-react'

const WELCOME_DISMISSED_KEY = 'linguasub_welcome_dismissed'

const features = [
  { icon: Video, title: 'Import Video', desc: 'Upload a video or paste a YouTube URL to get started' },
  { icon: Sparkles, title: 'AI Transcription', desc: 'Powered by Whisper and Google Gemini for accurate subtitles' },
  { icon: Languages, title: 'Multi-Language', desc: 'Translate subtitles into 50+ languages simultaneously' },
  { icon: Download, title: 'Export Anywhere', desc: 'Export SRT, VTT, ASS or burn subtitles directly into video' },
]

const shortcuts = [
  { keys: 'Space', action: 'Play / Pause' },
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'Ctrl+Y', action: 'Redo' },
  { keys: 'V / C / T', action: 'Select / Razor / Trim tool' },
  { keys: 'Del', action: 'Delete selected clip' },
]

export default function WelcomeDialog() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY)
    if (!dismissed) setShow(true)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              LS
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to LinguaSub</h2>
              <p className="text-xs text-slate-500">AI-powered video production suite</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                Generate, translate, and burn subtitles with AI precision.
              </p>
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Keyboard size={16} className="text-blue-400" />
                <p className="text-sm text-slate-300 font-medium">Keyboard Shortcuts</p>
              </div>
              {shortcuts.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-400">{action}</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-t border-slate-800">
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            {step < 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
