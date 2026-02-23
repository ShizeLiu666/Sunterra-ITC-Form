import { useState, useEffect, useRef } from 'react'
import './NetworkStatus.css'

const WifiOffIcon = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
)

const WifiOnIcon = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
)

const PING_INTERVAL = 30_000
const PING_TIMEOUT = 5_000
const FAIL_THRESHOLD = 2
const RESTORED_DURATION = 2_000

const checkRealConnectivity = async (): Promise<boolean> => {
  try {
    const response = await fetch('/favicon.png', {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(PING_TIMEOUT),
    })
    return response.ok
  } catch {
    return false
  }
}

const NetworkStatus: React.FC = () => {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine)
  const [connectionVerified, setConnectionVerified] = useState(true)
  const [showRestored, setShowRestored] = useState(false)

  const wasOfflineRef = useRef(false)
  const failCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const showRestoredBriefly = () => {
      setShowRestored(true)
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current)
      restoredTimerRef.current = setTimeout(
        () => setShowRestored(false),
        RESTORED_DURATION,
      )
    }

    const runPingCheck = async () => {
      if (document.visibilityState !== 'visible') return
      if (!navigator.onLine) return

      const ok = await checkRealConnectivity()

      if (ok) {
        const wasPreviouslyOffline = wasOfflineRef.current
        failCountRef.current = 0
        setConnectionVerified(true)
        if (wasPreviouslyOffline) {
          wasOfflineRef.current = false
          showRestoredBriefly()
        }
      } else {
        failCountRef.current += 1
        if (failCountRef.current >= FAIL_THRESHOLD) {
          setConnectionVerified(false)
          wasOfflineRef.current = true
        }
      }
    }

    const handleOnline = () => {
      setBrowserOnline(true)
      failCountRef.current = 0

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false
        showRestoredBriefly()
      }

      runPingCheck()
    }

    const handleOffline = () => {
      setBrowserOnline(false)
      wasOfflineRef.current = true
      failCountRef.current = 0
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    intervalRef.current = setInterval(runPingCheck, PING_INTERVAL)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current)
    }
  }, [])

  const effectivelyOffline = !browserOnline || !connectionVerified
  const isFakeOnline = browserOnline && !connectionVerified

  if (!effectivelyOffline && !showRestored) return null

  if (effectivelyOffline) {
    return (
      <div className="network-overlay network-offline">
        <div className="network-overlay-content">
          <div className="network-icon">
            <WifiOffIcon />
          </div>
          <p className="network-title">Network Disconnected</p>
          <p className="network-subtitle">
            {isFakeOnline
              ? 'Connected to network but no internet access. Your form data has been saved locally.'
              : 'Your form data has been saved locally'}
          </p>
          <div className="network-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="network-overlay network-online">
      <div className="network-overlay-content">
        <div className="network-icon">
          <WifiOnIcon />
        </div>
        <p className="network-title">Connection Restored</p>
      </div>
    </div>
  )
}

export default NetworkStatus
