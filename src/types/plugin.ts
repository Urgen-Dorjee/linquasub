import type { Segment } from './subtitle'

export interface PluginManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  capabilities: PluginCapability[]
}

export type PluginCapability =
  | 'effect'
  | 'export-format'
  | 'ai-model'
  | 'subtitle-style'
  | 'tool'

export interface PluginContext {
  getSegments: () => Segment[]
  getVideoPath: () => string | null
  getPlayhead: () => number
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  registerEffect: (effect: PluginEffect) => void
  registerExportFormat: (format: PluginExportFormat) => void
  registerTool: (tool: PluginTool) => void
}

export interface PluginEffect {
  id: string
  name: string
  category: 'video' | 'audio' | 'subtitle'
  parameters: PluginParameter[]
  apply: (params: Record<string, number | string | boolean>) => Promise<void>
}

export interface PluginExportFormat {
  id: string
  name: string
  extension: string
  export: (segments: Segment[], options: Record<string, unknown>) => Promise<Blob | string>
}

export interface PluginTool {
  id: string
  name: string
  icon?: string
  activate: () => void
  deactivate: () => void
}

export interface PluginParameter {
  key: string
  label: string
  type: 'number' | 'string' | 'boolean' | 'select'
  default: number | string | boolean
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: string }>
}

export interface PluginInstance {
  manifest: PluginManifest
  enabled: boolean
  activate: (ctx: PluginContext) => void
  deactivate: () => void
}
