import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { ImageOff, Loader2, Eye } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

type BgMode = 'remove' | 'blur' | 'replace'

export default function BackgroundTab() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const [mode, setMode] = useState<BgMode>('remove')
  const [bgColor, setBgColor] = useState('#00ff00')
  const [blurStrength, setBlurStrength] = useState(15)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePreview = async () => {
    if (!videoPath) {
      toast.error('Load a video first')
      return
    }
    setLoading(true)
    try {
      const result = await api.removeBackground({
        video_path: videoPath,
        output_path: '__preview__',
        mode,
        bg_color: bgColor,
        blur_strength: blurStrength,
      })
      // For preview, we'd get back a single frame — for now show a placeholder
      toast.success('Background removal preview requested (task: ' + result.task_id + ')')
      setPreviewUrl(null)
    } catch {
      toast.error('Background removal requires rembg. Install: pip install rembg')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-2">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Background</h4>

      <div>
        <label className="text-[11px] text-slate-400 mb-2 block">Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'remove' as BgMode, label: 'Remove' },
            { value: 'blur' as BgMode, label: 'Blur' },
            { value: 'replace' as BgMode, label: 'Replace' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`text-[11px] px-2 py-1.5 rounded transition-colors ${
                mode === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'replace' && (
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Background Color</label>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            className="w-full h-8 rounded cursor-pointer" />
        </div>
      )}

      {mode === 'blur' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-slate-400">Blur Strength</label>
            <span className="text-[10px] text-slate-500 font-mono">{blurStrength}px</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={blurStrength}
            onChange={(e) => setBlurStrength(parseInt(e.target.value))}
            className="w-full accent-blue-500 h-1" />
        </div>
      )}

      {/* Preview area */}
      <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-slate-700/50">
        {previewUrl ? (
          <img src={previewUrl} alt="BG preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center space-y-2">
            <ImageOff size={24} className="text-slate-600 mx-auto" />
            <p className="text-[10px] text-slate-600">Click Preview to see result</p>
          </div>
        )}
      </div>

      <button
        onClick={handlePreview}
        disabled={loading || !videoPath}
        className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
      >
        {loading ? (
          <><Loader2 className="animate-spin" size={12} /> Processing...</>
        ) : (
          <><Eye size={12} /> Preview Frame</>
        )}
      </button>

      <p className="text-[10px] text-slate-600 italic">
        Uses AI (rembg) to process each frame. Preview shows a single frame.
        Full video processing happens on export.
      </p>
    </div>
  )
}
