import { useRef, useEffect } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'

function formatRulerTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TimelineRulerProps {
  width: number
  onClick: (time: number) => void
}

export default function TimelineRuler({ width, onClick }: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = useTimelineStore((s) => s.zoom)
  const scrollX = useTimelineStore((s) => s.scrollX)
  const duration = useTimelineStore((s) => s.duration)
  const playhead = useTimelineStore((s) => s.playhead)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = 28 * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, 28)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, 28)

    // Determine tick interval based on zoom
    let majorInterval: number
    if (zoom >= 200) majorInterval = 1
    else if (zoom >= 100) majorInterval = 2
    else if (zoom >= 50) majorInterval = 5
    else if (zoom >= 20) majorInterval = 10
    else majorInterval = 30

    const startTime = scrollX / zoom
    const endTime = (scrollX + width) / zoom
    const firstTick = Math.floor(startTime / majorInterval) * majorInterval

    ctx.font = '10px monospace'
    ctx.textAlign = 'center'

    for (let t = firstTick; t <= Math.min(endTime + majorInterval, duration); t += majorInterval) {
      const x = t * zoom - scrollX
      if (x < -20 || x > width + 20) continue

      // Major tick
      ctx.strokeStyle = '#475569'
      ctx.beginPath()
      ctx.moveTo(x, 16)
      ctx.lineTo(x, 28)
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.fillText(formatRulerTime(t), x, 12)

      // Minor ticks
      const minorCount = majorInterval <= 2 ? 4 : 5
      const minorInterval = majorInterval / minorCount
      for (let m = 1; m < minorCount; m++) {
        const mx = (t + m * minorInterval) * zoom - scrollX
        if (mx < 0 || mx > width) continue
        ctx.strokeStyle = '#334155'
        ctx.beginPath()
        ctx.moveTo(mx, 22)
        ctx.lineTo(mx, 28)
        ctx.stroke()
      }
    }

    // Playhead marker
    const playheadX = playhead * zoom - scrollX
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(playheadX - 5, 0)
      ctx.lineTo(playheadX + 5, 0)
      ctx.lineTo(playheadX + 5, 8)
      ctx.lineTo(playheadX, 14)
      ctx.lineTo(playheadX - 5, 8)
      ctx.closePath()
      ctx.fill()
    }
  }, [width, zoom, scrollX, duration, playhead])

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const time = (x + scrollX) / zoom
    onClick(Math.max(0, Math.min(duration, time)))
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height: 28 }}
      className="cursor-pointer"
      onClick={handleClick}
    />
  )
}
