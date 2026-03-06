import { useVideoEffectsStore } from '../../stores/videoEffectsStore'
import { RotateCcw } from 'lucide-react'

export default function EffectsTab() {
  const effects = useVideoEffectsStore((s) => s.effects)
  const setEffect = useVideoEffectsStore((s) => s.setEffect)
  const reset = useVideoEffectsStore((s) => s.resetEffects)

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Effects & Filters</h4>
        <button onClick={reset} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1" title="Reset">
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="space-y-3">
        <SliderControl label="Brightness" value={effects.brightness} min={-1} max={1} step={0.05}
          onChange={(v) => setEffect({ brightness: v })} display={effects.brightness.toFixed(2)} />
        <SliderControl label="Contrast" value={effects.contrast} min={0} max={3} step={0.05}
          onChange={(v) => setEffect({ contrast: v })} display={effects.contrast.toFixed(2)} />
        <SliderControl label="Saturation" value={effects.saturation} min={0} max={3} step={0.05}
          onChange={(v) => setEffect({ saturation: v })} display={effects.saturation.toFixed(2)} />
        <SliderControl label="Blur" value={effects.blur} min={0} max={20} step={1}
          onChange={(v) => setEffect({ blur: v })} display={`${effects.blur}px`} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['vignette', 'grayscale', 'sepia'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setEffect({ [key]: !effects[key] })}
            className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
              effects[key] ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Fade In (s)</label>
          <input type="number" min={0} max={10} step={0.5} value={effects.fadeIn}
            onChange={(e) => setEffect({ fadeIn: parseFloat(e.target.value) || 0 })}
            className="input-field w-full text-xs" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Fade Out (s)</label>
          <input type="number" min={0} max={10} step={0.5} value={effects.fadeOut}
            onChange={(e) => setEffect({ fadeOut: parseFloat(e.target.value) || 0 })}
            className="input-field w-full text-xs" />
        </div>
      </div>
    </div>
  )
}

function SliderControl({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; display: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-slate-400">{label}</label>
        <span className="text-[10px] text-slate-500 font-mono">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500 h-1" />
    </div>
  )
}
