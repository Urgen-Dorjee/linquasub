import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useVideoEffectsStore } from '../stores/videoEffectsStore'
import ExportPanel from '../components/export/ExportPanel'
import { Download, Loader2, Sliders, Palette, Volume2, ImageOff, Check } from 'lucide-react'

function EffectsSummary() {
  const effects = useVideoEffectsStore((s) => s.effects)
  const colorGrade = useVideoEffectsStore((s) => s.colorGrade)
  const audioMix = useVideoEffectsStore((s) => s.audioMix)

  const items: string[] = []

  // Effects
  if (effects.brightness !== 0) items.push(`Brightness ${effects.brightness > 0 ? '+' : ''}${effects.brightness.toFixed(2)}`)
  if (effects.contrast !== 1) items.push(`Contrast ${effects.contrast.toFixed(2)}`)
  if (effects.saturation !== 1) items.push(`Saturation ${effects.saturation.toFixed(2)}`)
  if (effects.blur > 0) items.push(`Blur ${effects.blur}px`)
  if (effects.grayscale) items.push('Grayscale')
  if (effects.sepia) items.push('Sepia')
  if (effects.vignette) items.push('Vignette')
  if (effects.fadeIn > 0) items.push(`Fade In ${effects.fadeIn}s`)
  if (effects.fadeOut > 0) items.push(`Fade Out ${effects.fadeOut}s`)

  // Color
  if (colorGrade.temperature !== 0) items.push(`Temperature ${colorGrade.temperature > 0 ? 'Warm' : 'Cool'}`)
  if (colorGrade.tint !== 0) items.push(`Tint ${colorGrade.tint.toFixed(2)}`)
  if (colorGrade.exposure !== 0) items.push(`Exposure ${colorGrade.exposure > 0 ? '+' : ''}${colorGrade.exposure.toFixed(2)}`)

  // Audio
  if (audioMix.volume !== 1) items.push(`Volume ${Math.round(audioMix.volume * 100)}%`)
  if (audioMix.bass !== 0) items.push(`Bass ${audioMix.bass > 0 ? '+' : ''}${audioMix.bass}dB`)
  if (audioMix.mid !== 0) items.push(`Mid ${audioMix.mid > 0 ? '+' : ''}${audioMix.mid}dB`)
  if (audioMix.treble !== 0) items.push(`Treble ${audioMix.treble > 0 ? '+' : ''}${audioMix.treble}dB`)
  if (audioMix.normalize) items.push('Normalize')
  if (audioMix.noiseReduction > 0) items.push(`Noise Reduction ${Math.round(audioMix.noiseReduction * 100)}%`)

  if (items.length === 0) {
    return null
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Check size={14} className="text-green-400" />
        Editor Settings Applied on Export
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {item}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-slate-500">
        Adjust these in the Editor tab. They preview in real-time on the video and are applied with FFmpeg during export.
      </p>
    </div>
  )
}

function FeatureCards() {
  const features = [
    { icon: Sliders, label: 'Effects & Filters', desc: 'Brightness, contrast, blur, vignette' },
    { icon: Palette, label: 'Color Grading', desc: 'Temperature, tint, exposure, shadows' },
    { icon: Volume2, label: 'Audio Mixing', desc: 'Volume, EQ, normalize, noise reduction' },
    { icon: ImageOff, label: 'AI Background', desc: 'Remove, blur, or replace background' },
  ]

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold text-slate-400">Adjust in Editor</h3>
      <div className="grid grid-cols-2 gap-2">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.label} className="flex items-start gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
              <Icon size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-slate-300 font-medium">{f.label}</p>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-500 text-center">
        Go to Editor tab to adjust these with real-time preview
      </p>
    </div>
  )
}

export default function ExportPage() {
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)

  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-400 mx-auto" size={32} />
          <p className="text-slate-400">Transcription in progress...</p>
          <p className="text-slate-500 text-sm">Export will be available once transcription completes.</p>
        </div>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Download className="text-slate-600 mx-auto" size={40} />
          <p className="text-slate-400 text-lg">No subtitles to export</p>
          <p className="text-slate-500 text-sm">
            Go to the Home tab to upload a video and transcribe it first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Export</h2>
        <p className="text-slate-400">
          Export your subtitles as files or burn them into the video.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ExportPanel />
        </div>
        <div className="space-y-6">
          <EffectsSummary />
          <FeatureCards />
        </div>
      </div>
    </div>
  )
}
