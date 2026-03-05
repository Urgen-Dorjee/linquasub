import { useRef, useEffect, useCallback, useState } from 'react'
import { MousePointer, Scissors, ArrowLeftRight, Magnet, ZoomIn, ZoomOut, ScanLine, VolumeX, Loader2, Plus, Film, Music, Undo2, Redo2 } from 'lucide-react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useProjectStore } from '../../stores/projectStore'
import TimelineRuler from './TimelineRuler'
import TimelineTrackComponent from './TimelineTrack'
import TimelinePlayhead from './TimelinePlayhead'
import api from '../../services/api'
import toast from 'react-hot-toast'
import type { TimelineTool } from '../../types/timeline'

interface TimelineProps {
  onSeek: (time: number) => void
}

const TOOLS: { tool: TimelineTool; icon: typeof MousePointer; label: string }[] = [
  { tool: 'select', icon: MousePointer, label: 'Select (V)' },
  { tool: 'razor', icon: Scissors, label: 'Razor (C)' },
  { tool: 'trim', icon: ArrowLeftRight, label: 'Trim (T)' },
]

export default function Timeline({ onSeek }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoPath = useProjectStore((s) => s.videoPath)
  const tracks = useTimelineStore((s) => s.tracks)
  const zoom = useTimelineStore((s) => s.zoom)
  const scrollX = useTimelineStore((s) => s.scrollX)
  const activeTool = useTimelineStore((s) => s.activeTool)
  const snapEnabled = useTimelineStore((s) => s.snapEnabled)
  const duration = useTimelineStore((s) => s.duration)
  const setPlayhead = useTimelineStore((s) => s.setPlayhead)
  const setZoom = useTimelineStore((s) => s.setZoom)
  const setScrollX = useTimelineStore((s) => s.setScrollX)
  const setActiveTool = useTimelineStore((s) => s.setActiveTool)
  const setSnapEnabled = useTimelineStore((s) => s.setSnapEnabled)
  const selection = useTimelineStore((s) => s.selection)
  const removeClip = useTimelineStore((s) => s.removeClip)
  const addVideoTrack = useTimelineStore((s) => s.addVideoTrack)
  const addAudioTrack = useTimelineStore((s) => s.addAudioTrack)
  const undo = useTimelineStore((s) => s.undo)
  const redo = useTimelineStore((s) => s.redo)
  const [sceneMarkers, setSceneMarkers] = useState<number[]>([])
  const [silenceRegions, setSilenceRegions] = useState<Array<{ start: number; end: number }>>([])
  const [analyzing, setAnalyzing] = useState<'scenes' | 'silence' | null>(null)

  const containerWidth = containerRef.current?.clientWidth ?? 800

  const handleRulerClick = useCallback((time: number) => {
    setPlayhead(time)
    onSeek(time)
  }, [setPlayhead, onSeek])

  // Keyboard shortcuts for timeline
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select')
          break
        case 'c':
          setActiveTool('razor')
          break
        case 't':
          setActiveTool('trim')
          break
        case 'delete':
        case 'backspace':
          if (selection.clipIds.length > 0 && selection.trackId) {
            selection.clipIds.forEach((clipId) => removeClip(selection.trackId!, clipId))
          }
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setActiveTool, selection, removeClip, undo, redo])

  // Scroll/zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const zoomDelta = e.deltaY > 0 ? -10 : 10
      setZoom(zoom + zoomDelta)
    } else {
      setScrollX(scrollX + e.deltaX + e.deltaY)
    }
  }, [zoom, scrollX, setZoom, setScrollX])

  const totalWidth = Math.max(duration * zoom, containerWidth)

  const tracksHeight = tracks.reduce((sum, t) => sum + t.height, 0)

  return (
    <div className="flex flex-col bg-slate-950 border-t border-slate-700 select-none" role="region" aria-label="Timeline">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border-b border-slate-800" role="toolbar" aria-label="Timeline tools">
        {TOOLS.map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`p-1.5 rounded transition-colors ${
              activeTool === tool
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={label}
            aria-label={label}
            aria-pressed={activeTool === tool}
          >
            <Icon size={14} />
          </button>
        ))}

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`p-1.5 rounded transition-colors ${
            snapEnabled ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Snap"
        >
          <Magnet size={14} />
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <button
          onClick={() => setZoom(zoom - 20)}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{zoom}px/s</span>
        <button
          onClick={() => setZoom(zoom + 20)}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30"
          title="Undo (Ctrl+Z)"
          disabled={!useTimelineStore.getState().canUndo()}
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={redo}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30"
          title="Redo (Ctrl+Y)"
          disabled={!useTimelineStore.getState().canRedo()}
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Add tracks */}
        <button
          onClick={addVideoTrack}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
          title="Add video track"
        >
          <Film size={14} />
          <Plus size={10} />
        </button>
        <button
          onClick={addAudioTrack}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
          title="Add audio track"
        >
          <Music size={14} />
          <Plus size={10} />
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Scene detection */}
        <button
          onClick={async () => {
            if (!videoPath || analyzing) return
            setAnalyzing('scenes')
            try {
              const result = await api.detectScenes({ video_path: videoPath })
              setSceneMarkers(result.scenes.map((s) => s.time))
              toast.success(`Detected ${result.count} scene changes`)
            } catch {
              toast.error('Scene detection failed')
            } finally {
              setAnalyzing(null)
            }
          }}
          disabled={!videoPath || analyzing !== null}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
          title="Detect scenes"
        >
          {analyzing === 'scenes' ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
          <span className="text-[10px]">Scenes</span>
        </button>

        {/* Silence detection */}
        <button
          onClick={async () => {
            if (!videoPath || analyzing) return
            setAnalyzing('silence')
            try {
              const result = await api.detectSilence({ video_path: videoPath })
              setSilenceRegions(result.regions)
              toast.success(`Detected ${result.count} silence regions`)
            } catch {
              toast.error('Silence detection failed')
            } finally {
              setAnalyzing(null)
            }
          }}
          disabled={!videoPath || analyzing !== null}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
          title="Detect silence"
        >
          {analyzing === 'silence' ? <Loader2 size={14} className="animate-spin" /> : <VolumeX size={14} />}
          <span className="text-[10px]">Silence</span>
        </button>
      </div>

      {/* Ruler + Tracks */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto"
        onWheel={handleWheel}
        style={{ maxHeight: 280 }}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          {/* Ruler */}
          <div className="sticky top-0 z-10" style={{ marginLeft: 120 }}>
            <TimelineRuler width={Math.max(containerWidth - 120, totalWidth - 120)} onClick={handleRulerClick} />
          </div>

          {/* Tracks with playhead overlay */}
          <div className="relative">
            <div style={{ marginLeft: 0 }}>
              {tracks.map((track) => (
                <TimelineTrackComponent key={track.id} track={track} />
              ))}
            </div>

            {/* Scene markers */}
            {sceneMarkers.map((time, i) => {
              const x = time * zoom - scrollX + 120
              if (x < 120 || x > totalWidth) return null
              return (
                <div
                  key={`scene-${i}`}
                  className="absolute top-0 w-px bg-amber-500/60 pointer-events-none z-10"
                  style={{ left: x, height: tracksHeight }}
                  title={`Scene @ ${time.toFixed(1)}s`}
                />
              )
            })}

            {/* Silence regions */}
            {silenceRegions.map((region, i) => {
              const x = region.start * zoom - scrollX + 120
              const w = (region.end - region.start) * zoom
              if (x + w < 120 || x > totalWidth) return null
              return (
                <div
                  key={`silence-${i}`}
                  className="absolute top-0 bg-red-500/15 border-x border-red-500/30 pointer-events-none z-10"
                  style={{ left: Math.max(x, 120), width: w, height: tracksHeight }}
                  title={`Silence ${region.start.toFixed(1)}s - ${region.end.toFixed(1)}s`}
                />
              )
            })}

            {/* Playhead line over tracks */}
            <div className="absolute top-0 left-[120px] right-0 pointer-events-none" style={{ height: tracksHeight }}>
              <TimelinePlayhead height={tracksHeight} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
