import { useVideoEffectsStore } from '../../stores/videoEffectsStore'
import { RotateCcw } from 'lucide-react'

export default function AudioMixTab() {
  const audioMix = useVideoEffectsStore((s) => s.audioMix)
  const setAudioMix = useVideoEffectsStore((s) => s.setAudioMix)
  const reset = useVideoEffectsStore((s) => s.resetAudioMix)

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio Mixing</h4>
        <button onClick={reset} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1" title="Reset">
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      <div className="space-y-3">
        <SliderControl label="Volume" value={audioMix.volume} min={0} max={3} step={0.05}
          onChange={(v) => setAudioMix({ volume: v })} display={`${Math.round(audioMix.volume * 100)}%`} />
        <SliderControl label="Noise Reduction" value={audioMix.noiseReduction} min={0} max={1} step={0.05}
          onChange={(v) => setAudioMix({ noiseReduction: v })} display={`${Math.round(audioMix.noiseReduction * 100)}%`} />
      </div>

      <div>
        <label className="text-[11px] text-slate-400 mb-2 block">Equalizer</label>
        <div className="grid grid-cols-3 gap-3">
          <EQBand label="Bass" value={audioMix.bass}
            onChange={(v) => setAudioMix({ bass: v })} />
          <EQBand label="Mid" value={audioMix.mid}
            onChange={(v) => setAudioMix({ mid: v })} />
          <EQBand label="Treble" value={audioMix.treble}
            onChange={(v) => setAudioMix({ treble: v })} />
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
        <div>
          <p className="text-[11px] text-slate-300">Normalize Audio</p>
          <p className="text-[9px] text-slate-500">Auto-level to -14 LUFS</p>
        </div>
        <button
          onClick={() => setAudioMix({ normalize: !audioMix.normalize })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            audioMix.normalize ? 'bg-blue-600' : 'bg-slate-600'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            audioMix.normalize ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      <p className="text-[10px] text-slate-600 italic">
        Volume previews in real-time. EQ, normalization, and noise reduction are applied with FFmpeg on export.
      </p>
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

function EQBand({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="text-center">
      <div className="h-20 flex items-center justify-center">
        <input type="range" min={-12} max={12} step={1} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="accent-blue-500 h-16"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
      </div>
      <div className="text-[10px] text-slate-500 font-mono">{value > 0 ? '+' : ''}{value}dB</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}
