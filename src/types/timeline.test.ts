import { describe, it, expect } from 'vitest'
import { createDefaultTransform, createDefaultClip } from './timeline'

describe('timeline types', () => {
  describe('createDefaultTransform', () => {
    it('returns identity transform', () => {
      const t = createDefaultTransform()
      expect(t.x).toBe(0)
      expect(t.y).toBe(0)
      expect(t.scaleX).toBe(1)
      expect(t.scaleY).toBe(1)
      expect(t.opacity).toBe(1)
      expect(t.rotation).toBe(0)
    })
  })

  describe('createDefaultClip', () => {
    it('fills in default speed, reverse, volume, transform, keyframes', () => {
      const clip = createDefaultClip({
        id: 'test',
        trackId: 'track1',
        sourceStart: 0,
        sourceEnd: 10,
        timelineStart: 0,
        duration: 10,
      })

      expect(clip.speed).toBe(1)
      expect(clip.reverse).toBe(false)
      expect(clip.volume).toBe(1)
      expect(clip.transform.opacity).toBe(1)
      expect(clip.keyframes).toEqual([])
    })

    it('allows overriding defaults', () => {
      const clip = createDefaultClip({
        id: 'test',
        trackId: 'track1',
        sourceStart: 0,
        sourceEnd: 10,
        timelineStart: 0,
        duration: 10,
        speed: 2,
        reverse: true,
      })

      expect(clip.speed).toBe(2)
      expect(clip.reverse).toBe(true)
    })
  })
})
