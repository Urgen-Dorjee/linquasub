import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { PythonManager } from './python-manager'
import { FFmpegManager } from './ffmpeg-manager'
import { setupAutoUpdater } from './auto-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BACKEND_PORT = 8321

let mainWindow: BrowserWindow | null = null
let pythonManager: PythonManager | null = null
let ffmpegManager: FFmpegManager | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'LinguaSub',
    icon: path.join(__dirname, '../resources/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0f172a',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function getWindow(): BrowserWindow | null {
  return mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

function registerIpcHandlers() {
  ipcMain.handle('dialog:openVideo', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openSubtitle', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass', 'ssa'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openVideoMultiple', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths
  })

  ipcMain.handle('dialog:openDir', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mkv'] },
        { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('python:getPort', () => BACKEND_PORT)

  ipcMain.handle('app:getPaths', () => ({
    appPath: app.getAppPath(),
    userData: app.getPath('userData'),
    temp: app.getPath('temp'),
    resources: process.resourcesPath,
  }))

  ipcMain.handle('ffmpeg:getPath', () => ffmpegManager?.getPath() ?? null)

  ipcMain.handle('ffmpeg:isInstalled', () => ffmpegManager?.isInstalled() ?? false)
}

async function startBackend() {
  ffmpegManager = new FFmpegManager(app.getAppPath(), app.isPackaged)

  pythonManager = new PythonManager({
    port: BACKEND_PORT,
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    ffmpegPath: ffmpegManager.getPath(),
  })

  try {
    await pythonManager.start()
    mainWindow?.webContents.send('python:ready')
  } catch (err) {
    mainWindow?.webContents.send('python:error', String(err))
  }
}

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit LinguaSub' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About LinguaSub',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About LinguaSub',
              message: 'LinguaSub',
              detail: [
                `Version ${app.getVersion()}`,
                '',
                'Industry-grade subtitle generation, translation,',
                'and video burning application.',
                '',
                'Developer: Urgen Dorjee',
                'Copyright (c) 2026 Urgen Dorjee.',
                'All rights reserved.',
                '',
                'Powered by Whisper AI, Google Gemini, and FFmpeg.',
              ].join('\n'),
              icon: path.join(__dirname, '../resources/icon.ico'),
            })
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools()
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(async () => {
  setupMenu()
  registerIpcHandlers()
  createWindow()
  setupAutoUpdater(mainWindow!)
  await startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  pythonManager?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  pythonManager?.stop()
})
