import { useState } from 'react'
import { motion } from 'framer-motion'
import VideoDropZone from './VideoDropZone'
import YouTubeInput from './YouTubeInput'

const tabs = [
  { id: 'file' as const, label: 'Local File' },
  { id: 'youtube' as const, label: 'YouTube URL' },
]

export default function InputPanel() {
  const [mode, setMode] = useState<'file' | 'youtube'>('file')

  return (
    <div className="card space-y-4">
      <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === tab.id && (
              <motion.div
                layoutId="input-tab"
                className="absolute inset-0 bg-blue-600 rounded-md"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {mode === 'file' ? <VideoDropZone /> : <YouTubeInput />}
    </div>
  )
}
