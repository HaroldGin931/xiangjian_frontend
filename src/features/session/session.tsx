import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { RiceSession } from '~/lib/models'

import { refreshPdsSession } from './api'

const STORAGE_KEY = 'xiangjian-rice-session'
const CHANGE_EVENT = 'xiangjian-session-change'
const pendingRefreshes = new Map<string, Promise<RiceSession>>()
type PdsRefresh = (input: {
  data: RiceSession['pds']
}) => Promise<RiceSession['pds']>

type SessionState = {
  session: RiceSession | null
  isReady: boolean
  saveSession: (session: RiceSession | null) => void
}

const SessionContext = createContext<SessionState | null>(null)

export function readStoredSession(): RiceSession | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as RiceSession) : null
  } catch {
    return null
  }
}

export function writeStoredSession(session: RiceSession | null) {
  if (typeof window === 'undefined') return

  if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function tokenExpiresSoon(
  token: string,
  now = Date.now(),
  thresholdMs = 60_000,
) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(normalized)) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 <= now + thresholdMs
  } catch {
    return false
  }
}

export function refreshStoredSession(
  stored: RiceSession,
  refresh: PdsRefresh = refreshPdsSession,
) {
  const key = stored.pds.refresh_jwt
  const pending = pendingRefreshes.get(key)
  if (pending) return pending

  const request = refresh({ data: stored.pds })
    .then((pds) => {
      const refreshed = { ...stored, pds }
      writeStoredSession(refreshed)
      return refreshed
    })
    .finally(() => {
      if (pendingRefreshes.get(key) === request) pendingRefreshes.delete(key)
    })
  pendingRefreshes.set(key, request)
  return request
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RiceSession | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    const sync = async () => {
      const stored = readStoredSession()
      if (!stored || !tokenExpiresSoon(stored.pds.access_jwt)) {
        if (active) {
          setSession(stored)
          setIsReady(true)
        }
        return
      }

      try {
        const refreshed = await refreshStoredSession(stored)
        if (active) setSession(refreshed)
      } catch {
        if (active) setSession(stored)
      } finally {
        if (active) setIsReady(true)
      }
    }

    void sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      active = false
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const saveSession = useCallback((next: RiceSession | null) => {
    writeStoredSession(next)
  }, [])

  return (
    <SessionContext.Provider value={{ session, isReady, saveSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useStoredSession() {
  const state = useContext(SessionContext)
  if (!state) throw new Error('useStoredSession 必须在 SessionProvider 内使用')
  return state
}
