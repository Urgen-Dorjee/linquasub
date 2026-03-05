import { create } from 'zustand'
import type { VideoMetadata } from '../types/project'

interface ProjectState {
  videoPath: string | null
  videoUrl: string | null
  videoDuration: number
  videoMetadata: VideoMetadata | null
  isVideoLoading: boolean
  downloadProgress: number
  backendReady: boolean
  backendError: string | null

  setVideoFile: (path: string) => void
  setYouTubeUrl: (url: string) => void
  setVideoMetadata: (metadata: VideoMetadata) => void
  setIsVideoLoading: (loading: boolean) => void
  setDownloadProgress: (progress: number) => void
  setBackendReady: (ready: boolean) => void
  setBackendError: (error: string | null) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  videoPath: null,
  videoUrl: null,
  videoDuration: 0,
  videoMetadata: null,
  isVideoLoading: false,
  downloadProgress: 0,
  backendReady: false,
  backendError: null,

  setVideoFile: (path) => set({ videoPath: path, videoUrl: null, isVideoLoading: false }),
  setYouTubeUrl: (url) => set({ videoUrl: url }),
  setVideoMetadata: (metadata) => set({ videoMetadata: metadata, videoDuration: metadata.duration }),
  setIsVideoLoading: (loading) => set({ isVideoLoading: loading }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setBackendReady: (ready) => set({ backendReady: ready }),
  setBackendError: (error) => set({ backendError: error }),
  clearProject: () =>
    set({
      videoPath: null,
      videoUrl: null,
      videoDuration: 0,
      videoMetadata: null,
      isVideoLoading: false,
      downloadProgress: 0,
    }),
}))
