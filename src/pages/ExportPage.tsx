import { useTranscriptionStore } from '../stores/transcriptionStore'
import ExportPanel from '../components/export/ExportPanel'
import BackgroundPanel from '../components/export/BackgroundPanel'
import EffectsPanel from '../components/export/EffectsPanel'
import AudioMixPanel from '../components/export/AudioMixPanel'
import ColorGradePanel from '../components/export/ColorGradePanel'
import { Download, Loader2 } from 'lucide-react'

export default function ExportPage() {
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)

  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-400 mx-auto" size={32} />
          <p className="text-slate-400">Transcription in progress...</p>
          <p className="text-slate-500 text-sm">Export will be available once transcription completes.</p>
        </div>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Download className="text-slate-600 mx-auto" size={40} />
          <p className="text-slate-400 text-lg">No subtitles to export</p>
          <p className="text-slate-500 text-sm">
            Go to the Home tab to upload a video and transcribe it first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Export</h2>
        <p className="text-slate-400">
          Export your subtitles as files or burn them into the video.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ExportPanel />
          <AudioMixPanel />
        </div>
        <div className="space-y-6">
          <EffectsPanel />
          <ColorGradePanel />
          <BackgroundPanel />
        </div>
      </div>
    </div>
  )
}
