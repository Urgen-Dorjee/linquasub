import { useState, useEffect, useRef } from 'react'
import { Volume2, Loader2, Music } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useExportStore } from '../../stores/exportStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface AudioSettings {
  volume: number
  bass: number
  treble: number
  normalize: boolean
  noise_reduction: number
  compressor: boolean
  fade_in: number
  fade_out: number
}

const DEFAULTS: AudioSettings = {
  volume: 1.0,
  bass: 0,
  treble: 0,
  normalize: false,
  noise_reduction: 0,
  compressor: false,
  fade_in: 0,
  fade_out: 0,
}

export default function AudioMixPanel() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const isExporting = useExportStore((s) => s.isExporting)
  const [settings, setSettings] = useState<AudioSettings>(DEFAULTS)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const update = (patch: Partial<AudioSettings>) => setSettings((s) => ({ ...s, ...patch }))

  const handleApply = async () => {
    if (!window.electronAPI || !videoPath) return
    const outputPath = await window.electronAPI.saveFile('audio_processed.mp4')
    if (!outputPath) return

    setProcessing(true)
    setProgress(0)

    try {
      const result = await api.processAudio({
        video_path: videoPath,
        output_path: outputPath,
        audio_settings: { ...settings } as Record<string, unknown>,
      })

      pollRef.current = setInterval(async () => {
        try {
          const data = await api.getExportResult(result.task_id)
          if (data.path) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            setProgress(100)
            toast.success('Audio processing complete!')
          } else if (data.progress > 0) {
            setProgress(data.progress)
          }
        } catch (err: any) {
          if (err?.response?.status === 500) {
            clearInterval(pollRef.current!)
            setProcessing(false)
            toast.error(err.response?.data?.detail || 'Audio processing failed')
          }
        }
      }, 2000)
    } catch {
      toast.error('Failed to start audio processing')
      setProcessing(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Volume2 size={18} />
        Audio Mixing
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Volume</label>
          <input
            type="range" min={0} max={3} step={0.1}
            value={settings.volume}
            onChange={(e) => update({ volume: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{settings.volume.toFixed(1)}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Noise Reduction</label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.noise_reduction}
            onChange={(e) => update({ noise_reduction: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{Math.round(settings.noise_reduction * 100)}%</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bass</label>
          <input
            type="range" min={-20} max={20} step={1}
            value={settings.bass}
            onChange={(e) => update({ bass: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{settings.bass}dB</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Treble</label>
          <input
            type="range" min={-20} max={20} step={1}
            value={settings.treble}
            onChange={(e) => update({ treble: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <span className="text-[10px] text-slate-600">{settings.treble}dB</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => update({ normalize: !settings.normalize })}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            settings.normalize ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Normalize
        </button>
        <button
          onClick={() => update({ compressor: !settings.compressor })}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            settings.compressor ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Compressor
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fade In (s)</label>
          <input
            type="number" min={0} max={10} step={0.5}
            value={settings.fade_in}
            onChange={(e) => update({ fade_in: parseFloat(e.target.value) || 0 })}
            className="input-field w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fade Out (s)</label>
          <input
            type="number" min={0} max={10} step={0.5}
            value={settings.fade_out}
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
            Processing... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </>
        ) : (
          <>
            <Music size={14} />
            Process Audio & Export
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
