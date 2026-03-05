import { useState, useEffect, useRef } from 'react'
import { ImageOff, Loader2, Paintbrush } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useExportStore } from '../../stores/exportStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

type BgMode = 'remove' | 'blur' | 'replace'

export default function BackgroundPanel() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const isExporting = useExportStore((s) => s.isExporting)
  const [mode, setMode] = useState<BgMode>('blur')
  const [bgColor, setBgColor] = useState('#00FF00')
  const [blurStrength, setBlurStrength] = useState(21)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleProcess = async () => {
    if (!window.electronAPI || !videoPath) return

    const outputPath = await window.electronAPI.saveFile('bg_removed_output.mp4')
    if (!outputPath) return

    setProcessing(true)
    setProgress(0)

    try {
      const result = await api.removeBackground({
        video_path: videoPath,
        output_path: outputPath,
        mode,
        bg_color: bgColor,
        blur_strength: blurStrength,
      })

      pollRef.current = setInterval(async () => {
        try {
          const data = await api.getExportResult(result.task_id)
          if (data.path) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            setProgress(100)
            toast.success('Background processing complete!')
          } else if (data.progress > 0) {
            setProgress(data.progress)
          }
        } catch (err: any) {
          if (err?.response?.status === 500) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            toast.error(err.response?.data?.detail || 'Background removal failed')
          }
        }
      }, 2000)
    } catch {
      toast.error('Failed to start background processing')
      setProcessing(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <ImageOff size={18} />
        AI Background
      </h3>

      <div>
        <label className="block text-xs text-slate-500 mb-2">Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'blur', label: 'Blur BG', desc: 'Blur the background' },
            { value: 'remove', label: 'Green Screen', desc: 'Replace with solid color' },
            { value: 'replace', label: 'Replace BG', desc: 'Replace with color/image' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`text-xs px-2 py-2 rounded text-center transition-colors ${
                mode === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={opt.desc}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'blur' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Blur Strength</label>
          <input
            type="range"
            min={5}
            max={51}
            step={2}
            value={blurStrength}
            onChange={(e) => setBlurStrength(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <span className="text-xs text-slate-500">{blurStrength}px</span>
        </div>
      )}

      {(mode === 'remove' || mode === 'replace') && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Background Color</label>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-full h-9 rounded cursor-pointer"
          />
        </div>
      )}

      <p className="text-[10px] text-slate-600">
        Uses U2Net AI model. First run downloads the model (~170MB).
        Processing time depends on video length and resolution.
      </p>

      <button
        onClick={handleProcess}
        disabled={processing || isExporting || !videoPath}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            Processing... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </>
        ) : (
          <>
            <Paintbrush size={14} />
            Process Background
          </>
        )}
      </button>

      {processing && progress > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(progress, 1)}%` }}
          />
        </div>
      )}
    </div>
  )
}
