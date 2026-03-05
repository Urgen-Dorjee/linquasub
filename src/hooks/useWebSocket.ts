import { useEffect, useRef } from 'react'
import { handleWebSocketMessage } from '../services/wsMessageHandlers'

const MAX_RECONNECT_DELAY = 30000
const BASE_RECONNECT_DELAY = 1000

export function useWebSocket(port: number | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!port) return

    let unmounted = false

    function connect() {
      if (unmounted) return

      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/progress`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected to progress stream')
        retriesRef.current = 0
      }

      ws.onmessage = handleWebSocketMessage

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        if (!unmounted) {
          scheduleReconnect()
        }
      }

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err)
      }
    }

    function scheduleReconnect() {
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, retriesRef.current),
        MAX_RECONNECT_DELAY
      )
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${retriesRef.current + 1})`)
      retriesRef.current++
      timerRef.current = setTimeout(connect, delay)
    }

    connect()

    return () => {
      unmounted = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [port])

  return wsRef
}
