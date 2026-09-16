import { useEffect, useMemo } from 'react'

// One card owns one response; unmounting the card releases it. Never shared by accounts.
export function createDetailPrefetch<T>(fetchDetail: () => Promise<T>) {
  let request: Promise<T> | undefined
  let expiresAt = 0
  const clear = () => { request = undefined; expiresAt = 0 }
  const load = () => {
    if (!request || Date.now() >= expiresAt) {
      expiresAt = Infinity
      const next = fetchDetail().then((value) => {
        if (request === next) expiresAt = Date.now() + 30_000
        return value
      }, (error) => {
        if (request === next) clear()
        throw error
      })
      request = next
    }
    return request
  }
  return { load, clear }
}

export function useDetailPrefetch<T>(fetchDetail: () => Promise<T>) {
  const resource = useMemo(() => createDetailPrefetch(fetchDetail), [fetchDetail])
  useEffect(() => {
    window.addEventListener('rice-changed', resource.clear)
    return () => window.removeEventListener('rice-changed', resource.clear)
  }, [resource])
  return resource.load
}
