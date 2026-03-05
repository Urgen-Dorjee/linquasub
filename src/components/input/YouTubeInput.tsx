import { useState } from 'react'
import { Link, Loader2, X, FolderOpen } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/

export default function YouTubeInput() {
  const [url, setUrl] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const { isVideoLoading, setIsVideoLoading, downloadProgress, setDownloadProgress } = useProjectStore()

  const isValidUrl = YOUTUBE_REGEX.test(url)

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectOutputDir()
    if (dir) {
      setOutputDir(dir)
    }
  }

  const handleDownload = async () => {
    if (!isValidUrl) return

    setIsVideoLoading(true)
    try {
      const result = await api.downloadVideo(url, 'best', outputDir || undefined)
      if (result.task_id) {
        setTaskId(result.task_id)
        toast.success('Download started...')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start download')
      setIsVideoLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!taskId) return
    try {
      await api.cancelTask(taskId)
      setIsVideoLoading(false)
      setDownloadProgress(0)
      setTaskId(null)
      toast('Download cancelled')
    } catch {
      toast.error('Failed to cancel')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL here..."
            className="input-field w-full pl-10"
            disabled={isVideoLoading}
          />
        </div>
        <button
          onClick={handleSelectFolder}
          disabled={isVideoLoading}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm"
          title={outputDir ? `Save to: ${outputDir}` : 'Choose download folder'}
        >
          <FolderOpen size={16} />
        </button>
        <button
          onClick={handleDownload}
          disabled={!isValidUrl || isVideoLoading}
          className="btn-primary flex items-center gap-2"
        >
          {isVideoLoading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              {downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : 'Downloading...'}
            </>
          ) : (
            'Download'
          )}
        </button>
        {isVideoLoading && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors text-sm"
            title="Cancel download"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {outputDir && (
        <p className="text-xs text-slate-400 truncate">
          Save to: {outputDir}
        </p>
      )}

      {isVideoLoading && downloadProgress > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}

      {url && !isValidUrl && (
        <p className="text-xs text-red-400">Please enter a valid YouTube URL</p>
      )}
    </div>
  )
}
