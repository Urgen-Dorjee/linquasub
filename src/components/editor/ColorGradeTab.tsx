import { useVideoEffectsStore } from '../../stores/videoEffectsStore'
import { RotateCcw } from 'lucide-react'

export default function ColorGradeTab() {
  const colorGrade = useVideoEffectsStore((s) => s.colorGrade)
  const setColorGrade = useVideoEffectsStore((s) => s.setColorGrade)
  const reset = useVideoEffectsStore((s) => s.resetColorGrade)

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Color Grading</h4>
        <button onClick={reset} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1" title="Reset">
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="space-y-3">
        <ColorSlider label="Temperature" value={colorGrade.temperature} min={-1} max={1} step={0.05}
          onChange={(v) => setColorGrade({ temperature: v })}
          leftLabel="Cool" rightLabel="Warm" gradientFrom="#4da6ff" gradientTo="#ff9933" />
        <ColorSlider label="Tint" value={colorGrade.tint} min={-1} max={1} step={0.05}
          onChange={(v) => setColorGrade({ tint: v })}
          leftLabel="Green" rightLabel="Magenta" gradientFrom="#33cc66" gradientTo="#cc33cc" />
        <ColorSlider label="Exposure" value={colorGrade.exposure} min={-1} max={1} step={0.05}
          onChange={(v) => setColorGrade({ exposure: v })}
          leftLabel="" rightLabel="" gradientFrom="#1a1a2e" gradientTo="#fffbe6" />
      </div>

      <div className="space-y-3">
        <RGBGroup label="Shadows" values={colorGrade.shadows}
          onChange={(v) => setColorGrade({ shadows: v })} />
        <RGBGroup label="Midtones" values={colorGrade.midtones}
          onChange={(v) => setColorGrade({ midtones: v })} />
        <RGBGroup label="Highlights" values={colorGrade.highlights}
          onChange={(v) => setColorGrade({ highlights: v })} />
      </div>
    </div>
  )
}

function ColorSlider({ label, value, min, max, step, onChange, leftLabel, rightLabel, gradientFrom, gradientTo }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; leftLabel: string; rightLabel: string
  gradientFrom: string; gradientTo: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-slate-400">{label}</label>
        <span className="text-[10px] text-slate-500 font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="relative">
        <div className="absolute inset-0 rounded h-1.5 top-[7px] pointer-events-none"
          style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`, opacity: 0.4 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-blue-500 h-1 relative z-10" />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
          <span>{leftLabel}</span><span>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}

function RGBGroup({ label, values, onChange }: {
  label: string; values: { r: number; g: number; b: number }
  onChange: (v: { r: number; g: number; b: number }) => void
}) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {(['r', 'g', 'b'] as const).map((ch) => (
          <div key={ch}>
            <input type="range" min={0} max={2} step={0.05} value={values[ch]}
              onChange={(e) => onChange({ ...values, [ch]: parseFloat(e.target.value) })}
              className={`w-full h-1 ${ch === 'r' ? 'accent-red-500' : ch === 'g' ? 'accent-green-500' : 'accent-blue-500'}`} />
            <div className="text-[9px] text-slate-600 text-center">{ch.toUpperCase()} {values[ch].toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
