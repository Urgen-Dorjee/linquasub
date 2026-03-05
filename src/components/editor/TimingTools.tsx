import { useState } from 'react'
import { Clock, ArrowLeftRight, AlertCircle } from 'lucide-react'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function TimingTools() {
  const segments = useTranscriptionStore((s) => s.segments)
  const setSegments = useTranscriptionStore((s) => s.setSegments)
  const [shiftMs, setShiftMs] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleShift = async () => {
    if (shiftMs === 0 || segments.length === 0) return
    setIsProcessing(true)
    try {
      const result = await api.timingShift({
        segments: segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          words: s.words.map((w) => ({ start: w.start, end: w.end, word: w.word, probability: w.probability })),
        })),
        shift_ms: shiftMs,
        fix_overlaps: false,
      })
      setSegments(result.segments)
      toast.success(`Shifted ${shiftMs > 0 ? '+' : ''}${shiftMs}ms`)
    } catch {
      toast.error('Failed to shift timing')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFixOverlaps = async () => {
    if (segments.length < 2) return
    setIsProcessing(true)
    try {
      const result = await api.timingShift({
        segments: segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          words: s.words.map((w) => ({ start: w.start, end: w.end, word: w.word, probability: w.probability })),
        })),
        shift_ms: 0,
        fix_overlaps: true,
      })
      setSegments(result.segments)
      toast.success('Overlaps fixed')
    } catch {
      toast.error('Failed to fix overlaps')
    } finally {
      setIsProcessing(false)
    }
  }

  // Count overlapping segments
  const overlapCount = segments.reduce((count, seg, i) => {
    if (i < segments.length - 1 && seg.end > segments[i + 1].start) return count + 1
    return count
  }, 0)

  return (
    <div className="flex items-center gap-2 text-xs">
      <Clock size={12} className="text-slate-500" />

      <div className="flex items-center gap-1">
        <input
          type="number"
          value={shiftMs}
          onChange={(e) => setShiftMs(parseInt(e.target.value) || 0)}
          className="w-20 input-field text-xs py-1 px-2"
          placeholder="ms"
          step={100}
        />
        <button
          onClick={handleShift}
          disabled={isProcessing || shiftMs === 0}
          className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
        >
          <ArrowLeftRight size={10} />
          Shift
        </button>
      </div>

      {overlapCount > 0 && (
        <button
          onClick={handleFixOverlaps}
          disabled={isProcessing}
          className="btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-amber-400"
        >
          <AlertCircle size={10} />
          Fix {overlapCount} overlaps
        </button>
      )}
    </div>
  )
}
