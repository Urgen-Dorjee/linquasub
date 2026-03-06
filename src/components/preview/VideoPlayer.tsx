import { useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Eye } from 'lucide-react'
import type { Segment } from '../../types/subtitle'
import { useTranslationStore } from '../../stores/translationStore'
import { useVideoEffectsStore } from '../../stores/videoEffectsStore'
import api from '../../services/api'

interface VideoPlayerProps {
  videoPath: string
  segments: Segment[]
}

export interface VideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null
}

export type PreviewMode = 'original' | 'translation' | 'dual' | 'off'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function calculateWPM(text: string, durationSec: number): number {
  if (durationSec <= 0) return 0
  const wordCount = text.trim().split(/\s+/).length
  return Math.round((wordCount / durationSec) * 60)
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ videoPath, segments }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const waveformRef = useRef<HTMLDivElement>(null)
    const wavesurferRef = useRef<any>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [previewMode, setPreviewMode] = useState<PreviewMode>('original')

    const tracks = useTranslationStore((s) => s.tracks)
    const activeTrack = useTranslationStore((s) => s.activeTrack)
    const activeTranslations = activeTrack ? tracks.get(activeTrack) : null

    // Video effects — real-time CSS filter preview
    const cssFilter = useVideoEffectsStore((s) => s.getCssFilter())
    const vignette = useVideoEffectsStore((s) => s.effects.vignette)

    // Audio volume preview (EQ applied on export via FFmpeg)
    const audioVolume = useVideoEffectsStore((s) => s.audioMix.volume)

    useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
    }))

    const currentSubtitle = useMemo(() => {
      return segments.find((s) => currentTime >= s.start && currentTime <= s.end)
    }, [segments, currentTime])

    const currentTranslation = useMemo(() => {
      if (!currentSubtitle || !activeTranslations) return null
      return activeTranslations.get(currentSubtitle.id)
    }, [currentSubtitle, activeTranslations])

    const currentWPM = useMemo(() => {
      if (!currentSubtitle) return 0
      return calculateWPM(currentSubtitle.text, currentSubtitle.end - currentSubtitle.start)
    }, [currentSubtitle])

    // Apply volume directly to video element (EQ/bass/treble applied via FFmpeg on export)
    useEffect(() => {
      const video = videoRef.current
      if (video) video.volume = Math.max(0, Math.min(1, audioVolume))
    }, [audioVolume])

    const videoSrc = videoPath.startsWith('http')
      ? videoPath
      : `${api.baseURL}/api/serve-file?path=${encodeURIComponent(videoPath)}`

    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      const onTimeUpdate = () => {
        setCurrentTime(video.currentTime)
        if (wavesurferRef.current && duration > 0) {
          const progress = video.currentTime / duration
          wavesurferRef.current.seekTo(Math.min(progress, 1))
        }
      }
      const onDurationChange = () => setDuration(video.duration)
      const onPlay = () => setIsPlaying(true)
      const onPause = () => setIsPlaying(false)

      video.addEventListener('timeupdate', onTimeUpdate)
      video.addEventListener('durationchange', onDurationChange)
      video.addEventListener('play', onPlay)
      video.addEventListener('pause', onPause)

      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate)
        video.removeEventListener('durationchange', onDurationChange)
        video.removeEventListener('play', onPlay)
        video.removeEventListener('pause', onPause)
      }
    }, [duration])

    // Initialize wavesurfer.js — load audio independently (don't hijack video element)
    useEffect(() => {
      if (!waveformRef.current || !videoSrc) return

      let ws: any = null
      let destroyed = false

      async function initWavesurfer() {
        try {
          const WaveSurfer = (await import('wavesurfer.js')).default
          if (destroyed || !waveformRef.current) return

          ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#475569',
            progressColor: '#3b82f6',
            cursorColor: '#60a5fa',
            cursorWidth: 2,
            height: 48,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
            interact: true,
            hideScrollbar: true,
          })

          // Load audio from the same source but independently
          ws.load(videoSrc)

          // Mute wavesurfer — we only want the waveform visual, not duplicate audio
          ws.setVolume(0)

          ws.on('click', (relativeX: number) => {
            if (videoRef.current && duration > 0) {
              videoRef.current.currentTime = relativeX * duration
            }
          })

          wavesurferRef.current = ws
        } catch (err) {
          console.warn('[VideoPlayer] WaveSurfer init failed:', err)
        }
      }

      initWavesurfer()

      return () => {
        destroyed = true
        if (ws) {
          try { ws.destroy() } catch {}
        }
        wavesurferRef.current = null
      }
    }, [videoSrc])

    const togglePlay = () => {
      const video = videoRef.current
      if (!video) return
      if (isPlaying) {
        video.pause()
      } else {
        video.play()
      }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      if (videoRef.current) {
        videoRef.current.currentTime = time
        setCurrentTime(time)
      }
    }

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted
        setIsMuted(!isMuted)
      }
    }

    const cyclePlaybackRate = () => {
      const currentIdx = PLAYBACK_RATES.indexOf(playbackRate)
      const nextIdx = (currentIdx + 1) % PLAYBACK_RATES.length
      const newRate = PLAYBACK_RATES[nextIdx]
      setPlaybackRate(newRate)
      if (videoRef.current) {
        videoRef.current.playbackRate = newRate
      }
    }

    const cyclePreviewMode = () => {
      const modes: PreviewMode[] = ['original', 'translation', 'dual', 'off']
      const currentIdx = modes.indexOf(previewMode)
      setPreviewMode(modes[(currentIdx + 1) % modes.length])
    }

    const seekRelative = (offset: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + offset))
      }
    }

    const showOriginal = previewMode === 'original' || previewMode === 'dual'
    const showTranslation = previewMode === 'translation' || previewMode === 'dual'

    // WPM color coding: green < 160, yellow 160-200, red > 200
    const wpmColor = currentWPM > 200 ? 'text-red-400' : currentWPM > 160 ? 'text-amber-400' : 'text-green-400'

    return (
      <div className="card h-full flex flex-col">
        <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            style={{ filter: cssFilter || undefined }}
          />

          {/* Vignette overlay */}
          {vignette && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
          )}

          {/* Subtitle overlay */}
          {previewMode !== 'off' && currentSubtitle && (
            <div className="absolute bottom-8 left-0 right-0 text-center px-4 space-y-1">
              {showTranslation && currentTranslation && (
                <div>
                  <span className="bg-blue-900/80 text-blue-200 px-4 py-1.5 rounded text-base inline-block max-w-[80%]">
                    {currentTranslation.translatedText}
                  </span>
                </div>
              )}
              {showOriginal && (
                <div>
                  <span className="bg-black/80 text-white px-4 py-2 rounded text-lg inline-block max-w-[80%]">
                    {currentSubtitle.text}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WPM indicator */}
          {currentSubtitle && previewMode !== 'off' && (
            <div className="absolute top-2 right-2">
              <span className={`text-[10px] bg-black/60 px-1.5 py-0.5 rounded ${wpmColor}`}>
                {currentWPM} WPM
              </span>
            </div>
          )}
        </div>

        {/* Waveform */}
        <div ref={waveformRef} className="w-full mt-2 rounded overflow-hidden bg-slate-900" />

        {/* Controls */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => seekRelative(-5)} className="text-white hover:text-blue-400 transition-colors" title="Back 5s">
            <SkipBack size={16} />
          </button>

          <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button onClick={() => seekRelative(5)} className="text-white hover:text-blue-400 transition-colors" title="Forward 5s">
            <SkipForward size={16} />
          </button>

          <span className="text-xs text-slate-500 w-12">{formatTime(currentTime)}</span>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 accent-blue-500"
          />

          <span className="text-xs text-slate-500 w-12">{formatTime(duration)}</span>

          <button
            onClick={cyclePreviewMode}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors min-w-[40px] text-center ${
              previewMode === 'off' ? 'bg-slate-800 text-slate-600' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={`Preview: ${previewMode}`}
          >
            <Eye size={14} className="inline" />
          </button>

          <button
            onClick={cyclePlaybackRate}
            className="text-xs text-slate-400 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-slate-800 min-w-[40px] text-center"
            title="Playback speed"
          >
            {playbackRate}x
          </button>

          <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>
    )
  }
)

export default VideoPlayer
