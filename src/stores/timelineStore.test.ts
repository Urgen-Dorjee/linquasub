import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from './timelineStore'

function resetStore() {
  useTimelineStore.setState({
    tracks: [],
    playhead: 0,
    zoom: 100,
    scrollX: 0,
    duration: 0,
    selection: { clipIds: [], trackId: null },
    activeTool: 'select',
    snapEnabled: true,
    isPlaying: false,
    _history: [],
    _historyIndex: -1,
  })
}

describe('timelineStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('initFromVideo', () => {
    it('creates default tracks with video, audio, and subtitle', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test/video.mp4', 120)

      const state = useTimelineStore.getState()
      expect(state.tracks).toHaveLength(3)
      expect(state.tracks[0].type).toBe('video')
      expect(state.tracks[1].type).toBe('audio')
      expect(state.tracks[2].type).toBe('subtitle')
      expect(state.duration).toBe(120)
    })

    it('creates clips with correct default properties', () => {
      useTimelineStore.getState().initFromVideo('/test/video.mp4', 60)
      const state = useTimelineStore.getState()

      const videoClip = state.tracks[0].clips[0]
      expect(videoClip.speed).toBe(1)
      expect(videoClip.reverse).toBe(false)
      expect(videoClip.volume).toBe(1)
      expect(videoClip.transform.opacity).toBe(1)
      expect(videoClip.keyframes).toEqual([])
      expect(videoClip.duration).toBe(60)
      expect(videoClip.sourceStart).toBe(0)
      expect(videoClip.sourceEnd).toBe(60)
    })
  })

  describe('addVideoTrack / addAudioTrack', () => {
    it('adds a video track with correct defaults', () => {
      useTimelineStore.getState().addVideoTrack()
      const state = useTimelineStore.getState()

      expect(state.tracks).toHaveLength(1)
      expect(state.tracks[0].type).toBe('video')
      expect(state.tracks[0].label).toBe('Video 1')
      expect(state.tracks[0].blendMode).toBe('normal')
      expect(state.tracks[0].clips).toEqual([])
    })

    it('increments track number labels', () => {
      const s = useTimelineStore.getState()
      s.addAudioTrack()
      s.addAudioTrack()

      const state = useTimelineStore.getState()
      expect(state.tracks[0].label).toBe('Audio 1')
      expect(state.tracks[1].label).toBe('Audio 2')
    })
  })

  describe('splitClip', () => {
    it('splits a clip into two at the given time', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, 4)

      const clips = useTimelineStore.getState().tracks[0].clips
      expect(clips).toHaveLength(2)
      expect(clips[0].duration).toBe(4)
      expect(clips[0].sourceEnd).toBe(4)
      expect(clips[1].timelineStart).toBe(4)
      expect(clips[1].duration).toBe(6)
      expect(clips[1].sourceStart).toBe(4)
    })

    it('does nothing when split time is outside clip bounds', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, -1)
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(1)

      store.splitClip(trackId, clipId, 11)
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(1)
    })
  })

  describe('setClipSpeed', () => {
    it('adjusts clip duration based on speed', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.setClipSpeed(trackId, clipId, 2)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.speed).toBe(2)
      expect(clip.duration).toBe(5) // 10s source / 2x speed = 5s
    })

    it('clamps speed to valid range', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.setClipSpeed(trackId, clipId, 0.01) // below minimum
      expect(useTimelineStore.getState().tracks[0].clips[0].speed).toBe(0.1)

      store.setClipSpeed(trackId, clipId, 100) // above maximum
      expect(useTimelineStore.getState().tracks[0].clips[0].speed).toBe(10)
    })
  })

  describe('duplicateClip', () => {
    it('creates a copy placed after the original', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.duplicateClip(trackId, clipId)

      const clips = useTimelineStore.getState().tracks[0].clips
      expect(clips).toHaveLength(2)
      expect(clips[1].timelineStart).toBe(10) // placed right after
      expect(clips[1].duration).toBe(10)
      expect(clips[1].id).not.toBe(clips[0].id)
    })
  })

  describe('moveClip', () => {
    it('moves a clip to a new position on the same track', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.moveClip(trackId, trackId, clipId, 5)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.timelineStart).toBe(5)
    })

    it('clamps position to minimum 0', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.moveClip(trackId, trackId, clipId, -5)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.timelineStart).toBe(0)
    })
  })

  describe('getEditDecisionList', () => {
    it('returns EDL with speed and reverse info', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.setClipSpeed(trackId, clipId, 2)
      store.setClipReverse(trackId, clipId, true)

      const edl = useTimelineStore.getState().getEditDecisionList()
      expect(edl).toHaveLength(1)
      expect(edl[0].speed).toBe(2)
      expect(edl[0].reverse).toBe(true)
    })
  })

  describe('zoom', () => {
    it('clamps zoom to valid range', () => {
      const store = useTimelineStore.getState()

      store.setZoom(5)
      expect(useTimelineStore.getState().zoom).toBe(10) // minimum

      store.setZoom(600)
      expect(useTimelineStore.getState().zoom).toBe(500) // maximum
    })
  })

  describe('removeClip', () => {
    it('removes clip and clears selection if selected', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.setSelection({ clipIds: [clipId], trackId })
      store.removeClip(trackId, clipId)

      const state = useTimelineStore.getState()
      expect(state.tracks[0].clips).toHaveLength(0)
      expect(state.selection.clipIds).toHaveLength(0)
    })
  })

  describe('undo / redo', () => {
    it('undoes a splitClip and restores original clip', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, 5)
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(2)

      store.undo()
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(1)
      expect(useTimelineStore.getState().tracks[0].clips[0].duration).toBe(10)
    })

    it('redoes after undo', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, 5)
      store.undo()
      store.redo()

      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(2)
    })

    it('canUndo returns false when no history', () => {
      expect(useTimelineStore.getState().canUndo()).toBe(false)
    })

    it('canRedo returns false when at latest state', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, 5)
      expect(useTimelineStore.getState().canRedo()).toBe(false)
    })

    it('undoes removeClip', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.removeClip(trackId, clipId)
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(0)

      store.undo()
      expect(useTimelineStore.getState().tracks[0].clips).toHaveLength(1)
    })

    it('clears redo stack when new history-pushing action is performed after undo', () => {
      const store = useTimelineStore.getState()
      store.initFromVideo('/test.mp4', 10)

      const trackId = useTimelineStore.getState().tracks[0].id
      const clipId = useTimelineStore.getState().tracks[0].clips[0].id

      store.splitClip(trackId, clipId, 5)
      store.undo()
      expect(useTimelineStore.getState().canRedo()).toBe(true)

      // Duplicate pushes history, which truncates forward redo stack
      const currentClipId = useTimelineStore.getState().tracks[0].clips[0].id
      store.duplicateClip(trackId, currentClipId)
      expect(useTimelineStore.getState().canRedo()).toBe(false)
    })
  })
})
