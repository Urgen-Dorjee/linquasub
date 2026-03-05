import { useEffect } from 'react'
import { useTranscriptionStore } from '../stores/transcriptionStore'

export function useKeyboardShortcuts(videoRef?: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable

      // Undo: Ctrl+Z (works even in inputs for subtitle edits)
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        // Only intercept if not in a native text input
        if (!isInput) {
          e.preventDefault()
          useTranscriptionStore.getState().undo()
        }
        return
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        if (!isInput) {
          e.preventDefault()
          useTranscriptionStore.getState().redo()
        }
        return
      }

      // Don't handle other shortcuts when typing in inputs
      if (isInput) return

      const video = videoRef?.current

      switch (e.key) {
        case ' ':
          // Space: play/pause
          e.preventDefault()
          if (video) {
            if (video.paused) {
              video.play()
            } else {
              video.pause()
            }
          }
          break

        case 'ArrowLeft':
          // Left arrow: seek back 5s (Shift: 1s)
          e.preventDefault()
          if (video) {
            video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 1 : 5))
          }
          break

        case 'ArrowRight':
          // Right arrow: seek forward 5s (Shift: 1s)
          e.preventDefault()
          if (video) {
            video.currentTime = Math.min(video.duration || 0, video.currentTime + (e.shiftKey ? 1 : 5))
          }
          break

        case ',':
          // Comma: frame step backward
          e.preventDefault()
          if (video) {
            video.pause()
            video.currentTime = Math.max(0, video.currentTime - 1 / 30)
          }
          break

        case '.':
          // Period: frame step forward
          e.preventDefault()
          if (video) {
            video.pause()
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 1 / 30)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [videoRef])
}
