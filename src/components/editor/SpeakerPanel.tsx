import { useState } from 'react'
import { Users, Loader2 } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useProjectStore } from '../../stores/projectStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

const SPEAKER_COLORS = [
  'text-blue-400',
  'text-green-400',
  'text-amber-400',
  'text-purple-400',
  'text-pink-400',
  'text-cyan-400',
  'text-orange-400',
  'text-teal-400',
]

export default function SpeakerPanel() {
  const segments = useTranscriptionStore((s) => s.segments)
  const videoPath = useProjectStore((s) => s.videoPath)
  const [loading, setLoading] = useState(false)
  const [speakers, setSpeakers] = useState<string[]>([])
  const [speakerMap, setSpeakerMap] = useState<Map<string, string>>(new Map())
  const [numSpeakers, setNumSpeakers] = useState(0)

  const handleDiarize = async () => {
    if (!videoPath || segments.length === 0) return
    setLoading(true)

    try {
      const result = await api.diarize({
        video_path: videoPath,
        segments,
        num_speakers: numSpeakers || undefined,
      })

      const newMap = new Map<string, string>()
      for (const seg of result.segments) {
        const id = seg.id as string
        const speaker = seg.speaker as string
        newMap.set(id, speaker)
      }

      setSpeakerMap(newMap)
      setSpeakers(result.speakers)
      toast.success(`Identified ${result.speakers.length} speakers`)
    } catch {
      toast.error('Speaker detection failed. Check API keys or try again.')
    } finally {
      setLoading(false)
    }
  }

  const getSpeakerColor = (speaker: string): string => {
    const idx = speakers.indexOf(speaker)
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length]
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Users size={14} />
          Speaker Detection
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={10}
            value={numSpeakers}
            onChange={(e) => setNumSpeakers(parseInt(e.target.value) || 0)}
            className="input-field w-14 text-xs text-center"
            placeholder="Auto"
            title="Number of speakers (0 = auto)"
          />
          <button
            onClick={handleDiarize}
            disabled={loading || segments.length === 0}
            className="btn-secondary text-xs px-3 py-1 flex items-center gap-1"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
            {loading ? 'Detecting...' : 'Detect'}
          </button>
        </div>
      </div>

      {speakers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {speakers.map((speaker) => (
            <span
              key={speaker}
              className={`text-xs px-2 py-0.5 bg-slate-800 rounded ${getSpeakerColor(speaker)}`}
            >
              {speaker}
            </span>
          ))}
        </div>
      )}

      {speakerMap.size > 0 && (
        <div className="max-h-[160px] overflow-y-auto space-y-1">
          {segments.slice(0, 20).map((seg) => {
            const speaker = speakerMap.get(seg.id)
            if (!speaker) return null
            return (
              <div key={seg.id} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 font-medium ${getSpeakerColor(speaker)}`}>
                  {speaker}:
                </span>
                <span className="text-slate-400 truncate">{seg.text}</span>
              </div>
            )
          })}
          {segments.length > 20 && (
            <p className="text-[10px] text-slate-600">...and {segments.length - 20} more segments</p>
          )}
        </div>
      )}

      {speakers.length === 0 && !loading && (
        <p className="text-xs text-slate-600">
          Identify who speaks in each segment. Works best with conversations/interviews.
        </p>
      )}
    </div>
  )
}
