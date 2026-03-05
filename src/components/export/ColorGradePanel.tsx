import { useState, useEffect, useRef } from 'react'
import { Palette, Loader2, Sun } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useExportStore } from '../../stores/exportStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface GradeSettings {
  temperature: number
  tint: number
  exposure: number
  shadows: { r: number; g: number; b: number }
  midtones: { r: number; g: number; b: number }
  highlights: { r: number; g: number; b: number }
}

const DEFAULTS: GradeSettings = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  shadows: { r: 1, g: 1, b: 1 },
  midtones: { r: 1, g: 1, b: 1 },
  highlights: { r: 1, g: 1, b: 1 },
}

export default function ColorGradePanel() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const isExporting = useExportStore((s) => s.isExporting)
  const [settings, setSettings] = useState<GradeSettings>(DEFAULTS)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleApply = async () => {
    if (!window.electronAPI || !videoPath) return
    const outputPath = await window.electronAPI.saveFile('color_graded.mp4')
    if (!outputPath) return

    setProcessing(true)
    setProgress(0)

    try {
      const result = await api.colorGrade({
        video_path: videoPath,
        output_path: outputPath,
        grade_settings: { ...settings } as Record<string, unknown>,
      })

      pollRef.current = setInterval(async () => {
        try {
          const data = await api.getExportResult(result.task_id)
          if (data.path) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            setProgress(100)
            toast.success('Color grading complete!')
          } else if (data.progress > 0) {
            setProgress(data.progress)
          }
        } catch (err: any) {
          if (err?.response?.status === 500) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            toast.error(err.response?.data?.detail || 'Color grading failed')
          }
        }
      }, 2000)
    } catch {
      toast.error('Failed to start color grading')
      setProcessing(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Palette size={18} />
        Color Grading
      </h3>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Temperature</label>
          <input
            type="range" min={-100} max={100} step={5}
            value={settings.temperature}
            onChange={(e) => setSettings({ ...settings, temperature: parseInt(e.target.value) })}
            className="w-full accent-orange-400"
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Cool</span>
            <span>{settings.temperature}</span>
            <span>Warm</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tint</label>
          <input
            type="range" min={-100} max={100} step={5}
            value={settings.tint}
            onChange={(e) => setSettings({ ...settings, tint: parseInt(e.target.value) })}
            className="w-full accent-green-400"
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Green</span>
            <span>{settings.tint}</span>
            <span>Magenta</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Exposure</label>
          <input
            type="range" min={-3} max={3} step={0.1}
            value={settings.exposure}
            onChange={(e) => setSettings({ ...settings, exposure: parseFloat(e.target.value) })}
            className="w-full accent-yellow-400"
          />
          <span className="text-[10px] text-slate-600">{settings.exposure.toFixed(1)} EV</span>
        </div>
      </div>

      {/* Lift/Gamma/Gain color wheels (simplified as sliders) */}
      {(['shadows', 'midtones', 'highlights'] as const).map((zone) => (
        <div key={zone}>
          <label className="block text-xs text-slate-500 mb-1 capitalize">{zone}</label>
          <div className="flex gap-2">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <div key={ch} className="flex-1">
                <input
                  type="range" min={0.5} max={1.5} step={0.02}
                  value={settings[zone][ch]}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      [zone]: { ...settings[zone], [ch]: parseFloat(e.target.value) },
                    })
                  }}
                  className={`w-full ${ch === 'r' ? 'accent-red-500' : ch === 'g' ? 'accent-green-500' : 'accent-blue-500'}`}
                />
                <span className="text-[10px] text-slate-600 block text-center">
                  {ch.toUpperCase()} {settings[zone][ch].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleApply}
        disabled={processing || isExporting || !videoPath}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            Grading... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </>
        ) : (
          <>
            <Sun size={14} />
            Apply Grade & Export
          </>
        )}
      </button>

      {processing && progress > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 1)}%` }} />
        </div>
      )}
    </div>
  )
}
