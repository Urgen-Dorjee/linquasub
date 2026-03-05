import { memo } from 'react'
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from 'lucide-react'
import { useTimelineStore } from '../../stores/timelineStore'
import TimelineClipComponent from './TimelineClip'
import type { TimelineTrack as TrackType } from '../../types/timeline'

interface TimelineTrackProps {
  track: TrackType
}

function TimelineTrackComponent({ track }: TimelineTrackProps) {
  const updateTrack = useTimelineStore((s) => s.updateTrack)
  const setSelection = useTimelineStore((s) => s.setSelection)
  const setPlayhead = useTimelineStore((s) => s.setPlayhead)
  const zoom = useTimelineStore((s) => s.zoom)
  const scrollX = useTimelineStore((s) => s.scrollX)

  const iconSize = 12

  const handleTrackClick = (e: React.MouseEvent) => {
    // Click on empty track area: set playhead, clear clip selection
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = (x + scrollX) / zoom
    setPlayhead(Math.max(0, time))
    setSelection({ clipIds: [], trackId: track.id })
  }

  return (
    <div className="flex border-b border-slate-800">
      {/* Track header */}
      <div className="w-[120px] shrink-0 bg-slate-900 border-r border-slate-800 p-1.5 flex flex-col justify-center gap-1">
        <span className="text-[10px] text-slate-300 font-medium truncate">{track.label}</span>
        <div className="flex gap-1">
          <button
            onClick={() => updateTrack(track.id, { visible: !track.visible })}
            className={`p-0.5 rounded ${track.visible ? 'text-slate-400' : 'text-slate-600'}`}
            title={track.visible ? 'Hide' : 'Show'}
          >
            {track.visible ? <Eye size={iconSize} /> : <EyeOff size={iconSize} />}
          </button>
          <button
            onClick={() => updateTrack(track.id, { locked: !track.locked })}
            className={`p-0.5 rounded ${track.locked ? 'text-amber-400' : 'text-slate-400'}`}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            {track.locked ? <Lock size={iconSize} /> : <Unlock size={iconSize} />}
          </button>
          {track.type === 'audio' && (
            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className={`p-0.5 rounded ${track.muted ? 'text-red-400' : 'text-slate-400'}`}
              title={track.muted ? 'Unmute' : 'Mute'}
            >
              {track.muted ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
            </button>
          )}
        </div>
      </div>

      {/* Track content */}
      <div
        className="flex-1 relative bg-slate-950/50"
        style={{ height: track.height }}
        onClick={handleTrackClick}
      >
        {track.clips.map((clip) => (
          <TimelineClipComponent key={clip.id} clip={clip} track={track} />
        ))}
      </div>
    </div>
  )
}

export default memo(TimelineTrackComponent)
