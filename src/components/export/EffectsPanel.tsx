import { useState, useEffect, useRef } from 'react'
import { Sliders, Loader2, Wand2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useExportStore } from '../../stores/exportStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface EffectsState {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  speed: number
  volume: number
  vignette: boolean
  grayscale: boolean
  sepia: boolean
  fade_in: number
  fade_out: number
}

const DEFAULT_EFFECTS: EffectsState = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  blur: 0,
  speed: 1,
  volume: 1,
  vignette: false,
  grayscale: false,
  sepia: false,
  fade_in: 0,
  fade_out: 0,
}

export default function EffectsPanel() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const isExporting = useExportStore((s) => s.isExporting)
  const [effects, setEffects] = useState<EffectsState>(DEFAULT_EFFECTS)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const update = (patch: Partial<EffectsState>) => setEffects((e) => ({ ...e, ...patch }))

  const handleApply = async () => {
    if (!window.electronAPI || !videoPath) return
    const outputPath = await window.electronAPI.saveFile('effects_output.mp4')
    if (!outputPath) return

    setProcessing(true)
    setProgress(0)

    try {
      const result = await api.applyEffects({
        video_path: videoPath,
        output_path: outputPath,
        effects: { ...effects } as Record<string, unknown>,
      })

      pollRef.current = setInterval(async () => {
        try {
          const data = await api.getExportResult(result.task_id)
          if (data.path) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            setProgress(100)
            toast.success('Effects applied!')
          } else if (data.progress > 0) {
            setProgress(data.progress)
          }
        } catch (err: any) {
          if (err?.response?.status === 500) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            toast.error(err.response?.data?.detail || 'Effects failed')
          }
        }
      }, 2000)
    } catch {
      toast.error('Failed to apply effects')
      setProcessing(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Sliders size={18} />
        Effects & Filters
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Brightness</label>
          <input
            type="range" min={-1} max={1} step={0.05}
            value={effects.brightness}
            onChange={(e) => update({ brightness: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.brightness.toFixed(2)}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Contrast</label>
          <input
            type="range" min={0} max={3} step={0.05}
            value={effects.contrast}
            onChange={(e) => update({ contrast: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.contrast.toFixed(2)}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Saturation</label>
          <input
            type="range" min={0} max={3} step={0.05}
            value={effects.saturation}
            onChange={(e) => update({ saturation: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.saturation.toFixed(2)}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Blur</label>
          <input
            type="range" min={0} max={20} step={1}
            value={effects.blur}
            onChange={(e) => update({ blur: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.blur}px</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Speed</label>
          <input
            type="range" min={0.25} max={4} step={0.25}
            value={effects.speed}
            onChange={(e) => update({ speed: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.speed}x</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Volume</label>
          <input
            type="range" min={0} max={3} step={0.1}
            value={effects.volume}
            onChange={(e) => update({ volume: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{effects.volume.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['vignette', 'grayscale', 'sepia'] as const).map((key) => (
          <button
            key={key}
            onClick={() => update({ [key]: !effects[key] })}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              effects[key] ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fade In (s)</label>
          <input
            type="number" min={0} max={10} step={0.5}
            value={effects.fade_in}
            onChange={(e) => update({ fade_in: parseFloat(e.target.value) || 0 })}
            className="input-field w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fade Out (s)</label>
          <input
            type="number" min={0} max={10} step={0.5}
            value={effects.fade_out}
            onChange={(e) => update({ fade_out: parseFloat(e.target.value) || 0 })}
            className="input-field w-full text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={processing || isExporting || !videoPath}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            Applying... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </>
        ) : (
          <>
            <Wand2 size={14} />
            Apply Effects & Export
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
