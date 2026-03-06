import { Volume2 } from 'lucide-react'

export default function AudioMixPanel() {
  return (
    <div className="card space-y-3 opacity-60">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Volume2 size={18} />
        Audio Mixing
      </h3>
      <p className="text-sm text-slate-400">
        Volume, noise reduction, EQ, compression, and normalization.
      </p>
      <div className="bg-slate-800/50 rounded-lg px-4 py-3 text-center">
        <p className="text-xs text-blue-400 font-medium">Coming Soon</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Real-time preview in Editor before export
        </p>
      </div>
    </div>
  )
}
