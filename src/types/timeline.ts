export interface ClipTransform {
  x: number      // horizontal offset (pixels, relative to video frame)
  y: number      // vertical offset
  scaleX: number // 1.0 = 100%
  scaleY: number
  opacity: number // 0.0 - 1.0
  rotation: number // degrees
}

export interface Keyframe {
  id: string
  time: number         // timeline time (seconds)
  property: keyof ClipTransform
  value: number
  easing: KeyframeEasing
}

export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'

export interface TimelineClip {
  id: string
  trackId: string
  sourceStart: number // start time in source media
  sourceEnd: number   // end time in source media
  timelineStart: number // position on timeline
  duration: number
  label?: string
  speed: number        // playback speed (1.0 = normal)
  reverse: boolean     // play in reverse
  volume: number       // audio volume (0.0 - 1.0)
  transform: ClipTransform
  keyframes: Keyframe[]
  transitionIn?: ClipTransition
  transitionOut?: ClipTransition
}

export interface ClipTransition {
  type: TransitionType
  duration: number // seconds
}

export type TransitionType =
  | 'fade' | 'dissolve' | 'wipeleft' | 'wiperight' | 'wipeup' | 'wipedown'
  | 'slideleft' | 'slideright' | 'slideup' | 'slidedown'
  | 'circlecrop' | 'rectcrop' | 'radial' | 'smoothleft' | 'smoothright'

export interface TimelineTrack {
  id: string
  type: 'video' | 'audio' | 'subtitle'
  label: string
  clips: TimelineClip[]
  muted: boolean
  locked: boolean
  visible: boolean
  height: number
  blendMode: BlendMode
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add'

export interface EditDecision {
  type: 'cut' | 'trim' | 'speed'
  clipId: string
  sourceStart: number
  sourceEnd: number
  timelineStart: number
  speed?: number
  reverse?: boolean
}

export type TimelineTool = 'select' | 'razor' | 'trim'

export interface TimelineSelection {
  clipIds: string[]
  trackId: string | null
}

export interface SnapPoint {
  time: number
  source: 'playhead' | 'clip-start' | 'clip-end' | 'marker'
}

export function createDefaultTransform(): ClipTransform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 }
}

export function createDefaultClip(partial: Omit<TimelineClip, 'speed' | 'reverse' | 'volume' | 'transform' | 'keyframes'> & Partial<TimelineClip>): TimelineClip {
  return {
    speed: 1,
    reverse: false,
    volume: 1,
    transform: createDefaultTransform(),
    keyframes: [],
    ...partial,
  }
}
