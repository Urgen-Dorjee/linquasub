import { create } from 'zustand'
import type { PluginInstance, PluginEffect, PluginExportFormat, PluginTool, PluginContext } from '../types/plugin'
import { useTranscriptionStore } from './transcriptionStore'
import { useProjectStore } from './projectStore'
import { useTimelineStore } from './timelineStore'
import toast from 'react-hot-toast'

interface PluginState {
  plugins: PluginInstance[]
  effects: PluginEffect[]
  exportFormats: PluginExportFormat[]
  tools: PluginTool[]

  registerPlugin: (plugin: PluginInstance) => void
  unregisterPlugin: (pluginId: string) => void
  enablePlugin: (pluginId: string) => void
  disablePlugin: (pluginId: string) => void
  getPluginContext: () => PluginContext
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  effects: [],
  exportFormats: [],
  tools: [],

  registerPlugin: (plugin) => {
    set((s) => ({
      plugins: [...s.plugins.filter((p) => p.manifest.id !== plugin.manifest.id), plugin],
    }))
    if (plugin.enabled) {
      plugin.activate(get().getPluginContext())
    }
  },

  unregisterPlugin: (pluginId) => {
    const state = get()
    const plugin = state.plugins.find((p) => p.manifest.id === pluginId)
    if (plugin) {
      plugin.deactivate()
    }
    set((s) => ({
      plugins: s.plugins.filter((p) => p.manifest.id !== pluginId),
      effects: s.effects.filter((e) => !e.id.startsWith(`${pluginId}:`)),
      exportFormats: s.exportFormats.filter((f) => !f.id.startsWith(`${pluginId}:`)),
      tools: s.tools.filter((t) => !t.id.startsWith(`${pluginId}:`)),
    }))
  },

  enablePlugin: (pluginId) => {
    const state = get()
    const plugin = state.plugins.find((p) => p.manifest.id === pluginId)
    if (plugin && !plugin.enabled) {
      plugin.enabled = true
      plugin.activate(state.getPluginContext())
      set((s) => ({
        plugins: s.plugins.map((p) => (p.manifest.id === pluginId ? { ...p, enabled: true } : p)),
      }))
    }
  },

  disablePlugin: (pluginId) => {
    const state = get()
    const plugin = state.plugins.find((p) => p.manifest.id === pluginId)
    if (plugin && plugin.enabled) {
      plugin.deactivate()
      set((s) => ({
        plugins: s.plugins.map((p) => (p.manifest.id === pluginId ? { ...p, enabled: false } : p)),
        effects: s.effects.filter((e) => !e.id.startsWith(`${pluginId}:`)),
        exportFormats: s.exportFormats.filter((f) => !f.id.startsWith(`${pluginId}:`)),
        tools: s.tools.filter((t) => !t.id.startsWith(`${pluginId}:`)),
      }))
    }
  },

  getPluginContext: (): PluginContext => ({
    getSegments: () => useTranscriptionStore.getState().segments,
    getVideoPath: () => useProjectStore.getState().videoPath,
    getPlayhead: () => useTimelineStore.getState().playhead,
    showToast: (message, type = 'info') => {
      if (type === 'success') toast.success(message)
      else if (type === 'error') toast.error(message)
      else toast(message)
    },
    registerEffect: (effect) => {
      set((s) => ({
        effects: [...s.effects.filter((e) => e.id !== effect.id), effect],
      }))
    },
    registerExportFormat: (format) => {
      set((s) => ({
        exportFormats: [...s.exportFormats.filter((f) => f.id !== format.id), format],
      }))
    },
    registerTool: (tool) => {
      set((s) => ({
        tools: [...s.tools.filter((t) => t.id !== tool.id), tool],
      }))
    },
  }),
}))
