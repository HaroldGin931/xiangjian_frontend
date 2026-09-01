import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { RiceSession } from '~/lib/models'

import { getCurrentUser, refreshPdsSession } from './api'

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
      if (!stored) {
        if (active) {
          setSession(null)
          setIsReady(true)
        }
        return
      }

      let current = stored
      if (tokenExpiresSoon(stored.pds.access_jwt)) {
        try {
          current = await refreshStoredSession(stored)
        } catch {
          // PDS 暂时不可用时仍可继续使用 Rice 账号能力。
        }
      }

      try {
        const user = await getCurrentUser({ data: current.token })
        current = { ...current, user }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      } catch {
        // 保留现有会话，让具体页面显示 Rice 或 PDS 返回的错误。
      } finally {
        if (active) {
          setSession(current)
          setIsReady(true)
        }
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
