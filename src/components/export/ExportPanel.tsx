import { useState } from 'react'
import { Download, Loader2, Film, FileText, Music, Palette } from 'lucide-react'
import { useExportStore, SUBTITLE_PRESETS } from '../../stores/exportStore'
import { useTranscriptionStore } from '../../stores/transcriptionStore'
import { useTranslationStore, selectActiveTranslations } from '../../stores/translationStore'
import { useProjectStore } from '../../stores/projectStore'
import { startVideoExport } from '../../services/exportService'
import api from '../../services/api'
import toast from 'react-hot-toast'
import type { SubtitlePresetName, SubtitleEffect } from '../../types/project'

const EFFECTS: { value: SubtitleEffect; label: string; desc: string }[] = [
  { value: 'none', label: 'None', desc: 'Standard subtitles' },
  { value: 'fade', label: 'Fade', desc: 'Fade in/out' },
  { value: 'typewriter', label: 'Typewriter', desc: 'Letter by letter reveal' },
  { value: 'pop', label: 'Pop-in', desc: 'Scale up entrance' },
]

function useExportSegments() {
  const segments = useTranscriptionStore((s) => s.segments)
  const activeTranslations = useTranslationStore(selectActiveTranslations)
  const useTranslation = useExportStore((s) => s.options.useTranslation)

  return () =>
    segments.map((s) => {
      let text = s.text
      if (useTranslation && activeTranslations) {
        const t = activeTranslations.get(s.id)
        if (t?.translatedText) text = t.translatedText
      }
      return {
        id: s.id,
        start: s.start,
        end: s.end,
        text,
        words: s.words.map((w) => ({ start: w.start, end: w.end, word: w.word })),
      }
    })
}

