import { create } from 'zustand'
import type { TimelineTrack, TimelineClip, TimelineTool, TimelineSelection, BlendMode } from '../types/timeline'
import { createDefaultTransform } from '../types/timeline'

interface TimelineState {
  tracks: TimelineTrack[]
  playhead: number
  zoom: number // pixels per second
  scrollX: number
  duration: number
  selection: TimelineSelection
  activeTool: TimelineTool
  snapEnabled: boolean
  isPlaying: boolean

  // Track actions
  setTracks: (tracks: TimelineTrack[]) => void
  addTrack: (track: TimelineTrack) => void
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  addVideoTrack: () => void
  addAudioTrack: () => void
  addSubtitleTrack: () => void
  setTrackBlendMode: (trackId: string, mode: BlendMode) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void

  // Clip actions
  addClip: (trackId: string, clip: TimelineClip) => void
  removeClip: (trackId: string, clipId: string) => void
  updateClip: (trackId: string, clipId: string, patch: Partial<TimelineClip>) => void
  splitClip: (trackId: string, clipId: string, splitTime: number) => void
  moveClip: (fromTrackId: string, toTrackId: string, clipId: string, newTimelineStart: number) => void
  trimClipStart: (trackId: string, clipId: string, newStart: number) => void
  trimClipEnd: (trackId: string, clipId: string, newEnd: number) => void
  setClipSpeed: (trackId: string, clipId: string, speed: number) => void
  setClipReverse: (trackId: string, clipId: string, reverse: boolean) => void
  setClipVolume: (trackId: string, clipId: string, volume: number) => void
  duplicateClip: (trackId: string, clipId: string) => void

  // Playback / view
  setPlayhead: (time: number) => void
  setZoom: (zoom: number) => void
  setScrollX: (scrollX: number) => void
  setDuration: (duration: number) => void
  setSelection: (selection: TimelineSelection) => void
  setActiveTool: (tool: TimelineTool) => void
  setSnapEnabled: (enabled: boolean) => void
  setIsPlaying: (playing: boolean) => void

  initFromVideo: (videoPath: string, duration: number) => void
  getEditDecisionList: () => Array<{ sourceStart: number; sourceEnd: number; timelineStart: number; speed: number; reverse: boolean }>

  // Undo/Redo
  _history: TimelineTrack[][]
  _historyIndex: number
  _pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

let clipIdCounter = 0
function nextClipId(): string {
  return `clip_${++clipIdCounter}`
}

let trackIdCounter = 0
function createTrackId(type: string): string {
  return `track_${type}_${++trackIdCounter}_${Date.now()}`
}

function countTracksByType(tracks: TimelineTrack[], type: string): number {
  return tracks.filter((t) => t.type === type).length
}

function makeDefaultClip(overrides: Partial<TimelineClip> & Pick<TimelineClip, 'id' | 'trackId' | 'sourceStart' | 'sourceEnd' | 'timelineStart' | 'duration'>): TimelineClip {
  return {
    speed: 1,
    reverse: false,
    volume: 1,
    transform: createDefaultTransform(),
    keyframes: [],
    ...overrides,
  }
}

const MAX_HISTORY = 50

function deepCloneTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return JSON.parse(JSON.stringify(tracks))
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
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

