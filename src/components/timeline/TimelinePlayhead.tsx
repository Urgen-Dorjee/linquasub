import { useTimelineStore } from '../../stores/timelineStore'

interface TimelinePlayheadProps {
  height: number
}

export default function TimelinePlayhead({ height }: TimelinePlayheadProps) {
  const playhead = useTimelineStore((s) => s.playhead)
  const zoom = useTimelineStore((s) => s.zoom)
  const scrollX = useTimelineStore((s) => s.scrollX)

  const x = playhead * zoom - scrollX

  if (x < -1 || x > 5000) return null

  return (
    <div
      className="absolute top-0 pointer-events-none z-20"
      style={{ left: x, height }}
    >
      <div className="w-px bg-red-500 h-full" />
    </div>
  )
}
