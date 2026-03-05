import { useTimelineStore } from '../../stores/timelineStore'
import type { TimelineClip, TimelineTrack, BlendMode } from '../../types/timeline'
import { Gauge, RotateCcw, Volume2, Eye, Copy, Trash2, Layers } from 'lucide-react'

export default function ClipInspector() {
  const tracks = useTimelineStore((s) => s.tracks)
  const selection = useTimelineStore((s) => s.selection)
  const setClipSpeed = useTimelineStore((s) => s.setClipSpeed)
  const setClipReverse = useTimelineStore((s) => s.setClipReverse)
  const setClipVolume = useTimelineStore((s) => s.setClipVolume)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const duplicateClip = useTimelineStore((s) => s.duplicateClip)
  const removeClip = useTimelineStore((s) => s.removeClip)
  const setTrackBlendMode = useTimelineStore((s) => s.setTrackBlendMode)

  const selectedClip = findSelectedClip(tracks, selection)
  const selectedTrack = selection.trackId ? tracks.find((t) => t.id === selection.trackId) : null

  if (!selectedClip || !selection.trackId) {
    return (
      <div className="p-3 text-center text-slate-500 text-xs">
        Select a clip to inspect
      </div>
    )
  }

  const trackId = selection.trackId

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Clip Inspector</h3>

      {/* Clip name */}
      <div>
        <label className="text-[10px] text-slate-400 block mb-1">Label</label>
        <input
          type="text"
          value={selectedClip.label || ''}
          onChange={(e) => updateClip(trackId, selectedClip.id, { label: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
        />
      </div>

      {/* Speed */}
      <div>
        <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
          <Gauge size={10} /> Speed
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.1}
            max={4}
            step={0.1}
            value={selectedClip.speed}
            onChange={(e) => setClipSpeed(trackId, selectedClip.id, parseFloat(e.target.value))}
            className="flex-1 h-1 accent-blue-500"
          />
          <span className="text-[10px] text-slate-300 w-8 text-right">{selectedClip.speed}x</span>
        </div>
        <div className="flex gap-1 mt-1">
          {[0.25, 0.5, 1, 1.5, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setClipSpeed(trackId, selectedClip.id, s)}
              className={`text-[9px] px-1.5 py-0.5 rounded ${
                selectedClip.speed === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Reverse */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-slate-400 flex items-center gap-1">
          <RotateCcw size={10} /> Reverse
        </label>
        <button
          onClick={() => setClipReverse(trackId, selectedClip.id, !selectedClip.reverse)}
          className={`text-[10px] px-2 py-0.5 rounded ${
            selectedClip.reverse ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {selectedClip.reverse ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Volume */}
      <div>
        <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
          <Volume2 size={10} /> Volume
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={selectedClip.volume}
            onChange={(e) => setClipVolume(trackId, selectedClip.id, parseFloat(e.target.value))}
            className="flex-1 h-1 accent-green-500"
          />
          <span className="text-[10px] text-slate-300 w-10 text-right">{Math.round(selectedClip.volume * 100)}%</span>
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
          <Eye size={10} /> Opacity
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={selectedClip.transform.opacity}
            onChange={(e) => updateClip(trackId, selectedClip.id, {
              transform: { ...selectedClip.transform, opacity: parseFloat(e.target.value) },
            })}
            className="flex-1 h-1 accent-purple-500"
          />
          <span className="text-[10px] text-slate-300 w-10 text-right">{Math.round(selectedClip.transform.opacity * 100)}%</span>
        </div>
      </div>

      {/* Position & Scale */}
      <div>
        <label className="text-[10px] text-slate-400 block mb-1">Position & Scale</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <span className="text-[9px] text-slate-500">X</span>
            <input
              type="number"
              value={selectedClip.transform.x}
              onChange={(e) => updateClip(trackId, selectedClip.id, {
                transform: { ...selectedClip.transform, x: parseFloat(e.target.value) || 0 },
              })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-500">Y</span>
            <input
              type="number"
              value={selectedClip.transform.y}
              onChange={(e) => updateClip(trackId, selectedClip.id, {
                transform: { ...selectedClip.transform, y: parseFloat(e.target.value) || 0 },
              })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-500">Scale X</span>
            <input
              type="number"
              value={selectedClip.transform.scaleX}
              step={0.1}
              min={0.1}
              max={5}
              onChange={(e) => updateClip(trackId, selectedClip.id, {
                transform: { ...selectedClip.transform, scaleX: parseFloat(e.target.value) || 1 },
              })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-500">Scale Y</span>
            <input
              type="number"
              value={selectedClip.transform.scaleY}
              step={0.1}
              min={0.1}
              max={5}
              onChange={(e) => updateClip(trackId, selectedClip.id, {
                transform: { ...selectedClip.transform, scaleY: parseFloat(e.target.value) || 1 },
              })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
            />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="text-[10px] text-slate-400 block mb-1">Rotation</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={selectedClip.transform.rotation}
            onChange={(e) => updateClip(trackId, selectedClip.id, {
              transform: { ...selectedClip.transform, rotation: parseFloat(e.target.value) },
            })}
            className="flex-1 h-1 accent-cyan-500"
          />
          <span className="text-[10px] text-slate-300 w-10 text-right">{selectedClip.transform.rotation}°</span>
        </div>
      </div>

      {/* Track blend mode */}
      {selectedTrack && selectedTrack.type === 'video' && (
        <div>
          <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
            <Layers size={10} /> Blend Mode
          </label>
          <select
            value={selectedTrack.blendMode}
            onChange={(e) => setTrackBlendMode(selectedTrack.id, e.target.value as BlendMode)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="add">Add</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t border-slate-800">
        <button
          onClick={() => duplicateClip(trackId, selectedClip.id)}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
        >
          <Copy size={10} /> Duplicate
        </button>
        <button
          onClick={() => removeClip(trackId, selectedClip.id)}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-red-900/50 text-red-300 hover:bg-red-800/50 text-[10px]"
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  )
}

function findSelectedClip(tracks: TimelineTrack[], selection: { clipIds: string[]; trackId: string | null }): TimelineClip | null {
  if (selection.clipIds.length !== 1 || !selection.trackId) return null
  const track = tracks.find((t) => t.id === selection.trackId)
  if (!track) return null
  return track.clips.find((c) => c.id === selection.clipIds[0]) || null
}