  _pushHistory: () => {
    const state = get()
    const snapshot = deepCloneTracks(state.tracks)
    const newHistory = state._history.slice(0, state._historyIndex + 1)
    newHistory.push(snapshot)
    if (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ _history: newHistory, _historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const state = get()
    if (state._historyIndex < 0) return
    // Save current state if at the end
    if (state._historyIndex === state._history.length - 1) {
      const current = deepCloneTracks(state.tracks)
      const newHistory = [...state._history, current]
      set({ tracks: state._history[state._historyIndex], _history: newHistory, _historyIndex: state._historyIndex - 1 })
    } else {
      set({ tracks: state._history[state._historyIndex], _historyIndex: state._historyIndex - 1 })
    }
  },

  redo: () => {
    const state = get()
    if (state._historyIndex >= state._history.length - 1) return
    const nextIndex = state._historyIndex + 2
    if (nextIndex < state._history.length) {
      set({ tracks: state._history[nextIndex], _historyIndex: state._historyIndex + 1 })
    }
  },

  canUndo: () => {
    const state = get()
    return state._historyIndex >= 0
  },

  canRedo: () => {
    const state = get()
    return state._historyIndex < state._history.length - 2
  },

  setTracks: (tracks) => set({ tracks }),

  addTrack: (track) => { get()._pushHistory(); set((s) => ({ tracks: [...s.tracks, track] })) },

  removeTrack: (trackId) => { get()._pushHistory(); set((s) => ({
    tracks: s.tracks.filter((t) => t.id !== trackId),
  })) },

  updateTrack: (trackId, patch) => set((s) => ({
    tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
  })),

  addVideoTrack: () => {
    const state = get()
    const num = countTracksByType(state.tracks, 'video') + 1
    const id = createTrackId('video')
    set((s) => ({
      tracks: [...s.tracks, {
        id,
        type: 'video' as const,
        label: `Video ${num}`,
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 60,
        blendMode: 'normal' as const,
      }],
    }))
  },

  addAudioTrack: () => {
    const state = get()
    const num = countTracksByType(state.tracks, 'audio') + 1
    const id = createTrackId('audio')
    set((s) => ({
      tracks: [...s.tracks, {
        id,
        type: 'audio' as const,
        label: `Audio ${num}`,
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 40,
        blendMode: 'normal' as const,
      }],
    }))
  },

  addSubtitleTrack: () => {
    const state = get()
    const num = countTracksByType(state.tracks, 'subtitle') + 1
    const id = createTrackId('subtitle')
    set((s) => ({
      tracks: [...s.tracks, {
        id,
        type: 'subtitle' as const,
        label: `Subtitles ${num}`,
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 36,
        blendMode: 'normal' as const,
      }],
    }))
  },

  setTrackBlendMode: (trackId, mode) => set((s) => ({
    tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, blendMode: mode } : t)),
  })),

  reorderTracks: (fromIndex, toIndex) => set((s) => {
    const tracks = [...s.tracks]
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    return { tracks }
  }),

  addClip: (trackId, clip) => set((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.timelineStart - b.timelineStart) } : t
    ),
  })),

  removeClip: (trackId, clipId) => { get()._pushHistory(); set((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t
    ),
    selection: s.selection.clipIds.includes(clipId)
      ? { clipIds: s.selection.clipIds.filter((id) => id !== clipId), trackId: s.selection.trackId }
      : s.selection,
  })) },

  updateClip: (trackId, clipId, patch) => set((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId
        ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
        : t
    ),
  })),

  splitClip: (trackId, clipId, splitTime) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    const relativeTime = splitTime - clip.timelineStart
    if (relativeTime <= 0 || relativeTime >= clip.duration) return
    state._pushHistory()

    const clipA: TimelineClip = {
      ...clip,
      id: nextClipId(),
      duration: relativeTime,
      sourceEnd: clip.sourceStart + relativeTime / clip.speed,
      keyframes: clip.keyframes.filter((kf) => kf.time < splitTime),
    }
    const clipB: TimelineClip = {
      ...clip,
      id: nextClipId(),
      trackId,
      sourceStart: clip.sourceStart + relativeTime / clip.speed,
      sourceEnd: clip.sourceEnd,
      timelineStart: clip.timelineStart + relativeTime,
      duration: clip.duration - relativeTime,
      keyframes: clip.keyframes
        .filter((kf) => kf.time >= splitTime)
        .map((kf) => ({ ...kf, time: kf.time - relativeTime })),
    }

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips
                .filter((c) => c.id !== clipId)
                .concat([clipA, clipB])
                .sort((a, b) => a.timelineStart - b.timelineStart),
            }
          : t
      ),
    }))
  },

  moveClip: (fromTrackId, toTrackId, clipId, newTimelineStart) => {
    const state = get()
    const fromTrack = state.tracks.find((t) => t.id === fromTrackId)
    if (!fromTrack) return
    const clip = fromTrack.clips.find((c) => c.id === clipId)
    if (!clip) return

    const movedClip = { ...clip, trackId: toTrackId, timelineStart: Math.max(0, newTimelineStart) }

    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id === fromTrackId && fromTrackId !== toTrackId) {
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
        }
        if (t.id === toTrackId) {
          const clips = fromTrackId === toTrackId
            ? t.clips.filter((c) => c.id !== clipId)
            : [...t.clips]
          return { ...t, clips: [...clips, movedClip].sort((a, b) => a.timelineStart - b.timelineStart) }
        }
        return t
      }),
    }))
  },

  trimClipStart: (trackId, clipId, newStart) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    const delta = newStart - clip.timelineStart
    if (delta <= 0 || delta >= clip.duration) return

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId
                  ? {
                      ...c,
                      timelineStart: newStart,
                      sourceStart: c.sourceStart + delta / c.speed,
                      duration: c.duration - delta,
                    }
                  : c
              ),
            }
          : t
      ),
    }))
  },

  trimClipEnd: (trackId, clipId, newEnd) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return

    const newDuration = newEnd - clip.timelineStart
    if (newDuration <= 0 || newDuration >= clip.sourceEnd - clip.sourceStart) return

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId
                  ? { ...c, duration: newDuration, sourceEnd: c.sourceStart + newDuration / c.speed }
                  : c
              ),
            }
          : t
      ),
    }))
  },

  setClipSpeed: (trackId, clipId, speed) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return
    const clampedSpeed = Math.max(0.1, Math.min(10, speed))
    const sourceDuration = clip.sourceEnd - clip.sourceStart
    const newDuration = sourceDuration / clampedSpeed

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, speed: clampedSpeed, duration: newDuration } : c
              ),
            }
          : t
      ),
    }))
  },

  setClipReverse: (trackId, clipId, reverse) => set((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId
        ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, reverse } : c)) }
        : t
    ),
  })),

  setClipVolume: (trackId, clipId, volume) => set((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId
        ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, volume: Math.max(0, Math.min(2, volume)) } : c)) }
        : t
    ),
  })),

  duplicateClip: (trackId, clipId) => {
    const state = get()
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return
    state._pushHistory()

    const newClip: TimelineClip = {
      ...clip,
      id: nextClipId(),
      timelineStart: clip.timelineStart + clip.duration,
      keyframes: clip.keyframes.map((kf) => ({ ...kf, id: `kf_${Date.now()}_${Math.random()}` })),
    }

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: [...t.clips, newClip].sort((a, b) => a.timelineStart - b.timelineStart) }
          : t
      ),
    }))
  },

  setPlayhead: (time) => set({ playhead: time }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
  setScrollX: (scrollX) => set({ scrollX: Math.max(0, scrollX) }),
  setDuration: (duration) => set({ duration }),
  setSelection: (selection) => set({ selection }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  initFromVideo: (videoPath, duration) => {
    const videoTrackId = createTrackId('video')
    const audioTrackId = createTrackId('audio')
    const subtitleTrackId = createTrackId('subtitle')

    const videoClip = makeDefaultClip({
      id: nextClipId(),
      trackId: videoTrackId,
      sourceStart: 0,
      sourceEnd: duration,
      timelineStart: 0,
      duration,
      label: videoPath.split(/[/\\]/).pop() || 'Video',
    })

    const audioClip = makeDefaultClip({
      id: nextClipId(),
      trackId: audioTrackId,
      sourceStart: 0,
      sourceEnd: duration,
      timelineStart: 0,
      duration,
      label: 'Audio',
    })

    set({
      duration,
      tracks: [
        {
          id: videoTrackId,
          type: 'video',
          label: 'Video 1',
          clips: [videoClip],
          muted: false,
          locked: false,
          visible: true,
          height: 60,
          blendMode: 'normal',
        },
        {
          id: audioTrackId,
          type: 'audio',
          label: 'Audio 1',
          clips: [audioClip],
          muted: false,
          locked: false,
          visible: true,
          height: 40,
          blendMode: 'normal',
        },
        {
          id: subtitleTrackId,
          type: 'subtitle',
          label: 'Subtitles',
          clips: [],
          muted: false,
          locked: false,
          visible: true,
          height: 36,
          blendMode: 'normal',
        },
      ],
      playhead: 0,
      scrollX: 0,
    })
  },

  getEditDecisionList: () => {
    const state = get()
    const videoTrack = state.tracks.find((t) => t.type === 'video')
    if (!videoTrack) return []

    return videoTrack.clips
      .sort((a, b) => a.timelineStart - b.timelineStart)
      .map((clip) => ({
        sourceStart: clip.sourceStart,
        sourceEnd: clip.sourceEnd,
        timelineStart: clip.timelineStart,
        speed: clip.speed,
        reverse: clip.reverse,
      }))
  },
}))
