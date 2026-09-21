import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RiceSession } from '~/lib/models'

import {
  readStoredSession,
  refreshStoredSession,
  refreshStoredUser,
  tokenExpiresSoon,
  writeStoredSession,
} from './session'

afterEach(() => vi.unstubAllGlobals())

function useMemoryStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
    dispatchEvent: vi.fn(),
  })
}

const storedSession = {
  token: 'rice-token',
  user: { id: 'mo', did: 'did:example:mo', handle: 'mo.local', nickname: '旧名字' },
  pds: {
    service: 'http://pds',
    did: 'did:example:mo',
    handle: 'mo.local',
    access_jwt: 'expired-access',
    refresh_jwt: 'one-use-refresh',
  },
} as RiceSession

function jwt(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `header.${payload}.signature`
}

describe('PDS session lifetime', () => {
  it('refreshes only tokens that are expired or about to expire', () => {
    const now = Date.UTC(2026, 8, 1)
    expect(tokenExpiresSoon(jwt(now / 1000 + 30), now)).toBe(true)
    expect(tokenExpiresSoon(jwt(now / 1000 + 120), now)).toBe(false)
  })

  it('deduplicates concurrent refreshes that use one rotating refresh token', async () => {
    const stored = storedSession
    const refreshedPds = {
      ...stored.pds,
      access_jwt: 'fresh-access',
      refresh_jwt: 'rotated-refresh',
    }
    const refresh = vi.fn(async () => refreshedPds)

    const [first, second] = await Promise.all([
      refreshStoredSession(stored, refresh),
      refreshStoredSession(stored, refresh),
    ])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(first.pds).toEqual(refreshedPds)
    expect(second).toEqual(first)
  })

  it.each(['logout', 'another account', 'new login'])(
    'does not restore an old session when refresh finishes after %s',
    async (change) => {
      useMemoryStorage()
      writeStoredSession(storedSession)
      const next = change === 'logout' ? null : {
        ...storedSession,
        token: 'new-rice-token',
        user: { ...storedSession.user, did: change === 'another account' ? 'did:example:other' : storedSession.user.did },
        pds: {
          ...storedSession.pds,
          did: change === 'another account' ? 'did:example:other' : storedSession.pds.did,
        },
      }

      await refreshStoredSession(storedSession, async () => {
        writeStoredSession(next)
        return { ...storedSession.pds, access_jwt: 'refreshed-access' }
      })

      expect(readStoredSession()).toEqual(next)
    },
  )

  it('preserves profile changes made while the PDS token refresh was pending', async () => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    const updated = { ...storedSession, user: { ...storedSession.user, nickname: '新名字' } }
    const pds = { ...storedSession.pds, access_jwt: 'refreshed-access', refresh_jwt: 'rotated' }

    await refreshStoredSession(storedSession, async () => {
      writeStoredSession(updated)
      return pds
    })

    expect(readStoredSession()).toEqual({ ...updated, pds })
  })
})

describe('stored session boundaries', () => {
  it.each([null, {}, [], { ...storedSession, user: undefined }, { ...storedSession, pds: undefined }, { ...storedSession, user: { id: 'mo' } }])(
    'never exposes incomplete cached data as a logged-in session: %j',
    (value) => {
      useMemoryStorage()
      window.localStorage.setItem('xiangjian-rice-session', JSON.stringify(value))
      expect(readStoredSession()).toBeNull()
    },
  )

  it('repairs the observed token+pds cache from the current user endpoint', async () => {
    useMemoryStorage()
    const { user, ...credentials } = storedSession
    window.localStorage.setItem('xiangjian-rice-session', JSON.stringify(credentials))
    expect(readStoredSession()).toBeNull()
    const loadUser = vi.fn().mockResolvedValue(user)
    await expect(refreshStoredUser(credentials, loadUser)).resolves.toEqual(storedSession)
    expect(loadUser).toHaveBeenCalledWith({ data: credentials.token })
    expect(readStoredSession()).toEqual(storedSession)
  })

  it.each([undefined, {}, { ...storedSession.user, did: 'did:example:other' }])(
    'preserves the last valid session when profile loading returns invalid data: %j',
    async (user) => {
      useMemoryStorage()
      writeStoredSession(storedSession)
      await expect(refreshStoredUser(storedSession, vi.fn().mockResolvedValue(user))).rejects.toThrow('用户资料返回异常')
      expect(readStoredSession()).toEqual(storedSession)
    },
  )

  it('clears expired credentials but preserves network failures and a newer login', async () => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    await expect(refreshStoredUser(storedSession, async () => null)).resolves.toBeNull()
    expect(readStoredSession()).toBeNull()

    writeStoredSession(storedSession)
    await expect(refreshStoredUser(storedSession, async () => { throw new TypeError('Failed to fetch') })).rejects.toThrow()
    expect(readStoredSession()).toEqual(storedSession)
    await refreshStoredUser(storedSession, async () => null, () => false)
    expect(readStoredSession()).toEqual(storedSession)

    const newer = { ...storedSession, token: 'new-login-token' }
    await refreshStoredUser(storedSession, async () => {
      writeStoredSession(newer)
      return null
    })
    expect(readStoredSession()).toEqual(newer)
  })

  it('does not overwrite a valid cache with an invalid login result', () => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    expect(() => writeStoredSession({ ...storedSession, user: undefined } as unknown as RiceSession)).toThrow('登录信息不完整')
    expect(readStoredSession()).toEqual(storedSession)
  })

  it.each(['logout', 'new login'])('does not restore a pending profile response after %s', async (change) => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    const next = change === 'logout' ? null : { ...storedSession, token: 'new-login-token' }
    const result = await refreshStoredUser(storedSession, async () => {
      writeStoredSession(next)
      return storedSession.user
    })
    expect(result).toEqual(next)
    expect(readStoredSession()).toEqual(next)
  })

  it('rejects an invalid PDS refresh without damaging the previous session', async () => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    await expect(refreshStoredSession(storedSession, vi.fn().mockResolvedValue(undefined))).rejects.toThrow('登录状态刷新失败')
    expect(readStoredSession()).toEqual(storedSession)
  })

  it('does not overwrite an edited profile with an older same-account response', async () => {
    useMemoryStorage()
    writeStoredSession(storedSession)
    let revision = 0
    const requestRevision = revision
    const edited = { ...storedSession, user: { ...storedSession.user, nickname: '新昵称' } }
    const result = await refreshStoredUser(storedSession, async () => {
      writeStoredSession(edited)
      revision++
      return storedSession.user
    }, () => revision === requestRevision)
    expect(result).toEqual(edited)
    expect(readStoredSession()).toEqual(edited)
  })
})
