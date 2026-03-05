export interface HealthResponse {
  status: string
  gpu_available: boolean
  ffmpeg_available: boolean
}

export interface ProgressEvent {
  task_id: string
  type: 'download' | 'download_complete' | 'download_error' | 'transcription' | 'transcription_complete' | 'transcription_error' | 'translation' | 'encoding' | 'model_download' | 'cancelled'
  phase?: string
  progress: number
  message?: string
  data?: Record<string, unknown>
}

export interface TranscribeRequest {
  video_path: string
  model: string
  language: string
  device: string
  compute_type: string
  vad_filter: boolean
  target_lang?: string
}

export interface TranslateRequest {
  segments: Array<{ id: string; text: string }>
  source_lang: string
  target_lang: string
  context_window: number
}

export interface ExportSubtitleRequest {
  segments: Array<{ id: string; start: number; end: number; text: string }>
  format: 'srt' | 'vtt' | 'ass'
  use_translation: boolean
  output_path: string
}

export interface ExportVideoRequest {
  video_path: string
  segments: Array<{ id: string; start: number; end: number; text: string; words?: Array<{ start: number; end: number; word: string }> }>
  subtitle_style: {
    font_family: string
    font_size: number
    primary_color: string
    outline_color: string
    outline_width: number
    position: string
    margin_v: number
  }
  karaoke: boolean
  use_translation: boolean
  output_path: string
  video_codec: string
  crf: number
}
