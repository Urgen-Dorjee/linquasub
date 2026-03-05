import { describe, it, expect, beforeEach } from 'vitest'
import { useKeyframeStore } from './keyframeStore'
import { useTimelineStore } from './timelineStore'

function setup() {
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
  })
  useTimelineStore.getState().initFromVideo('/test.mp4', 10)
}

describe('keyframeStore', () => {
  beforeEach(() => {
    setup()
  })

  function getTrackAndClip() {
    const state = useTimelineStore.getState()
    return { trackId: state.tracks[0].id, clipId: state.tracks[0].clips[0].id }
  }

  describe('addKeyframe', () => {
    it('adds a keyframe to a clip', () => {
      const { trackId, clipId } = getTrackAndClip()
      useKeyframeStore.getState().addKeyframe(trackId, clipId, 2.0, 'opacity', 0.5)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.keyframes).toHaveLength(1)
      expect(clip.keyframes[0].time).toBe(2.0)
      expect(clip.keyframes[0].property).toBe('opacity')
      expect(clip.keyframes[0].value).toBe(0.5)
      expect(clip.keyframes[0].easing).toBe('linear')
    })

    it('replaces keyframe at same time and property', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 2.0, 'opacity', 0.5)
      kf.addKeyframe(trackId, clipId, 2.0, 'opacity', 0.8)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.keyframes).toHaveLength(1)
      expect(clip.keyframes[0].value).toBe(0.8)
    })

    it('keeps keyframes sorted by time', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 5.0, 'x', 100)
      kf.addKeyframe(trackId, clipId, 1.0, 'x', 0)
      kf.addKeyframe(trackId, clipId, 3.0, 'x', 50)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.keyframes.map((k) => k.time)).toEqual([1.0, 3.0, 5.0])
    })
  })

  describe('removeKeyframe', () => {
    it('removes a keyframe by id', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 2.0, 'opacity', 0.5)
      const keyframeId = useTimelineStore.getState().tracks[0].clips[0].keyframes[0].id

      kf.removeKeyframe(trackId, clipId, keyframeId)

      const clip = useTimelineStore.getState().tracks[0].clips[0]
      expect(clip.keyframes).toHaveLength(0)
    })
  })

  describe('getInterpolatedValue', () => {
    it('returns null when no keyframes exist', () => {
      const { trackId, clipId } = getTrackAndClip()
      const result = useKeyframeStore.getState().getInterpolatedValue(trackId, clipId, 'opacity', 5)
      expect(result).toBeNull()
    })

    it('returns the single keyframe value for any time', () => {
      const { trackId, clipId } = getTrackAndClip()
      useKeyframeStore.getState().addKeyframe(trackId, clipId, 5.0, 'opacity', 0.5)

      const kf = useKeyframeStore.getState()
      expect(kf.getInterpolatedValue(trackId, clipId, 'opacity', 0)).toBe(0.5)
      expect(kf.getInterpolatedValue(trackId, clipId, 'opacity', 5)).toBe(0.5)
      expect(kf.getInterpolatedValue(trackId, clipId, 'opacity', 10)).toBe(0.5)
    })

    it('linearly interpolates between two keyframes', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 0, 'x', 0)
      kf.addKeyframe(trackId, clipId, 10, 'x', 100)

      const result = kf.getInterpolatedValue(trackId, clipId, 'x', 5)
      expect(result).toBe(50)
    })

    it('returns boundary value before first keyframe', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 5, 'x', 100)
      kf.addKeyframe(trackId, clipId, 10, 'x', 200)

      expect(kf.getInterpolatedValue(trackId, clipId, 'x', 0)).toBe(100)
    })

    it('returns boundary value after last keyframe', () => {
      const { trackId, clipId } = getTrackAndClip()
      const kf = useKeyframeStore.getState()

      kf.addKeyframe(trackId, clipId, 0, 'x', 0)
      kf.addKeyframe(trackId, clipId, 5, 'x', 100)

      expect(kf.getInterpolatedValue(trackId, clipId, 'x', 10)).toBe(100)
    })
  })
})
