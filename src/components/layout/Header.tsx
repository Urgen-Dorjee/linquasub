import { useProjectStore } from '../../stores/projectStore'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { Film } from 'lucide-react'

export default function Header() {
  const backendReady = useProjectStore((s) => s.backendReady)
  const backendError = useProjectStore((s) => s.backendError)
  const videoPath = useProjectStore((s) => s.videoPath)
  const segmentCount = useTranscriptionStore((s) => s.segments.length)

  const fileName = videoPath ? videoPath.split(/[\\/]/).pop() : null

  return (
    <header className="h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center px-5 justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-semibold text-white shrink-0">LinguaSub</h1>
        {fileName && (
          <>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <Film size={13} className="text-slate-500 shrink-0" />
              <span className="text-sm text-slate-400 truncate">{fileName}</span>
            </div>
          </>
        )}
        {segmentCount > 0 && (
          <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
            {segmentCount} segments
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              backendError ? 'bg-red-500' : backendReady ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'
            }`}
          />
          <span className="text-[11px] text-slate-500">
            {backendError ? 'Error' : backendReady ? 'Ready' : 'Starting...'}
          </span>
        </div>
      </div>
    </header>
  )
}
