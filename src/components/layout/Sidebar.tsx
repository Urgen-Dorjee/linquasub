import { NavLink } from 'react-router-dom'
import { Home, PenTool, Download, Settings, Layers } from 'lucide-react'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/editor', icon: PenTool, label: 'Editor' },
  { to: '/export', icon: Download, label: 'Export' },
  { to: '/batch', icon: Layers, label: 'Batch' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside
      className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-2"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mb-6">
        <motion.div
          className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/20"
          aria-label="LinguaSub"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          LS
        </motion.div>
      </div>

      <nav className="flex flex-col gap-1 flex-1" aria-label="Page navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              clsx(
                'relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg transition-all duration-150 text-xs group',
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-blue-600/15 rounded-lg border border-blue-500/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon size={20} aria-hidden="true" className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
