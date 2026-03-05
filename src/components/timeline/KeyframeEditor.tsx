import { useTimelineStore } from '../../stores/timelineStore'
import { useKeyframeStore } from '../../stores/keyframeStore'
import type { ClipTransform, KeyframeEasing } from '../../types/timeline'
import { Diamond, Plus, Trash2 } from 'lucide-react'

const PROPERTIES: { key: keyof ClipTransform; label: string; color: string }[] = [
  { key: 'x', label: 'Position X', color: 'text-red-400' },
  { key: 'y', label: 'Position Y', color: 'text-green-400' },
  { key: 'scaleX', label: 'Scale X', color: 'text-blue-400' },
  { key: 'scaleY', label: 'Scale Y', color: 'text-blue-300' },
  { key: 'opacity', label: 'Opacity', color: 'text-purple-400' },
  { key: 'rotation', label: 'Rotation', color: 'text-cyan-400' },
]

const EASINGS: KeyframeEasing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bezier']

export default function KeyframeEditor() {
  const tracks = useTimelineStore((s) => s.tracks)
  const selection = useTimelineStore((s) => s.selection)
  const playhead = useTimelineStore((s) => s.playhead)
  const addKeyframe = useKeyframeStore((s) => s.addKeyframe)
  const removeKeyframe = useKeyframeStore((s) => s.removeKeyframe)
  const updateKeyframe = useKeyframeStore((s) => s.updateKeyframe)

  if (selection.clipIds.length !== 1 || !selection.trackId) {
    return null
  }

  const track = tracks.find((t) => t.id === selection.trackId)
  if (!track) return null
  const clip = track.clips.find((c) => c.id === selection.clipIds[0])
  if (!clip || clip.keyframes.length === 0 && track.type !== 'video') return null

  const trackId = selection.trackId
  const clipId = clip.id

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1">
          <Diamond size={12} /> Keyframes
        </h4>
      </div>

      {PROPERTIES.map(({ key, label, color }) => {
        const propKfs = clip.keyframes.filter((kf) => kf.property === key)

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] ${color}`}>{label}</span>
              <button
                onClick={() => addKeyframe(trackId, clipId, playhead, key, clip.transform[key])}
                className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-800"
                title={`Add keyframe at playhead for ${label}`}
              >
                <Plus size={10} />
              </button>
            </div>
            {propKfs.length > 0 && (
              <div className="space-y-0.5 pl-2">
                {propKfs.map((kf) => (
                  <div key={kf.id} className="flex items-center gap-1 text-[9px]">
                    <Diamond size={8} className={color} />
                    <span className="text-slate-400 w-12">{kf.time.toFixed(2)}s</span>
                    <input
                      type="number"
                      value={kf.value}
                      step={key === 'opacity' ? 0.05 : key.startsWith('scale') ? 0.1 : 1}
                      onChange={(e) => updateKeyframe(trackId, clipId, kf.id, { value: parseFloat(e.target.value) || 0 })}
                      className="w-14 bg-slate-800 border border-slate-700 rounded px-1 py-0 text-[9px] text-white"
                    />
                    <select
                      value={kf.easing}
                      onChange={(e) => updateKeyframe(trackId, clipId, kf.id, { easing: e.target.value as KeyframeEasing })}
                      className="bg-slate-800 border border-slate-700 rounded px-0.5 py-0 text-[9px] text-slate-300"
                    >
                      {EASINGS.map((ea) => (
                        <option key={ea} value={ea}>{ea}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeKeyframe(trackId, clipId, kf.id)}
                      className="p-0.5 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
