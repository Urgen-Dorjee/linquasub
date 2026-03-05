import { create } from 'zustand'
import type { ExportOptions, SubtitleStyle, SubtitlePresetName, SubtitleEffect } from '../types/project'

const defaultStyle: SubtitleStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  primaryColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 2,
  position: 'bottom',
  marginV: 30,
  bold: false,
  italic: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
}

export const SUBTITLE_PRESETS: Record<SubtitlePresetName, { label: string; style: Partial<SubtitleStyle>; effect: SubtitleEffect }> = {
  default: {
    label: 'Default',
    style: { fontFamily: 'Arial', fontSize: 24, primaryColor: '#FFFFFF', outlineColor: '#000000', outlineWidth: 2, bold: false, italic: false, backgroundColor: '#000000', backgroundOpacity: 0, marginV: 30 },
    effect: 'none',
  },
  netflix: {
    label: 'Netflix',
    style: { fontFamily: 'Noto Sans', fontSize: 28, primaryColor: '#FFFFFF', outlineColor: '#000000', outlineWidth: 3, bold: true, italic: false, backgroundColor: '#000000', backgroundOpacity: 0.5, marginV: 40 },
    effect: 'fade',
  },
  youtube: {
    label: 'YouTube',
    style: { fontFamily: 'Roboto', fontSize: 22, primaryColor: '#FFFFFF', outlineColor: '#000000', outlineWidth: 1, bold: false, italic: false, backgroundColor: '#1a1a1a', backgroundOpacity: 0.7, marginV: 25 },
    effect: 'none',
  },
  cinematic: {
    label: 'Cinematic',
    style: { fontFamily: 'Georgia', fontSize: 30, primaryColor: '#F5E6D3', outlineColor: '#000000', outlineWidth: 2, bold: false, italic: true, backgroundColor: '#000000', backgroundOpacity: 0, marginV: 50 },
    effect: 'fade',
  },
  minimal: {
    label: 'Minimal',
    style: { fontFamily: 'Arial', fontSize: 20, primaryColor: '#CCCCCC', outlineColor: '#333333', outlineWidth: 1, bold: false, italic: false, backgroundColor: '#000000', backgroundOpacity: 0, marginV: 20 },
    effect: 'none',
  },
}

interface ExportState {
  options: ExportOptions
  activePreset: SubtitlePresetName
  isExporting: boolean
  progress: number
  taskId: string | null
  currentFormat: string | null

  setOptions: (options: Partial<ExportOptions>) => void
  setStyle: (style: Partial<SubtitleStyle>) => void
  applyPreset: (preset: SubtitlePresetName) => void
  setIsExporting: (exporting: boolean) => void
  setProgress: (progress: number) => void
  setTaskId: (id: string | null) => void
  setCurrentFormat: (format: string | null) => void
  resetExport: () => void
}

export const useExportStore = create<ExportState>((set) => ({
  options: {
    formats: {
      srt: true,
      vtt: false,
      ass: false,
      burnedVideo: false,
      karaokeVideo: false,
    },
    style: defaultStyle,
    useTranslation: false,
    outputDir: '',
    videoCodec: 'h264',
    crf: 23,
    subtitleEffect: 'none',
  },
  activePreset: 'default',
  isExporting: false,
  progress: 0,
  taskId: null,
  currentFormat: null,

  setOptions: (opts) =>
    set((state) => ({ options: { ...state.options, ...opts } })),

  setStyle: (style) =>
    set((state) => ({
      options: { ...state.options, style: { ...state.options.style, ...style } },
      activePreset: 'default' as SubtitlePresetName, // Reset preset when manually editing
    })),

  applyPreset: (presetName) =>
    set((state) => {
      const preset = SUBTITLE_PRESETS[presetName]
      return {
        options: {
          ...state.options,
          style: { ...state.options.style, ...preset.style },
          subtitleEffect: preset.effect,
        },
        activePreset: presetName,
      }
    }),

  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setProgress: (progress) => set({ progress }),
  setTaskId: (id) => set({ taskId: id }),
  setCurrentFormat: (format) => set({ currentFormat: format }),
  resetExport: () => set({ isExporting: false, progress: 0, taskId: null, currentFormat: null }),
}))
