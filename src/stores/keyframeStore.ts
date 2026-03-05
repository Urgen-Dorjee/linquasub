import { create } from 'zustand'
import type { Keyframe, KeyframeEasing, ClipTransform } from '../types/timeline'
import { useTimelineStore } from './timelineStore'

interface KeyframeState {
  selectedKeyframeId: string | null
  setSelectedKeyframe: (id: string | null) => void

  addKeyframe: (trackId: string, clipId: string, time: number, property: keyof ClipTransform, value: number, easing?: KeyframeEasing) => void
  removeKeyframe: (trackId: string, clipId: string, keyframeId: string) => void
  updateKeyframe: (trackId: string, clipId: string, keyframeId: string, patch: Partial<Keyframe>) => void

  getInterpolatedValue: (trackId: string, clipId: string, property: keyof ClipTransform, time: number) => number | null
}

let kfCounter = 0
function nextKfId(): string {
  return `kf_${++kfCounter}`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easingFn(t: number, easing: KeyframeEasing): number {
  switch (easing) {
    case 'linear': return t
    case 'ease-in': return t * t
    case 'ease-out': return t * (2 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    case 'bezier': return t * t * (3 - 2 * t) // smooth step approximation
    default: return t
  }
}

export const useKeyframeStore = create<KeyframeState>((set) => ({
  selectedKeyframeId: null,
  setSelectedKeyframe: (id) => set({ selectedKeyframeId: id }),

  addKeyframe: (trackId, clipId, time, property, value, easing = 'linear') => {
    const timelineStore = useTimelineStore.getState()
    const track = timelineStore.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    const newKf: Keyframe = {
      id: nextKfId(),
      time,
      property,
      value,
      easing,
    }

    const updatedKeyframes = [...clip.keyframes.filter((kf) =>
      !(kf.property === property && Math.abs(kf.time - time) < 0.01)
    ), newKf].sort((a, b) => a.time - b.time)

    timelineStore.updateClip(trackId, clipId, { keyframes: updatedKeyframes })
  },

  removeKeyframe: (trackId, clipId, keyframeId) => {
    const timelineStore = useTimelineStore.getState()
    const track = timelineStore.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    timelineStore.updateClip(trackId, clipId, {
      keyframes: clip.keyframes.filter((kf) => kf.id !== keyframeId),
    })
  },

  updateKeyframe: (trackId, clipId, keyframeId, patch) => {
    const timelineStore = useTimelineStore.getState()
    const track = timelineStore.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    timelineStore.updateClip(trackId, clipId, {
      keyframes: clip.keyframes.map((kf) =>
        kf.id === keyframeId ? { ...kf, ...patch } : kf
      ),
    })
  },

  getInterpolatedValue: (trackId, clipId, property, time) => {
    const timelineStore = useTimelineStore.getState()
    const track = timelineStore.tracks.find((t) => t.id === trackId)
    if (!track) return null
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return null

    const propKeyframes = clip.keyframes
      .filter((kf) => kf.property === property)
      .sort((a, b) => a.time - b.time)

    if (propKeyframes.length === 0) return null
    if (propKeyframes.length === 1) return propKeyframes[0].value

    // Before first keyframe
    if (time <= propKeyframes[0].time) return propKeyframes[0].value
    // After last keyframe
    if (time >= propKeyframes[propKeyframes.length - 1].time) return propKeyframes[propKeyframes.length - 1].value

    // Find surrounding keyframes
    for (let i = 0; i < propKeyframes.length - 1; i++) {
      const kfA = propKeyframes[i]
      const kfB = propKeyframes[i + 1]
      if (time >= kfA.time && time <= kfB.time) {
        const t = (time - kfA.time) / (kfB.time - kfA.time)
        const easedT = easingFn(t, kfB.easing)
        return lerp(kfA.value, kfB.value, easedT)
      }
    }

    return null
  },
}))
