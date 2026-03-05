import { useCallback, useState } from 'react'
import { Upload, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useProjectStore } from '../../stores/projectStore'
import toast from 'react-hot-toast'

const ALLOWED_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv']

function getExtension(path: string): string | undefined {
  return path.split('.').pop()?.toLowerCase()
}

export default function VideoDropZone() {
  const { videoPath, setVideoFile, setIsVideoLoading } = useProjectStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error('File selection requires Electron')
      return
    }
    setIsVideoLoading(true)
    try {
      const path = await window.electronAPI.selectVideoFile()
      if (path) {
        const ext = getExtension(path)
        if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
          setVideoFile(path)
          toast.success('Video loaded successfully')
        } else {
          toast.error(`Unsupported format: .${ext}`)
        }
      }
    } catch (err) {
      toast.error('Failed to select video file')
    } finally {
      setIsVideoLoading(false)
    }
  }, [setVideoFile, setIsVideoLoading])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length === 0) return

      const file = files[0]
      // Use Electron's webUtils to get the real file path
      let filePath: string | null = null
      try {
        const { webUtils } = window.require('electron')
        filePath = webUtils.getPathForFile(file)
      } catch {
        // Fallback: try file.path (older Electron)
        filePath = (file as any).path || null
      }

      if (!filePath) {
        toast.error('Could not resolve file path')
        return
      }

      const ext = getExtension(filePath)
      if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
        setVideoFile(filePath)
        toast.success('Video loaded successfully')
      } else {
        toast.error(`Unsupported format: .${ext}`)
      }
    },
    [setVideoFile]
  )

  if (videoPath) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="text-blue-400" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">
            {videoPath.split(/[\\/]/).pop()}
          </p>
          <p className="text-xs text-slate-500 truncate">{videoPath}</p>
        </div>
        <button onClick={handleSelectFile} className="btn-secondary text-sm">
          Change
        </button>
      </motion.div>
    )
  }

  return (
    <button
      onClick={handleSelectFile}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-xl p-12 transition-all duration-200 cursor-pointer group ${
        isDragOver
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5'
          : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-900/50'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={isDragOver ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Upload
            className={`transition-colors duration-200 ${
              isDragOver ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'
            }`}
            size={40}
          />
        </motion.div>
        <div className="text-center">
          <p className={`font-medium transition-colors ${isDragOver ? 'text-blue-300' : 'text-slate-400 group-hover:text-slate-300'}`}>
            {isDragOver ? 'Drop video file here' : 'Click or drag a video file here'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Supports: MP4, MKV, AVI, MOV, WebM, FLV, WMV
          </p>
        </div>
      </div>
    </button>
  )
}
