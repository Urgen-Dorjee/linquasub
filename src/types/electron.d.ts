interface ElectronAPI {
  selectVideoFile: () => Promise<string | null>
  selectVideoFiles?: () => Promise<string[] | null>
  selectSubtitleFile: () => Promise<string | null>
  selectOutputDir: () => Promise<string | null>
  saveFile: (defaultName: string) => Promise<string | null>
  getPythonPort: () => Promise<number>
  getAppPaths: () => Promise<{
    appPath: string
    userData: string
    temp: string
    resources: string
  }>
  getFFmpegPath: () => Promise<string | null>
  isFFmpegInstalled: () => Promise<boolean>
  onBackendReady: (callback: () => void) => () => void
  onBackendError: (callback: (error: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
