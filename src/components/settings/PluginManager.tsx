import { usePluginStore } from '../../stores/pluginStore'
import { Puzzle, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

export default function PluginManager() {
  const plugins = usePluginStore((s) => s.plugins)
  const effects = usePluginStore((s) => s.effects)
  const exportFormats = usePluginStore((s) => s.exportFormats)
  const tools = usePluginStore((s) => s.tools)
  const enablePlugin = usePluginStore((s) => s.enablePlugin)
  const disablePlugin = usePluginStore((s) => s.disablePlugin)
  const unregisterPlugin = usePluginStore((s) => s.unregisterPlugin)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Puzzle size={18} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Plugins</h3>
      </div>

      {plugins.length === 0 ? (
        <p className="text-xs text-slate-500">No plugins installed. Plugins can extend LinguaSub with custom effects, export formats, and tools.</p>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div key={plugin.manifest.id} className="flex items-center justify-between bg-slate-800 rounded p-2">
              <div>
                <p className="text-xs text-white font-medium">{plugin.manifest.name}</p>
                <p className="text-[10px] text-slate-400">
                  v{plugin.manifest.version} by {plugin.manifest.author}
                </p>
                <p className="text-[10px] text-slate-500">{plugin.manifest.description}</p>
                <div className="flex gap-1 mt-1">
                  {plugin.manifest.capabilities.map((cap) => (
                    <span key={cap} className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => plugin.enabled ? disablePlugin(plugin.manifest.id) : enablePlugin(plugin.manifest.id)}
                  className={`p-1 rounded ${plugin.enabled ? 'text-green-400' : 'text-slate-500'}`}
                  title={plugin.enabled ? 'Disable' : 'Enable'}
                >
                  {plugin.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <button
                  onClick={() => unregisterPlugin(plugin.manifest.id)}
                  className="p-1 rounded text-slate-500 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary of registered extensions */}
      {(effects.length > 0 || exportFormats.length > 0 || tools.length > 0) && (
        <div className="border-t border-slate-800 pt-2 space-y-1">
          <p className="text-[10px] text-slate-400 font-semibold">Registered Extensions</p>
          {effects.length > 0 && (
            <p className="text-[10px] text-slate-500">{effects.length} effect(s): {effects.map((e) => e.name).join(', ')}</p>
          )}
          {exportFormats.length > 0 && (
            <p className="text-[10px] text-slate-500">{exportFormats.length} export format(s): {exportFormats.map((f) => f.name).join(', ')}</p>
          )}
          {tools.length > 0 && (
            <p className="text-[10px] text-slate-500">{tools.length} tool(s): {tools.map((t) => t.name).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
