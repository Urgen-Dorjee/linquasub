import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFile: () => ipcRenderer.invoke('dialog:openVideo'),
  selectVideoFiles: () => ipcRenderer.invoke('dialog:openVideoMultiple'),
  selectSubtitleFile: () => ipcRenderer.invoke('dialog:openSubtitle'),
  selectOutputDir: () => ipcRenderer.invoke('dialog:openDir'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  getPythonPort: () => ipcRenderer.invoke('python:getPort'),
  getAppPaths: () => ipcRenderer.invoke('app:getPaths'),
  getFFmpegPath: () => ipcRenderer.invoke('ffmpeg:getPath'),
  isFFmpegInstalled: () => ipcRenderer.invoke('ffmpeg:isInstalled'),

  onBackendReady: (callback: () => void) => {
    ipcRenderer.on('python:ready', callback)
    return () => ipcRenderer.removeListener('python:ready', callback)
  },
  onBackendError: (callback: (error: string) => void) => {
    ipcRenderer.on('python:error', (_event, error) => callback(error))
    return () => ipcRenderer.removeListener('python:error', callback)
  },
})
