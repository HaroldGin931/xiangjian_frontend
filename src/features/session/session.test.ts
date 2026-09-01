import { describe, expect, it, vi } from 'vitest'

import type { RiceSession } from '~/lib/models'

import { refreshStoredSession, tokenExpiresSoon } from './session'

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
    const stored = {
      token: 'rice-token',
      pds: {
        service: 'http://pds',
        did: 'did:example:mo',
        handle: 'mo.local',
        access_jwt: 'expired-access',
        refresh_jwt: 'one-use-refresh',
      },
    } as RiceSession
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
})
