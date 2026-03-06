import axios from 'axios'
import type { HealthResponse } from '../types/api'

let baseURL = 'http://127.0.0.1:8321'

export function setApiPort(port: number) {
  baseURL = `http://127.0.0.1:${port}`
}

export async function initApi() {
  if (window.electronAPI) {
    const port = await window.electronAPI.getPythonPort()
    setApiPort(port)
  }
}

const api = {
  get baseURL() {
    return baseURL
  },

  async health(): Promise<HealthResponse> {
    const res = await axios.get(`${baseURL}/api/health`)
    return res.data
  },

  async gpuInfo() {
    const res = await axios.get(`${baseURL}/api/gpu-info`)
    return res.data
  },

  async models() {
    const res = await axios.get(`${baseURL}/api/models`)
    return res.data
  },

  async videoInfo(path: string) {
    const res = await axios.post(`${baseURL}/api/video/info`, { path })
    return res.data
  },

  async downloadVideo(url: string, quality = 'best', outputDir?: string) {
    const res = await axios.post(`${baseURL}/api/video/download`, { url, quality, output_dir: outputDir || undefined })
    return res.data
  },

  async transcribe(params: {
    video_path: string
    model: string
    language: string
    device?: string
    compute_type?: string
    vad_filter?: boolean
    engine?: string
    target_lang?: string
  }) {
    const res = await axios.post(`${baseURL}/api/transcribe`, {
      device: 'auto',
      compute_type: 'float16',
      vad_filter: true,
      ...params,
    })
    return res.data
  },

  async getTranscriptionResult(taskId: string) {
    const res = await axios.get(`${baseURL}/api/transcribe/${taskId}/result`)
    return res.data
  },

  async translate(params: {
    segments: Array<{ id: string; text: string }>
    source_lang: string
    target_lang: string
    context_window?: number
    engine?: string
  }) {
    const res = await axios.post(`${baseURL}/api/translate`, {
      context_window: 3,
      ...params,
    })
    return res.data
  },

  async updateSettings(params: { deepl_api_key?: string; gemini_api_key?: string; gemini_model?: string }) {
    const res = await axios.post(`${baseURL}/api/settings`, params)
    return res.data
  },

  async getSettings(): Promise<{ gemini_api_key: string; deepl_api_key: string; gemini_model: string }> {
    const res = await axios.get(`${baseURL}/api/settings`)
    return res.data
  },

  async getTranslationResult(taskId: string) {
    const res = await axios.get(`${baseURL}/api/translate/${taskId}/result`)
    return res.data
  },

  async getTranslationUsage() {
    const res = await axios.get(`${baseURL}/api/translate/usage`)
    return res.data
  },

  async exportSubtitle(params: {
    segments: Array<{ id: string; start: number; end: number; text: string }>
    format: string
    use_translation: boolean
    output_path: string
  }) {
    const res = await axios.post(`${baseURL}/api/export/subtitle`, params)
    return res.data
  },

  async cancelTask(taskId: string) {
    const res = await axios.post(`${baseURL}/api/task/${taskId}/cancel`)
    return res.data
  },

  async saveSession(data: Record<string, unknown>) {
    const res = await axios.post(`${baseURL}/api/session/save`, data)
    return res.data
  },

  async loadSession() {
    const res = await axios.get(`${baseURL}/api/session/load`)
    return res.data
  },

  async getExportResult(taskId: string) {
    const res = await axios.get(`${baseURL}/api/export/video/${taskId}/result`)
    return res.data
  },

  async exportVideo(params: {
    video_path: string
    segments: Array<{ id: string; start: number; end: number; text: string; words?: Array<{ start: number; end: number; word: string }> }>
    subtitle_style: Record<string, unknown>
    karaoke: boolean
    use_translation: boolean
    output_path: string
    video_codec: string
    crf: number
  }) {
    const res = await axios.post(`${baseURL}/api/export/video`, params)
    return res.data
  },

  async importSubtitle(filePath: string, splitDualLanguage = false) {
    const res = await axios.post(`${baseURL}/api/import/subtitle`, {
      file_path: filePath,
      split_dual_language: splitDualLanguage,
    })
    return res.data
  },

  async timingShift(params: {
    segments: Array<{ id: string; start: number; end: number; text: string; words: Array<{ start: number; end: number; word: string; probability?: number }> }>
    shift_ms: number
    fix_overlaps: boolean
  }) {
    const res = await axios.post(`${baseURL}/api/timing/shift`, params)
    return res.data
  },

  async renderEDL(params: {
    video_path: string
    edl: Array<{ source_start: number; source_end: number }>
    output_path: string
    video_codec?: string
    crf?: number
  }) {
    const res = await axios.post(`${baseURL}/api/edit/render`, params)
    return res.data
  },

  async trimVideo(params: {
    video_path: string
    start: number
    end: number
    output_path: string
    video_codec?: string
    crf?: number
  }) {
    const res = await axios.post(`${baseURL}/api/edit/trim`, params)
    return res.data
  },

  async detectScenes(params: {
    video_path: string
    threshold?: number
    min_scene_duration?: number
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/scenes`, params)
    return res.data as { scenes: Array<{ time: number }>; count: number }
  },

  async detectSilence(params: {
    video_path: string
    noise_threshold?: string
    min_silence_duration?: number
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/silence`, params)
    return res.data as { regions: Array<{ start: number; end: number; duration: number }>; count: number }
  },

  async detectHighlights(params: {
    segments: Array<{ id: string; start: number; end: number; text: string; words: Array<{ start: number; end: number; word: string; probability?: number }> }>
    max_highlights?: number
    min_clip_duration?: number
    max_clip_duration?: number
    context?: string
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/highlights`, params)
    return res.data as {
      highlights: Array<{ start: number; end: number; title: string; reason: string; score: number }>
      count: number
    }
  },

  async applyEffects(params: {
    video_path: string
    output_path: string
    effects: Record<string, unknown>
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/effects`, params)
    return res.data as { task_id: string }
  },

  async removeBackground(params: {
    video_path: string
    output_path: string
    mode?: 'remove' | 'blur' | 'replace'
    bg_color?: string
    bg_image_path?: string
    blur_strength?: number
    model_name?: string
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/background/remove`, params)
    return res.data as { task_id: string }
  },

  async diarize(params: {
    video_path: string
    segments: Array<{ id: string; start: number; end: number; text: string; words: Array<{ start: number; end: number; word: string; probability?: number }> }>
    num_speakers?: number
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/diarize`, params)
    return res.data as { segments: Array<Record<string, unknown>>; speakers: string[] }
  },

  async processAudio(params: {
    video_path: string
    output_path: string
    audio_settings: Record<string, unknown>
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/audio/process`, params)
    return res.data as { task_id: string }
  },

  async colorGrade(params: {
    video_path: string
    output_path: string
    grade_settings: Record<string, unknown>
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/color/grade`, params)
    return res.data as { task_id: string }
  },

  async applyTransition(params: {
    clip_a_path: string
    clip_b_path: string
    output_path: string
    transition_type?: string
    duration?: number
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/transition`, params)
    return res.data as { task_id: string }
  },

  async suggestBRoll(params: {
    segments: Array<{ id: string; start: number; end: number; text: string; words: Array<{ start: number; end: number; word: string; probability?: number }> }>
    max_suggestions?: number
    context?: string
  }) {
    const res = await axios.post(`${baseURL}/api/analysis/broll/suggest`, params)
    return res.data as { suggestions: Array<{ start: number; end: number; search_term: string; reason: string; results: Array<{ url: string; thumbnail: string; duration: number; source: string }> }>; count: number }
  },

  async searchStock(query: string, perPage?: number) {
    const res = await axios.post(`${baseURL}/api/analysis/broll/search`, { query, per_page: perPage || 6 })
    return res.data as { results: Array<{ url: string; thumbnail: string; duration: number; source: string }>; count: number }
  },

  async startBatch(params: {
    jobs: Array<{ video_path: string; operations: string[]; target_language?: string; export_format?: string }>
  }) {
    const res = await axios.post(`${baseURL}/api/batch/start`, params)
    return res.data as { task_id: string }
  },

  async getBatchStatus(taskId: string) {
    const res = await axios.get(`${baseURL}/api/batch/${taskId}/status`)
    return res.data
  },
}

export default api
