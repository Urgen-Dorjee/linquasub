import { useRef, useEffect } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useProjectStore } from '../stores/projectStore'
import { useTimelineStore } from '../stores/timelineStore'
import SubtitleEditor from '../components/editor/SubtitleEditor'
import TranslationPanel from '../components/translation/TranslationPanel'
import HighlightsPanel from '../components/editor/HighlightsPanel'
import SpeakerPanel from '../components/editor/SpeakerPanel'
import VideoPlayer, { type VideoPlayerHandle } from '../components/preview/VideoPlayer'
import Timeline from '../components/timeline/Timeline'
import ClipInspector from '../components/timeline/ClipInspector'
import KeyframeEditor from '../components/timeline/KeyframeEditor'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { PenTool, Loader2 } from 'lucide-react'

export default function EditorPage() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const videoDuration = useProjectStore((s) => s.videoDuration)
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)
  const playerRef = useRef<VideoPlayerHandle>(null)
  const timelineTracks = useTimelineStore((s) => s.tracks)
  const initTimeline = useTimelineStore((s) => s.initFromVideo)

  useEffect(() => {
    if (videoPath && videoDuration > 0 && timelineTracks.length === 0) {
      initTimeline(videoPath, videoDuration)
    }
  }, [videoPath, videoDuration, timelineTracks.length, initTimeline])

  const stableVideoRef = {
    get current() {
      return playerRef.current?.getVideoElement() ?? null
    },
  } as React.RefObject<HTMLVideoElement | null>

  useKeyboardShortcuts(stableVideoRef)

  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-400 mx-auto" size={32} />
          <p className="text-slate-400">Transcription in progress...</p>
          <p className="text-slate-500 text-sm">The editor will be available once transcription completes.</p>
        </div>
      </div>
    )
  }

  if (!videoPath || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <PenTool className="text-slate-600 mx-auto" size={40} />
          <p className="text-slate-400 text-lg">No transcription available</p>
          <p className="text-slate-500 text-sm">
            Go to the Home tab to upload a video and transcribe it first.
          </p>
        </div>
      </div>
    )
  }

  const handleTimelineSeek = (time: number) => {
    const video = playerRef.current?.getVideoElement()
    if (video) video.currentTime = time
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top: Preview + Inspector */}
      <PanelGroup orientation="vertical" className="flex-1 min-h-0">
        {/* Upper section: Preview + Panels */}
        <Panel defaultSize={60} minSize={30}>
          <PanelGroup orientation="horizontal" className="h-full">
            {/* Video Preview */}
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full">
                <VideoPlayer ref={playerRef} videoPath={videoPath} segments={segments} />
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-col-resize" />

            {/* Right side: Editor + Translation + Inspector */}
            <Panel defaultSize={50} minSize={25}>
              <PanelGroup orientation="vertical" className="h-full">
                {/* Subtitle Editor */}
                <Panel defaultSize={55} minSize={20}>
                  <div className="h-full overflow-y-auto">
                    <SubtitleEditor />
                  </div>
                </Panel>

                <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-row-resize" />

                {/* Side panels */}
                <Panel defaultSize={45} minSize={15}>
                  <div className="h-full overflow-y-auto space-y-3 p-1">
                    <TranslationPanel />
                    <SpeakerPanel />
                    <HighlightsPanel onSeek={handleTimelineSeek} />
                    <ClipInspector />
                    <KeyframeEditor />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-row-resize" />

        {/* Bottom: Timeline */}
        <Panel defaultSize={40} minSize={15}>
          {videoDuration > 0 && (
            <div className="h-full">
              <Timeline onSeek={handleTimelineSeek} />
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  )
}
