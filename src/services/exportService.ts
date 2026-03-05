import { useExportStore } from '../stores/exportStore'
import api from './api'
import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'

interface ExportVideoParams {
  videoPath: string
  segments: Array<{ id: string; start: number; end: number; text: string; words?: Array<{ start: number; end: number; word: string }> }>
  subtitleStyle: Record<string, unknown>
  karaoke: boolean
  outputPath: string
  videoCodec: string
  crf: number
}

export async function startVideoExport(params: ExportVideoParams): Promise<void> {
  const store = useExportStore.getState()
  store.setIsExporting(true)
  store.setProgress(0)

  try {
    const result = await api.exportVideo({
      video_path: params.videoPath,
      segments: params.segments,
      subtitle_style: params.subtitleStyle,
      karaoke: params.karaoke,
      use_translation: false,
      output_path: params.outputPath,
      video_codec: params.videoCodec,
      crf: params.crf,
    })

    store.setTaskId(result.task_id)
    pollExportResult(result.task_id, params.karaoke)
  } catch {
    toast.error('Video export failed to start')
    resetExportState()
  }
}

function pollExportResult(taskId: string, karaoke: boolean) {
  let errorCount = 0
  const store = useExportStore.getState

  const poll = setInterval(async () => {
    try {
      const data = await api.getExportResult(taskId)
      errorCount = 0

      if (data.path) {
        clearInterval(poll)
        resetExportState()
        store().setProgress(100)
        toast.success(karaoke ? 'Karaoke video exported!' : 'Subtitled video exported!')
      } else if (data.progress > 0) {
        store().setProgress(data.progress)
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      if (axiosErr?.response?.status === 500) {
        clearInterval(poll)
        const errorMsg = axiosErr.response?.data?.detail || 'Video export failed'
        resetExportState()
        toast.error(errorMsg, { duration: 8000 })
      } else {
        errorCount++
        if (errorCount > 30) {
          clearInterval(poll)
          resetExportState()
          toast.error('Lost connection to backend during export.')
        }
      }
    }
  }, 2000)
}

function resetExportState() {
  const store = useExportStore.getState()
  store.setIsExporting(false)
  store.setProgress(0)
  store.setTaskId(null)
  store.setCurrentFormat(null)
}
