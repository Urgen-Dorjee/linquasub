import type { Segment } from '../types/subtitle'

const MAX_HISTORY = 50

function cloneSegments(segments: Segment[]): Segment[] {
  return segments.map((s) => ({ ...s, words: [...s.words] }))
}

export class SegmentHistory {
  private past: Segment[][] = []
  private future: Segment[][] = []

  push(segments: Segment[]) {
    this.past.push(cloneSegments(segments))
    if (this.past.length > MAX_HISTORY) {
      this.past.shift()
    }
    this.future = []
  }

  undo(current: Segment[]): Segment[] | null {
    if (this.past.length === 0) return null
    const previous = this.past.pop()!
    this.future.push(cloneSegments(current))
    return previous
  }

  redo(current: Segment[]): Segment[] | null {
    if (this.future.length === 0) return null
    const next = this.future.pop()!
    this.past.push(cloneSegments(current))
    return next
  }

  clear() {
    this.past = []
    this.future = []
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }
}
