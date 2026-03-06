import { useRef, useEffect, useState } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useTranscriptionStore } from '../stores/transcriptionStore'
import { useTranslationStore } from '../stores/translationStore'
import { useProjectStore } from '../stores/projectStore'
import { useTimelineStore } from '../stores/timelineStore'
import SubtitleEditor from '../components/editor/SubtitleEditor'
import TranslationPanel from '../components/translation/TranslationPanel'
import EffectsTab from '../components/editor/EffectsTab'
import ColorGradeTab from '../components/editor/ColorGradeTab'
import AudioMixTab from '../components/editor/AudioMixTab'
import BackgroundTab from '../components/editor/BackgroundTab'
import VideoPlayer, { type VideoPlayerHandle } from '../components/preview/VideoPlayer'
import Timeline from '../components/timeline/Timeline'
import ClipInspector from '../components/timeline/ClipInspector'
import KeyframeEditor from '../components/timeline/KeyframeEditor'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { PenTool, Loader2, Upload, Subtitles, Languages, Sliders, Palette, Volume2, ImageOff } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

type EditorTab = 'subtitles' | 'translate' | 'effects' | 'color' | 'audio' | 'background'

const TABS: { id: EditorTab; label: string; icon: typeof Subtitles }[] = [
  { id: 'subtitles', label: 'Subs', icon: Subtitles },
  { id: 'translate', label: 'Translate', icon: Languages },
  { id: 'effects', label: 'Effects', icon: Sliders },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'background', label: 'AI BG', icon: ImageOff },
]

export default function EditorPage() {
  const videoPath = useProjectStore((s) => s.videoPath)
  const videoDuration = useProjectStore((s) => s.videoDuration)
  const segments = useTranscriptionStore((s) => s.segments)
  const isTranscribing = useTranscriptionStore((s) => s.isTranscribing)
  const playerRef = useRef<VideoPlayerHandle>(null)
  const timelineTracks = useTimelineStore((s) => s.tracks)
  const initTimeline = useTimelineStore((s) => s.initFromVideo)
  const [activeTab, setActiveTab] = useState<EditorTab>('subtitles')

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

  const handleImportSrt = async () => {
    let path: string | null = null
    if (window.electronAPI) {
      path = await window.electronAPI.selectSubtitleFile()
    } else {
      path = prompt('Enter subtitle file path (.srt, .vtt, .ass):')
    }
    if (!path) return

    try {
      const result = await api.importSubtitle(path, true)
      if (result.segments && result.segments.length > 0) {
        useTranscriptionStore.getState().setSegments(result.segments)
        if (result.translations && result.translations.length > 0) {
          useTranslationStore.getState().setTranslations(result.translations, 'EN')
          toast.success(`Imported ${result.count} segments with translations`)
        } else {
          toast.success(`Imported ${result.count} segments`)
        }
      } else {
        toast.error('No segments found in file')
      }
    } catch {
      toast.error('Failed to import subtitle file')
    }
  }

  if (!videoPath && segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <PenTool className="text-slate-600 mx-auto" size={40} />
          <p className="text-slate-400 text-lg">No video or subtitles loaded</p>
          <p className="text-slate-500 text-sm">
            Go to the Home tab to upload a video, or import an existing subtitle file below.
          </p>
          <button
            onClick={handleImportSrt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Upload size={16} />
            Import Subtitle File (SRT/VTT/ASS)
          </button>
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
      <PanelGroup orientation="vertical" className="flex-1 min-h-0">
        {/* Upper section: Preview + Panels */}
        <Panel defaultSize={60} minSize={30}>
          <PanelGroup orientation="horizontal" className="h-full">
            {/* Video Preview */}
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full">
                {videoPath ? (
                  <VideoPlayer ref={playerRef} videoPath={videoPath} segments={segments} />
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="text-center space-y-2">
                      <p className="text-slate-500 text-sm">No video loaded</p>
                      <p className="text-slate-600 text-xs">Load a video from the Home tab to preview with subtitles</p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-col-resize" />

            {/* Right side: Tabbed panel */}
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full flex flex-col">
                {/* Tab bar */}
                <div className="flex border-b border-slate-700 bg-slate-900/50 shrink-0">
                  {TABS.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {activeTab === 'subtitles' && <SubtitleEditor />}
                  {activeTab === 'translate' && (
                    <div className="p-1 space-y-3">
                      <TranslationPanel />
                    </div>
                  )}
                  {activeTab === 'effects' && <EffectsTab />}
                  {activeTab === 'color' && <ColorGradeTab />}
                  {activeTab === 'audio' && <AudioMixTab />}
                  {activeTab === 'background' && <BackgroundTab />}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-row-resize" />

        {/* Bottom: Timeline + Inspector */}
        <Panel defaultSize={40} minSize={15}>
          <PanelGroup orientation="horizontal" className="h-full">
            <Panel defaultSize={75} minSize={40}>
              {videoDuration > 0 && (
                <div className="h-full">
                  <Timeline onSeek={handleTimelineSeek} />
                </div>
              )}
            </Panel>
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-600 transition-colors cursor-col-resize" />
            <Panel defaultSize={25} minSize={15}>
              <div className="h-full overflow-y-auto p-1 space-y-2">
                <ClipInspector />
                <KeyframeEditor />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  )
}
