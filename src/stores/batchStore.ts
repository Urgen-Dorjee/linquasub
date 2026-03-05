import { create } from 'zustand'

export interface BatchJob {
  videoPath: string
  fileName: string
  operations: string[]
  targetLanguage: string
  exportFormat: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

interface BatchState {
  jobs: BatchJob[]
  isProcessing: boolean
  taskId: string | null
  progress: number

  addJob: (job: BatchJob) => void
  removeJob: (index: number) => void
  updateJob: (index: number, patch: Partial<BatchJob>) => void
  clearJobs: () => void
  setIsProcessing: (processing: boolean) => void
  setTaskId: (id: string | null) => void
  setProgress: (progress: number) => void
}

export const useBatchStore = create<BatchState>((set) => ({
  jobs: [],
  isProcessing: false,
  taskId: null,
  progress: 0,

  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),

  removeJob: (index) => set((s) => ({
    jobs: s.jobs.filter((_, i) => i !== index),
  })),

  updateJob: (index, patch) => set((s) => ({
    jobs: s.jobs.map((j, i) => (i === index ? { ...j, ...patch } : j)),
  })),

  clearJobs: () => set({ jobs: [], progress: 0, taskId: null }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setTaskId: (id) => set({ taskId: id }),
  setProgress: (progress) => set({ progress }),
}))
