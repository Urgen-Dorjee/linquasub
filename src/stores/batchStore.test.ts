import { describe, it, expect, beforeEach } from 'vitest'
import { useBatchStore, type BatchJob } from './batchStore'

const makeJob = (name: string): BatchJob => ({
  videoPath: `/videos/${name}.mp4`,
  fileName: `${name}.mp4`,
  operations: ['transcribe'],
  targetLanguage: 'en',
  exportFormat: 'srt',
  status: 'pending',
})

function resetStore() {
  useBatchStore.setState({ jobs: [], isProcessing: false, taskId: null, progress: 0 })
}

describe('batchStore', () => {
  beforeEach(resetStore)

  it('starts with empty state', () => {
    const state = useBatchStore.getState()
    expect(state.jobs).toHaveLength(0)
    expect(state.isProcessing).toBe(false)
  })

  it('adds jobs', () => {
    const store = useBatchStore.getState()
    store.addJob(makeJob('video1'))
    store.addJob(makeJob('video2'))
    expect(useBatchStore.getState().jobs).toHaveLength(2)
  })

  it('removes a job by index', () => {
    const store = useBatchStore.getState()
    store.addJob(makeJob('a'))
    store.addJob(makeJob('b'))
    store.addJob(makeJob('c'))
    store.removeJob(1)

    const jobs = useBatchStore.getState().jobs
    expect(jobs).toHaveLength(2)
    expect(jobs[0].fileName).toBe('a.mp4')
    expect(jobs[1].fileName).toBe('c.mp4')
  })

  it('updates a job by index', () => {
    const store = useBatchStore.getState()
    store.addJob(makeJob('test'))
    store.updateJob(0, { status: 'processing' })
    expect(useBatchStore.getState().jobs[0].status).toBe('processing')
  })

  it('updates job with error', () => {
    const store = useBatchStore.getState()
    store.addJob(makeJob('test'))
    store.updateJob(0, { status: 'error', error: 'Failed to transcribe' })

    const job = useBatchStore.getState().jobs[0]
    expect(job.status).toBe('error')
    expect(job.error).toBe('Failed to transcribe')
  })

  it('clears all jobs and resets state', () => {
    const store = useBatchStore.getState()
    store.addJob(makeJob('v1'))
    store.addJob(makeJob('v2'))
    store.setProgress(50)
    store.setTaskId('task-1')
    store.clearJobs()

    const state = useBatchStore.getState()
    expect(state.jobs).toHaveLength(0)
    expect(state.progress).toBe(0)
    expect(state.taskId).toBeNull()
  })

  it('tracks processing state', () => {
    const store = useBatchStore.getState()
    store.setIsProcessing(true)
    store.setProgress(30)
    store.setTaskId('batch-task-1')

    const state = useBatchStore.getState()
    expect(state.isProcessing).toBe(true)
    expect(state.progress).toBe(30)
    expect(state.taskId).toBe('batch-task-1')
  })
})
