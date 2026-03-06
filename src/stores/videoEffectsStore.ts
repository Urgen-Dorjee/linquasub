import { create } from 'zustand'

export interface EffectsState {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  vignette: boolean
  grayscale: boolean
  sepia: boolean
  fadeIn: number
  fadeOut: number
}

export interface ColorGradeState {
  temperature: number
  tint: number
  exposure: number
  shadows: { r: number; g: number; b: number }
  midtones: { r: number; g: number; b: number }
  highlights: { r: number; g: number; b: number }
}

export interface AudioMixState {
  volume: number
  noiseReduction: number
  bass: number
  mid: number
  treble: number
  normalize: boolean
}

interface VideoEffectsStore {
  effects: EffectsState
  colorGrade: ColorGradeState
  audioMix: AudioMixState

  setEffect: (patch: Partial<EffectsState>) => void
  setColorGrade: (patch: Partial<ColorGradeState>) => void
  setAudioMix: (patch: Partial<AudioMixState>) => void
  resetEffects: () => void
  resetColorGrade: () => void
  resetAudioMix: () => void
  resetAll: () => void

  getCssFilter: () => string
}

const DEFAULT_EFFECTS: EffectsState = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  blur: 0,
  vignette: false,
  grayscale: false,
  sepia: false,
  fadeIn: 0,
  fadeOut: 0,
}

const DEFAULT_COLOR_GRADE: ColorGradeState = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  shadows: { r: 1, g: 1, b: 1 },
  midtones: { r: 1, g: 1, b: 1 },
  highlights: { r: 1, g: 1, b: 1 },
}

const DEFAULT_AUDIO_MIX: AudioMixState = {
  volume: 1,
  noiseReduction: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  normalize: false,
}

export const useVideoEffectsStore = create<VideoEffectsStore>((set, get) => ({
  effects: { ...DEFAULT_EFFECTS },
  colorGrade: { ...DEFAULT_COLOR_GRADE },
  audioMix: { ...DEFAULT_AUDIO_MIX },

  setEffect: (patch) => set((s) => ({ effects: { ...s.effects, ...patch } })),
  setColorGrade: (patch) => set((s) => ({ colorGrade: { ...s.colorGrade, ...patch } })),
  setAudioMix: (patch) => set((s) => ({ audioMix: { ...s.audioMix, ...patch } })),

  resetEffects: () => set({ effects: { ...DEFAULT_EFFECTS } }),
  resetColorGrade: () => set({ colorGrade: { ...DEFAULT_COLOR_GRADE } }),
  resetAudioMix: () => set({ audioMix: { ...DEFAULT_AUDIO_MIX } }),
  resetAll: () => set({
    effects: { ...DEFAULT_EFFECTS },
    colorGrade: { ...DEFAULT_COLOR_GRADE },
    audioMix: { ...DEFAULT_AUDIO_MIX },
  }),

  getCssFilter: () => {
    const { effects, colorGrade } = get()
    const parts: string[] = []

    // Brightness: CSS uses 1.0 as baseline, our slider is -1 to 1 offset
    parts.push(`brightness(${1 + effects.brightness})`)
    parts.push(`contrast(${effects.contrast})`)
    parts.push(`saturate(${effects.saturation})`)

    if (effects.blur > 0) parts.push(`blur(${effects.blur}px)`)
    if (effects.grayscale) parts.push('grayscale(1)')
    if (effects.sepia) parts.push('sepia(1)')

    // Color temperature: warm = more sepia-ish, cool = more blue via hue-rotate
    if (colorGrade.temperature !== 0) {
      // Positive = warm (shift toward orange), negative = cool (shift toward blue)
      parts.push(`sepia(${Math.abs(colorGrade.temperature) * 0.3})`)
      if (colorGrade.temperature < 0) {
        parts.push(`hue-rotate(${180 + colorGrade.temperature * 30}deg)`)
      } else {
        parts.push(`hue-rotate(${colorGrade.temperature * -10}deg)`)
      }
    }

    // Tint via hue-rotate
    if (colorGrade.tint !== 0) {
      parts.push(`hue-rotate(${colorGrade.tint * 30}deg)`)
    }

    // Exposure as additional brightness
    if (colorGrade.exposure !== 0) {
      parts.push(`brightness(${1 + colorGrade.exposure * 0.5})`)
    }

    return parts.join(' ')
  },
}))
