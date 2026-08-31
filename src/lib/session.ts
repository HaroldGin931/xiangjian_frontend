import { useCallback, useEffect, useState } from 'react'

import type { RiceSession } from './models'

const STORAGE_KEY = 'xiangjian-rice-session'
const CHANGE_EVENT = 'xiangjian-session-change'

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

  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useStoredSession() {
  const [session, setSession] = useState<RiceSession | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const sync = () => {
      setSession(readStoredSession())
      setIsReady(true)
    }

    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const saveSession = useCallback((next: RiceSession | null) => {
    writeStoredSession(next)
  }, [])

  return { session, isReady, saveSession }
}

