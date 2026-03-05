import { useProjectStore } from '../stores/projectStore'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useTranslationStore } from '../stores/translationStore'
import { useExportStore } from '../stores/exportStore'
import { autoStartTranscription } from './transcriptionService'
import toast from 'react-hot-toast'
import type { ProgressEvent } from '../types/api'

type MessageHandler = (msg: ProgressEvent) => void

const handlers: Record<string, MessageHandler> = {
  download(msg) {
    useProjectStore.getState().setDownloadProgress(msg.progress)
  },

  download_complete(msg) {
    useProjectStore.getState().setDownloadProgress(100)
    const videoPath = msg.data?.path as string | undefined
    if (videoPath) {
      useProjectStore.getState().setVideoFile(videoPath)
      toast.success('Video downloaded! Starting transcription...')
      autoStartTranscription(videoPath)
    } else {
      toast.success('Video downloaded successfully!')
    }
  },

  download_error(msg) {
    useProjectStore.getState().setIsVideoLoading(false)
    useProjectStore.getState().setDownloadProgress(0)
    toast.error(`Download failed: ${msg.message || 'Unknown error'}`)
  },

  transcription(msg) {
    const store = useTranscriptionStore.getState()
    if (msg.progress >= store.progress) {
      store.setProgress(msg.progress)
    }
    if (msg.message) {
      store.setStatusMessage(msg.message)
    }
    if (msg.data?.latest_segment) {
      store.appendSegment(msg.data.latest_segment as any)
    }
  },

  transcription_complete() {
    useTranscriptionStore.getState().setProgress(100)
    useTranscriptionStore.getState().setStatusMessage(null)
  },

  transcription_error(msg) {
    const store = useTranscriptionStore.getState()
    store.setIsTranscribing(false)
    store.setProgress(0)
    store.setStatusMessage(null)
    toast.error(`Transcription failed: ${msg.message || 'Unknown error'}`)
  },

  cancelled() {
    useProjectStore.getState().setIsVideoLoading(false)
    useProjectStore.getState().setDownloadProgress(0)
    useTranscriptionStore.getState().setIsTranscribing(false)
    useTranscriptionStore.getState().setProgress(0)
  },

  translation(msg) {
    useTranslationStore.getState().setProgress(msg.progress)
  },

  encoding(msg) {
    const store = useExportStore.getState()
    if (msg.progress >= store.progress) {
      store.setProgress(msg.progress)
    }
  },
}

export function registerHandler(type: string, handler: MessageHandler) {
  handlers[type] = handler
}

export function handleWebSocketMessage(event: MessageEvent) {
  try {
    const msg: ProgressEvent = JSON.parse(event.data)
    const handler = handlers[msg.type]
    if (handler) {
      handler(msg)
    } else {
      console.warn('[WebSocket] Unknown message type:', msg.type)
    }
  } catch (err) {
    console.error('[WebSocket] Failed to parse message:', err)
  }
}
