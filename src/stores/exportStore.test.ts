import { describe, it, expect, beforeEach } from 'vitest'
import { useExportStore, SUBTITLE_PRESETS } from './exportStore'

function resetStore() {
  useExportStore.setState({
    options: {
      formats: { srt: true, vtt: false, ass: false, burnedVideo: false, karaokeVideo: false },
      style: {
        fontFamily: 'Arial', fontSize: 24, primaryColor: '#FFFFFF', outlineColor: '#000000',
        outlineWidth: 2, position: 'bottom', marginV: 30, bold: false, italic: false,
        backgroundColor: '#000000', backgroundOpacity: 0,
      },
      useTranslation: false,
      outputDir: '',
      videoCodec: 'h264',
      crf: 23,
      subtitleEffect: 'none',
    },
    activePreset: 'default',
    isExporting: false,
    progress: 0,
    taskId: null,
    currentFormat: null,
  })
}

describe('exportStore', () => {
  beforeEach(resetStore)

  it('has correct default options', () => {
    const state = useExportStore.getState()
    expect(state.options.formats.srt).toBe(true)
    expect(state.options.videoCodec).toBe('h264')
    expect(state.options.crf).toBe(23)
    expect(state.activePreset).toBe('default')
  })

  it('updates partial options', () => {
    useExportStore.getState().setOptions({ outputDir: '/tmp/out', videoCodec: 'h265' })
    const state = useExportStore.getState()
    expect(state.options.outputDir).toBe('/tmp/out')
    expect(state.options.videoCodec).toBe('h265')
    expect(state.options.formats.srt).toBe(true) // unchanged
  })

  it('updates style and resets preset to default', () => {
    const store = useExportStore.getState()
    store.applyPreset('netflix')
    expect(useExportStore.getState().activePreset).toBe('netflix')

    store.setStyle({ fontSize: 40 })
    const state = useExportStore.getState()
    expect(state.options.style.fontSize).toBe(40)
    expect(state.activePreset).toBe('default') // reset on manual edit
  })

  it('applies Netflix preset', () => {
    useExportStore.getState().applyPreset('netflix')
    const state = useExportStore.getState()
    expect(state.activePreset).toBe('netflix')
    expect(state.options.style.fontFamily).toBe('Noto Sans')
    expect(state.options.style.bold).toBe(true)
    expect(state.options.subtitleEffect).toBe('fade')
  })

  it('applies cinematic preset', () => {
    useExportStore.getState().applyPreset('cinematic')
    const state = useExportStore.getState()
    expect(state.options.style.fontFamily).toBe('Georgia')
    expect(state.options.style.italic).toBe(true)
  })

  it('tracks export progress', () => {
    const store = useExportStore.getState()
    store.setIsExporting(true)
    store.setProgress(75)
    store.setTaskId('task-abc')
    store.setCurrentFormat('srt')

    const state = useExportStore.getState()
    expect(state.isExporting).toBe(true)
    expect(state.progress).toBe(75)
    expect(state.taskId).toBe('task-abc')
    expect(state.currentFormat).toBe('srt')
  })

  it('resets export state', () => {
    const store = useExportStore.getState()
    store.setIsExporting(true)
    store.setProgress(50)
    store.setTaskId('task-1')
    store.resetExport()

    const state = useExportStore.getState()
    expect(state.isExporting).toBe(false)
    expect(state.progress).toBe(0)
    expect(state.taskId).toBeNull()
  })

  it('has all expected presets', () => {
    const presetNames = Object.keys(SUBTITLE_PRESETS)
    expect(presetNames).toContain('default')
    expect(presetNames).toContain('netflix')
    expect(presetNames).toContain('youtube')
    expect(presetNames).toContain('cinematic')
    expect(presetNames).toContain('minimal')
  })
})
