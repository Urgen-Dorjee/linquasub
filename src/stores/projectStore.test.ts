import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'

function resetStore() {
  useProjectStore.setState({
    videoPath: null,
    videoUrl: null,
    videoDuration: 0,
    videoMetadata: null,
    isVideoLoading: false,
    downloadProgress: 0,
    backendReady: false,
    backendError: null,
  })
}

describe('projectStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('sets video file and clears URL', () => {
    const store = useProjectStore.getState()
    store.setYouTubeUrl('https://youtube.com/watch?v=test')
    store.setVideoFile('/path/to/video.mp4')

    const state = useProjectStore.getState()
    expect(state.videoPath).toBe('/path/to/video.mp4')
    expect(state.videoUrl).toBeNull()
    expect(state.isVideoLoading).toBe(false)
  })

  it('sets video metadata and duration', () => {
    const store = useProjectStore.getState()
    store.setVideoMetadata({
      duration: 120.5,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
    })

    const state = useProjectStore.getState()
    expect(state.videoDuration).toBe(120.5)
    expect(state.videoMetadata?.width).toBe(1920)
  })

  it('clears project state', () => {
    const store = useProjectStore.getState()
    store.setVideoFile('/test.mp4')
    store.setDownloadProgress(50)
    store.clearProject()

    const state = useProjectStore.getState()
    expect(state.videoPath).toBeNull()
    expect(state.videoUrl).toBeNull()
    expect(state.videoDuration).toBe(0)
    expect(state.downloadProgress).toBe(0)
  })

  it('tracks backend status', () => {
    const store = useProjectStore.getState()
    expect(useProjectStore.getState().backendReady).toBe(false)

    store.setBackendReady(true)
    expect(useProjectStore.getState().backendReady).toBe(true)

    store.setBackendError('Connection failed')
    expect(useProjectStore.getState().backendError).toBe('Connection failed')
  })
})
