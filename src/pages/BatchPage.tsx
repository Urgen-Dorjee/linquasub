import { useState } from 'react'
import { Plus, Trash2, Play, Loader2, FolderOpen, CheckCircle, XCircle } from 'lucide-react'
import { useBatchStore } from '../stores/batchStore'
import api from '../services/api'
import toast from 'react-hot-toast'

const OPERATIONS = [
  { value: 'transcribe', label: 'Transcribe' },
  { value: 'translate', label: 'Translate' },
  { value: 'export_srt', label: 'Export SRT' },
]

export default function BatchPage() {
  const { jobs, isProcessing, progress, addJob, removeJob, updateJob, clearJobs, setIsProcessing, setTaskId, setProgress } = useBatchStore()
  const [defaultLang, setDefaultLang] = useState('EN')
  const [defaultFormat, setDefaultFormat] = useState('srt')

  const handleAddFiles = async () => {
    if (!window.electronAPI) return
    // Use electron dialog to select multiple video files
    const paths = await window.electronAPI.selectVideoFiles?.()
    if (!paths || paths.length === 0) return

    for (const path of paths) {
      const fileName = path.split(/[/\\]/).pop() || path
      addJob({
        videoPath: path,
        fileName,
        operations: ['transcribe', 'export_srt'],
        targetLanguage: defaultLang,
        exportFormat: defaultFormat,
        status: 'pending',
      })
    }
  }

  const handleStart = async () => {
    if (jobs.length === 0) return
    setIsProcessing(true)
    setProgress(0)

    try {
      const result = await api.startBatch({
        jobs: jobs.map((j) => ({
          video_path: j.videoPath,
          operations: j.operations,
          target_language: j.targetLanguage,
          export_format: j.exportFormat,
        })),
      })

      setTaskId(result.task_id)

      const poll = setInterval(async () => {
        try {
          const status = await api.getBatchStatus(result.task_id)
          if (status.status === 'complete') {
            clearInterval(poll)
            setIsProcessing(false)
            setProgress(100)

            // Update individual job statuses
            const results = status.results || []
            for (const r of results) {
              updateJob(r.index, {
                status: r.status === 'ok' ? 'done' : 'error',
                error: r.error,
              })
            }

            toast.success(`Batch complete: ${status.completed}/${status.total} succeeded`)
          } else if (status.progress > 0) {
            setProgress(status.progress)

            // Mark in-progress
            const completedCount = Math.floor((status.progress / 100) * jobs.length)
            jobs.forEach((_, i) => {
              if (i < completedCount) updateJob(i, { status: 'done' })
              else if (i === completedCount) updateJob(i, { status: 'processing' })
            })
          }
        } catch (err: any) {
          if (err?.response?.status === 500) {
            clearInterval(poll)
            setIsProcessing(false)
            toast.error('Batch processing failed')
          }
        }
      }, 3000)
    } catch {
      toast.error('Failed to start batch')
      setIsProcessing(false)
    }
  }

  const toggleOperation = (index: number, op: string) => {
    const job = jobs[index]
    const ops = job.operations.includes(op)
      ? job.operations.filter((o) => o !== op)
      : [...job.operations, op]
    updateJob(index, { operations: ops })
  }

  return (
    <div className="w-full px-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Batch Processing</h2>
        <p className="text-slate-400">
          Queue multiple videos for sequential transcription, translation, and export.
        </p>
      </div>

      {/* Defaults */}
      <div className="card flex gap-4 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Default Language</label>
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value)}
            className="input-field text-sm"
          >
            {['EN', 'ES', 'FR', 'DE', 'JA', 'KO', 'ZH', 'RU', 'PT', 'AR', 'HI'].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Export Format</label>
          <select
            value={defaultFormat}
            onChange={(e) => setDefaultFormat(e.target.value)}
            className="input-field text-sm"
          >
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
            <option value="ass">ASS</option>
          </select>
        </div>
        <button
          onClick={handleAddFiles}
          disabled={isProcessing}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Plus size={14} />
          Add Videos
        </button>
        <button
          onClick={handleStart}
          disabled={isProcessing || jobs.length === 0}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing... {progress > 0 ? `${Math.round(progress)}%` : ''}
            </>
          ) : (
            <>
              <Play size={14} />
              Start Batch ({jobs.length})
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      {isProcessing && progress > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="card text-center py-12">
          <FolderOpen className="text-slate-600 mx-auto mb-3" size={40} />
          <p className="text-slate-400">No videos in queue</p>
          <p className="text-xs text-slate-600 mt-1">Click "Add Videos" to select files for batch processing.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job, i) => (
            <div key={i} className="card flex items-center gap-3">
              {/* Status icon */}
              <div className="w-6">
                {job.status === 'done' && <CheckCircle size={16} className="text-green-400" />}
                {job.status === 'error' && <XCircle size={16} className="text-red-400" />}
                {job.status === 'processing' && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                {job.status === 'pending' && <div className="w-4 h-4 rounded-full border border-slate-600" />}
              </div>

              {/* File name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{job.fileName}</p>
                {job.error && <p className="text-[10px] text-red-400 truncate">{job.error}</p>}
              </div>

              {/* Operations */}
              <div className="flex gap-1">
                {OPERATIONS.map((op) => (
                  <button
                    key={op.value}
                    onClick={() => toggleOperation(i, op.value)}
                    disabled={isProcessing}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      job.operations.includes(op.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Remove */}
              <button
                onClick={() => removeJob(i)}
                disabled={isProcessing}
                className="text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {jobs.length > 0 && !isProcessing && (
        <button
          onClick={clearJobs}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Clear all jobs
        </button>
      )}
    </div>
  )
}
