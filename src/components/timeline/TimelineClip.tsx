import { useState, useCallback, memo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import type { TimelineClip as ClipType, TimelineTrack } from '../../types/timeline'

interface TimelineClipProps {
  clip: ClipType
  track: TimelineTrack
}

function TimelineClipComponent({ clip, track }: TimelineClipProps) {
  const zoom = useTimelineStore((s) => s.zoom)
  const scrollX = useTimelineStore((s) => s.scrollX)
  const selection = useTimelineStore((s) => s.selection)
  const activeTool = useTimelineStore((s) => s.activeTool)
  const setSelection = useTimelineStore((s) => s.setSelection)
  const splitClip = useTimelineStore((s) => s.splitClip)
  const moveClip = useTimelineStore((s) => s.moveClip)
  const trimClipStart = useTimelineStore((s) => s.trimClipStart)
  const trimClipEnd = useTimelineStore((s) => s.trimClipEnd)

  const pushHistory = useTimelineStore((s) => s._pushHistory)
  const [isDragging, setIsDragging] = useState(false)
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null)

  const left = clip.timelineStart * zoom - scrollX
  const width = clip.duration * zoom
  const isSelected = selection.clipIds.includes(clip.id)

  const colorMap: Record<string, string> = {
    video: 'bg-blue-700/80 border-blue-500',
    audio: 'bg-green-700/80 border-green-500',
    subtitle: 'bg-purple-700/80 border-purple-500',
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (activeTool === 'razor') {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const splitTime = clip.timelineStart + clickX / zoom
      splitClip(track.id, clip.id, splitTime)
      return
    }

    const clipIds = e.ctrlKey || e.metaKey
      ? isSelected
        ? selection.clipIds.filter((id) => id !== clip.id)
        : [...selection.clipIds, clip.id]
      : [clip.id]

    setSelection({ clipIds, trackId: track.id })
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'select' || track.locked) return
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startTimelinePos = clip.timelineStart

    pushHistory()
    setIsDragging(true)

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const dt = dx / zoom
      moveClip(track.id, track.id, clip.id, startTimelinePos + dt)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [activeTool, track.id, track.locked, clip.id, clip.timelineStart, zoom, moveClip, pushHistory])

  const handleTrimStart = useCallback((e: React.MouseEvent, edge: 'start' | 'end') => {
    if (track.locked) return
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const originalStart = clip.timelineStart
    const originalEnd = clip.timelineStart + clip.duration

    pushHistory()
    setIsTrimming(edge)

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const dt = dx / zoom

      if (edge === 'start') {
        trimClipStart(track.id, clip.id, originalStart + dt)
      } else {
        trimClipEnd(track.id, clip.id, originalEnd + dt)
      }
    }

    const onMouseUp = () => {
      setIsTrimming(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [track.id, track.locked, clip.id, clip.timelineStart, clip.duration, zoom, trimClipStart, trimClipEnd, pushHistory])

  if (left + width < 0 || left > 5000) return null

  const speedLabel = clip.speed !== 1 ? `${clip.speed}x` : ''
  const reverseLabel = clip.reverse ? 'R' : ''
  const opacityStyle = clip.transform.opacity < 1 ? { opacity: clip.transform.opacity * 0.5 + 0.5 } : {}

  return (
    <div
      className={`absolute top-1 bottom-1 rounded border transition-shadow ${colorMap[track.type] || colorMap.video} ${
        isSelected ? 'ring-2 ring-white/50 shadow-lg' : ''
      } ${isDragging ? 'opacity-75' : ''} ${
        activeTool === 'razor' ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      style={{ left: Math.max(left, 0), width: Math.max(width, 4), ...opacityStyle }}
      onClick={handleClick}
      onMouseDown={handleDragStart}
    >
      {/* Trim handle - start */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-l ${
          isTrimming === 'start' ? 'bg-white/40' : ''
        }`}
        onMouseDown={(e) => handleTrimStart(e, 'start')}
      />

      {/* Clip label + indicators */}
      {width > 40 && (
        <div className="absolute inset-0 flex items-center justify-between px-2 overflow-hidden pointer-events-none">
          <span className="text-[10px] text-white/80 truncate select-none">
            {clip.label || `${clip.sourceStart.toFixed(1)}s`}
          </span>
          {(speedLabel || reverseLabel) && (
            <span className="text-[9px] text-yellow-300/90 font-mono select-none shrink-0 ml-1">
              {reverseLabel}{speedLabel}
            </span>
          )}
        </div>
      )}

      {/* Transition indicators */}
      {clip.transitionIn && (
        <div
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none"
          style={{ width: Math.min(clip.transitionIn.duration * zoom, width / 2) }}
        />
      )}
      {clip.transitionOut && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-white/20 to-transparent pointer-events-none"
          style={{ width: Math.min(clip.transitionOut.duration * zoom, width / 2) }}
        />
      )}

      {/* Trim handle - end */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-r ${
          isTrimming === 'end' ? 'bg-white/40' : ''
        }`}
        onMouseDown={(e) => handleTrimStart(e, 'end')}
      />
    </div>
  )
}

export default memo(TimelineClipComponent)
