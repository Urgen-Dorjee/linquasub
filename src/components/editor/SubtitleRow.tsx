import { useState, useCallback, memo } from 'react'
import type { Segment } from '../../types/subtitle'
import { clsx } from 'clsx'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

interface SubtitleRowProps {
  index: number
  segment: Segment
  isSelected: boolean
  onSelect: (id: string, multi: boolean) => void
  onUpdate: (id: string, patch: Partial<Segment>) => void
}

function SubtitleRow({
  index,
  segment,
  isSelected,
  onSelect,
  onUpdate,
}: SubtitleRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(segment.text)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onSelect(segment.id, e.ctrlKey || e.metaKey)
    },
    [segment.id, onSelect]
  )

  const handleDoubleClick = useCallback(() => {
    setEditText(segment.text)
    setIsEditing(true)
  }, [segment.text])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (editText !== segment.text) {
      onUpdate(segment.id, { text: editText })
    }
  }, [editText, segment.id, segment.text, onUpdate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleBlur()
      } else if (e.key === 'Escape') {
        setEditText(segment.text)
        setIsEditing(false)
      }
    },
    [handleBlur, segment.text]
  )

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border',
        isSelected
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'border-transparent hover:bg-slate-800/50'
      )}
    >
      <span className="text-xs text-slate-600 w-8 shrink-0 text-right">{index + 1}</span>

      <div className="flex flex-col gap-0.5 shrink-0 w-36">
        <span className="text-[10px] font-mono text-slate-500">
          {formatTime(segment.start)}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {formatTime(segment.end)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-slate-900 text-sm text-white px-2 py-1 rounded border border-blue-500 outline-none"
          />
        ) : (
          <p className="text-sm text-slate-300 truncate">{segment.text}</p>
        )}
      </div>

      <span className="text-[10px] text-slate-600 shrink-0">
        {(segment.end - segment.start).toFixed(1)}s
      </span>
    </div>
  )
}

export default memo(SubtitleRow)
