import { useState, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import SubtitleRow from './SubtitleRow'
import TimingTools from './TimingTools'
import { Merge, Trash2, Upload, Undo2, Redo2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function SubtitleEditor() {
  const segments = useTranscriptionStore((s) => s.segments)
  const updateSegment = useTranscriptionStore((s) => s.updateSegment)
  const deleteSegments = useTranscriptionStore((s) => s.deleteSegments)
  const mergeSegments = useTranscriptionStore((s) => s.mergeSegments)
  const setSegments = useTranscriptionStore((s) => s.setSegments)
  const undo = useTranscriptionStore((s) => s.undo)
  const redo = useTranscriptionStore((s) => s.redo)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(multi ? prev : [])
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    []
  )

  const handleMerge = () => {
    if (selectedIds.size < 2) return
    mergeSegments(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleDelete = () => {
    if (selectedIds.size === 0) return
    deleteSegments(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleImportSubtitle = async () => {
    if (!window.electronAPI) return

    try {
      const path = await window.electronAPI.selectSubtitleFile()
      if (!path) return

      const ext = path.split('.').pop()?.toLowerCase()
      if (!['srt', 'vtt', 'ass', 'ssa'].includes(ext || '')) {
        toast.error('Unsupported subtitle format. Use SRT, VTT, or ASS.')
        return
      }

      const result = await api.importSubtitle(path)
      if (result.segments && result.segments.length > 0) {
        setSegments(result.segments)
        toast.success(`Imported ${result.count} segments from ${ext?.toUpperCase()}`)
      } else {
        toast.error('No segments found in file')
      }
    } catch {
      toast.error('Failed to import subtitle file')
    }
  }

  return (
    <div className="card h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-3">
        <h3 className="text-sm font-semibold text-white">
          Subtitles ({segments.length} segments)
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => undo()}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => redo()}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            onClick={handleImportSubtitle}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
            title="Import subtitle file (SRT/VTT/ASS)"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={handleMerge}
            disabled={selectedIds.size < 2}
            className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            title="Merge selected"
          >
            <Merge size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            title="Delete selected"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Timing tools */}
      <div className="pb-3 border-b border-slate-700 mb-3">
        <TimingTools />
      </div>

      {/* Virtual scrolled list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const segment = segments[virtualRow.index]
            return (
              <div
                key={segment.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <SubtitleRow
                  index={virtualRow.index}
                  segment={segment}
                  isSelected={selectedIds.has(segment.id)}
                  onSelect={handleSelect}
                  onUpdate={updateSegment}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
