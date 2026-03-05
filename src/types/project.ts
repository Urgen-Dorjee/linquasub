export interface VideoMetadata {
  duration: number
  resolution: string
  fps: number
  codec: string
  audioCodec: string
  fileSizeMb: number
}

export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  primaryColor: string
  outlineColor: string
  outlineWidth: number
  position: 'bottom' | 'top'
  marginV: number
  bold: boolean
  italic: boolean
  backgroundColor: string
  backgroundOpacity: number
}

export type SubtitlePresetName = 'default' | 'netflix' | 'youtube' | 'cinematic' | 'minimal'

export interface ExportOptions {
  formats: {
    srt: boolean
    vtt: boolean
    ass: boolean
    burnedVideo: boolean
    karaokeVideo: boolean
  }
  style: SubtitleStyle
  useTranslation: boolean
  outputDir: string
  videoCodec: 'h264' | 'h265'
  crf: number
  subtitleEffect: SubtitleEffect
}

export type SubtitleEffect = 'none' | 'fade' | 'typewriter' | 'pop'

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface WhisperModelInfo {
  name: WhisperModelSize
  vramMb: number
  quality: string
  downloaded: boolean
}

export interface GpuInfo {
  gpuName: string
  vramTotalMb: number
  vramUsedMb: number
  cudaAvailable: boolean
  recommendedModel: WhisperModelSize
}
