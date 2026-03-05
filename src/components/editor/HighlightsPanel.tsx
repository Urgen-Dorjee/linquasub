import { useState } from 'react'
import { Sparkles, Loader2, Play, Download } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useProjectStore } from '../../stores/projectStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface Highlight {
  start: number
  end: number
  title: string
  reason: string
  score: number
}

interface HighlightsPanelProps {
  onSeek: (time: number) => void
}

export default function HighlightsPanel({ onSeek }: HighlightsPanelProps) {
  const segments = useTranscriptionStore((s) => s.segments)
  const videoPath = useProjectStore((s) => s.videoPath)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(false)

  const handleDetect = async () => {
    if (segments.length === 0) return
    setLoading(true)

    try {
      const result = await api.detectHighlights({ segments })
      setHighlights(result.highlights)
      if (result.count === 0) {
        toast('No highlights detected', { icon: 'i' })
      } else {
        toast.success(`Found ${result.count} highlights`)
      }
    } catch {
      toast.error('Highlight detection failed. Check Gemini API key.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportClip = async (highlight: Highlight) => {
    if (!window.electronAPI || !videoPath) return
    const safe = highlight.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
    const outputPath = await window.electronAPI.saveFile(`highlight_${safe}.mp4`)
    if (!outputPath) return

    try {
      await api.trimVideo({
        video_path: videoPath,
        start: highlight.start,
        end: highlight.end,
        output_path: outputPath,
      })
      toast.success(`Exporting: ${highlight.title}`)
    } catch {
      toast.error('Failed to export clip')
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Sparkles size={14} />
          AI Highlights
        </h3>
        <button
          onClick={handleDetect}
          disabled={loading || segments.length === 0}
          className="btn-secondary text-xs px-3 py-1 flex items-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Analyzing...' : 'Detect'}
        </button>
      </div>

      {highlights.length === 0 && !loading && (
        <p className="text-xs text-slate-600">
          Click Detect to find the best moments for social media clips.
        </p>
      )}

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {highlights.map((h, i) => (
          <div
            key={i}
            className="bg-slate-900 rounded p-2 space-y-1 hover:bg-slate-800/80 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white truncate flex-1">{h.title}</span>
              <span className="text-[10px] text-amber-400 ml-2">{Math.round(h.score * 100)}%</span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">{h.reason}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">
                {formatTime(h.start)} - {formatTime(h.end)} ({Math.round(h.end - h.start)}s)
              </span>
              <button
                onClick={() => onSeek(h.start)}
                className="text-blue-400 hover:text-blue-300"
                title="Preview"
              >
                <Play size={10} />
              </button>
              <button
                onClick={() => handleExportClip(h)}
                className="text-green-400 hover:text-green-300"
                title="Export clip"
              >
                <Download size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
