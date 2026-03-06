import InputPanel from '../components/input/InputPanel'
import ModelSelector from '../components/transcription/ModelSelector'
import TranscriptionControls from '../components/transcription/TranscriptionControls'
import { useProjectStore } from '../stores/projectStore'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { Loader2, CheckCircle2, Video } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HomePage() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const backendReady = useProjectStore((s) => s.backendReady)
  const backendError = useProjectStore((s) => s.backendError)
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)
  const transcriptionProgress = useTranscriptionStore((s) => s.progress)
  const statusMessage = useTranscriptionStore((s) => s.statusMessage)

  if (backendError) {
    return (
      <div className="w-full px-6 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <p className="text-red-400 font-medium">Backend failed to start</p>
          <p className="text-slate-500 text-sm max-w-md">{backendError}</p>
        </div>
      </div>
    )
  }

  if (!backendReady) {
    return (
      <div className="w-full px-6 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-400 mx-auto" size={32} />
          <p className="text-slate-400">Starting backend...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
        <p className="text-slate-400">
          Upload a video file or paste a YouTube URL to begin generating subtitles.
        </p>
      </div>

      <InputPanel />

      {videoPath && (
        <div className="space-y-4 animate-fade-in">
          <ModelSelector />
          <TranscriptionControls />
        </div>
      )}

      {/* Transcription progress */}
      {isTranscribing && (
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="animate-spin text-blue-400" size={16} />
            <span className="text-sm text-slate-300">
              {statusMessage || `Transcribing... ${Math.round(transcriptionProgress)}%`}
            </span>
          </div>
          {transcriptionProgress > 0 && (
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${transcriptionProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {segments.length > 0 && !isTranscribing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex items-start gap-3 border-green-500/20"
        >
          <CheckCircle2 className="text-green-400 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="text-green-400 font-medium">
              Transcription complete! {segments.length} segments detected.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Go to the Editor tab to review and edit subtitles.
            </p>
          </div>
        </motion.div>
      )}

      {!videoPath && (
        <div className="card border-dashed border-slate-700 flex items-center gap-4 text-slate-500">
          <Video size={24} />
          <div>
            <p className="text-sm">No video loaded</p>
            <p className="text-xs text-slate-600">Select a video file or enter a YouTube URL above to get started.</p>
          </div>
        </div>
      )}
    </div>
  )
}
