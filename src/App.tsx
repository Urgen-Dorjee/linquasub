import { Routes, Route } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import MainLayout from './components/layout/MainLayout'
import ErrorBoundary from './components/common/ErrorBoundary'
import WelcomeDialog from './components/common/WelcomeDialog'
import PageTransition from './components/common/PageTransition'
import HomePage from './pages/HomePage'
import { useProjectStore } from './stores/projectStore'
import { useSettingsStore } from './stores/settingsStore'
import { useWebSocket } from './hooks/useWebSocket'
import { useSessionPersistence } from './hooks/useSessionPersistence'
import { initApi } from './services/api'
import api from './services/api'
import { Loader2 } from 'lucide-react'

const EditorPage = lazy(() => import('./pages/EditorPage'))
const ExportPage = lazy(() => import('./pages/ExportPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const BatchPage = lazy(() => import('./pages/BatchPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-blue-400" size={24} />
    </div>
  )
}

export default function App() {
  const [port, setPort] = useState<number | null>(null)
  const setBackendReady = useProjectStore((s) => s.setBackendReady)
  const setBackendError = useProjectStore((s) => s.setBackendError)
  const setGeminiApiKey = useSettingsStore((s) => s.setGeminiApiKey)
  const setDeeplApiKey = useSettingsStore((s) => s.setDeeplApiKey)
  const setSettingsLoaded = useSettingsStore((s) => s.setSettingsLoaded)

  useEffect(() => {
    initApi().catch(() => {})

    if (window.electronAPI) {
      const unsubReady = window.electronAPI.onBackendReady(async () => {
        setBackendReady(true)
        const p = await window.electronAPI!.getPythonPort()
        setPort(p ?? 8321)
        api.getSettings().then((data) => {
          if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key)
          if (data.deepl_api_key) setDeeplApiKey(data.deepl_api_key)
          setSettingsLoaded(true)
        }).catch(() => setSettingsLoaded(true))
      })
      const unsubError = window.electronAPI.onBackendError((error) => {
        setBackendError(error)
      })
      return () => {
        unsubReady()
        unsubError()
      }
    } else {
      setPort(8321)
      setBackendReady(true)
      api.getSettings().then((data) => {
        if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key)
        if (data.deepl_api_key) setDeeplApiKey(data.deepl_api_key)
        setSettingsLoaded(true)
      }).catch(() => setSettingsLoaded(true))
    }
  }, [setBackendReady, setBackendError])

  const backendReady = useProjectStore((s) => s.backendReady)
  useWebSocket(port)
  useSessionPersistence(backendReady)

  return (
    <MainLayout>
      <WelcomeDialog />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<ErrorBoundary fallbackTitle="Home page error"><PageTransition><HomePage /></PageTransition></ErrorBoundary>} />
          <Route path="/editor" element={<ErrorBoundary fallbackTitle="Editor error"><PageTransition><EditorPage /></PageTransition></ErrorBoundary>} />
          <Route path="/export" element={<ErrorBoundary fallbackTitle="Export error"><PageTransition><ExportPage /></PageTransition></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary fallbackTitle="Settings error"><PageTransition><SettingsPage /></PageTransition></ErrorBoundary>} />
          <Route path="/batch" element={<ErrorBoundary fallbackTitle="Batch error"><PageTransition><BatchPage /></PageTransition></ErrorBoundary>} />
        </Routes>
      </Suspense>
    </MainLayout>
  )
}