export default function ExportPanel() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const tracks = useTranslationStore((s) => s.tracks)
  const activeTrack = useTranslationStore((s) => s.activeTrack)
  const { options, setOptions, activePreset, isExporting, progress } = useExportStore()
  const applyPreset = useExportStore((s) => s.applyPreset)
  const setStyle = useExportStore((s) => s.setStyle)
  const setCurrentFormat = useExportStore((s) => s.setCurrentFormat)
  const currentFormat = useExportStore((s) => s.currentFormat)
  const getExportSegments = useExportSegments()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const trackLanguages = Array.from(tracks.keys())

  const handleExportSubtitle = async (format: 'srt' | 'vtt' | 'ass') => {
    if (!window.electronAPI) return
    const outputPath = await window.electronAPI.saveFile(`subtitles.${format}`)
    if (!outputPath) return

    useExportStore.getState().setIsExporting(true)
    setCurrentFormat(format)

    try {
      const segs = getExportSegments()
      await api.exportSubtitle({
        segments: segs.map(({ id, start, end, text }) => ({ id, start, end, text })),
        format,
        use_translation: false,
        output_path: outputPath,
      })
      toast.success(`${format.toUpperCase()} file exported!`)
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`)
    } finally {
      useExportStore.getState().setIsExporting(false)
      setCurrentFormat(null)
    }
  }

  const handleExportVideo = async (karaoke: boolean) => {
    if (!window.electronAPI || !videoPath) return
    const outputPath = await window.electronAPI.saveFile(
      karaoke ? 'karaoke_output.mp4' : 'subtitled_output.mp4'
    )
    if (!outputPath) return

    setCurrentFormat(karaoke ? 'karaoke' : 'video')

    await startVideoExport({
      videoPath,
      segments: getExportSegments(),
      subtitleStyle: {
        font_family: options.style.fontFamily,
        font_size: options.style.fontSize,
        primary_color: options.style.primaryColor,
        outline_color: options.style.outlineColor,
        outline_width: options.style.outlineWidth,
        position: options.style.position,
        margin_v: options.style.marginV,
        bold: options.style.bold,
        italic: options.style.italic,
        background_color: options.style.backgroundColor,
        background_opacity: options.style.backgroundOpacity,
        effect: options.subtitleEffect,
      },
      karaoke,
      outputPath,
      videoCodec: options.videoCodec,
      crf: options.crf,
    })
  }

  return (
    <div className="space-y-6">
      {/* Subtitle file exports */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText size={18} />
          Subtitle Files
        </h3>

        {trackLanguages.length > 1 && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Export Language Track</label>
            <select
              value={activeTrack || ''}
              onChange={(e) => useTranslationStore.getState().setActiveTrack(e.target.value || null)}
              className="input-field w-full text-sm"
            >
              <option value="">Original</option>
              {trackLanguages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {(['srt', 'vtt', 'ass'] as const).map((format) => (
            <button
              key={format}
              onClick={() => handleExportSubtitle(format)}
              disabled={isExporting}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              {isExporting && currentFormat === format ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Download size={14} />
              )}
              Export .{format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Video exports */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Film size={18} />
          Burned-in Video
        </h3>

        {/* Style presets */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">
            <Palette size={12} className="inline mr-1" />
            Style Preset
          </label>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(SUBTITLE_PRESETS) as [SubtitlePresetName, typeof SUBTITLE_PRESETS['default']][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`text-xs px-3 py-1.5 rounded transition-colors ${
                    activePreset === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Style options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Font</label>
            <select
              value={options.style.fontFamily}
              onChange={(e) => setStyle({ fontFamily: e.target.value })}
              className="input-field w-full text-sm"
            >
              {['Arial', 'Roboto', 'Noto Sans', 'Open Sans', 'Georgia', 'Courier New'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Font Size</label>
            <input
              type="number"
              value={options.style.fontSize}
              onChange={(e) => setStyle({ fontSize: parseInt(e.target.value) || 24 })}
              className="input-field w-full text-sm"
              min={12}
              max={72}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Text Color</label>
            <input
              type="color"
              value={options.style.primaryColor}
              onChange={(e) => setStyle({ primaryColor: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Outline Color</label>
            <input
              type="color"
              value={options.style.outlineColor}
              onChange={(e) => setStyle({ outlineColor: e.target.value })}
              className="w-full h-9 rounded cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced options
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700">
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500">Bold</label>
              <button
                onClick={() => setStyle({ bold: !options.style.bold })}
                className={`px-2 py-1 text-xs rounded ${options.style.bold ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                B
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500">Italic</label>
              <button
                onClick={() => setStyle({ italic: !options.style.italic })}
                className={`px-2 py-1 text-xs rounded italic ${options.style.italic ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                I
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Outline Width</label>
              <input
                type="number"
                value={options.style.outlineWidth}
                onChange={(e) => setStyle({ outlineWidth: parseInt(e.target.value) || 2 })}
                className="input-field w-full text-sm"
                min={0}
                max={10}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Margin V</label>
              <input
                type="number"
                value={options.style.marginV}
                onChange={(e) => setStyle({ marginV: parseInt(e.target.value) || 30 })}
                className="input-field w-full text-sm"
                min={0}
                max={200}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Background Color</label>
              <input
                type="color"
                value={options.style.backgroundColor}
                onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                className="w-full h-9 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Background Opacity</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={options.style.backgroundOpacity}
                onChange={(e) => setStyle({ backgroundOpacity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <span className="text-xs text-slate-500">{Math.round(options.style.backgroundOpacity * 100)}%</span>
            </div>
          </div>
        )}

        {/* Subtitle effects */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Subtitle Effect</label>
          <div className="grid grid-cols-4 gap-2">
            {EFFECTS.map((effect) => (
              <button
                key={effect.value}
                onClick={() => setOptions({ subtitleEffect: effect.value })}
                className={`text-xs px-2 py-2 rounded text-center transition-colors ${
                  options.subtitleEffect === effect.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={effect.desc}
              >
                {effect.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleExportVideo(false)}
            disabled={isExporting || !videoPath}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isExporting && currentFormat === 'video' ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Encoding... {progress > 0 ? `${Math.round(progress)}%` : ''}
              </>
            ) : (
              <>
                <Film size={14} />
                Export Subtitled Video
              </>
            )}
          </button>

          <button
            onClick={() => handleExportVideo(true)}
            disabled={isExporting || !videoPath}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {isExporting && currentFormat === 'karaoke' ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Encoding... {progress > 0 ? `${Math.round(progress)}%` : ''}
              </>
            ) : (
              <>
                <Music size={14} />
                Export Karaoke Video
              </>
            )}
          </button>
        </div>

        {isExporting && (currentFormat === 'video' || currentFormat === 'karaoke') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {progress > 0 ? `Encoding video... ${Math.round(progress)}%` : 'Starting encoder...'}
              </span>
              <span className="text-blue-400 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Use translation toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Use translated text</p>
            <p className="text-xs text-slate-500">
              Export translated subtitles instead of original
              {activeTrack && ` (${activeTrack})`}
            </p>
          </div>
          <button
            onClick={() => setOptions({ useTranslation: !options.useTranslation })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              options.useTranslation ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                options.useTranslation ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
