import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestPdsSessionRefresh } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('PDS session refresh', () => {
  it('uses the AT Protocol POST method with the refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessJwt: 'fresh-access',
          refreshJwt: 'rotated-refresh',
          did: 'did:example:mo',
          handle: 'mo.local',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestPdsSessionRefresh({
      service: 'http://pds',
      did: 'did:example:mo',
      handle: 'mo.local',
      access_jwt: 'expired-access',
      refresh_jwt: 'one-use-refresh',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('com.atproto.server.refreshSession'),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer one-use-refresh' },
      }),
    )
    expect(result.refresh_jwt).toBe('rotated-refresh')
  })
})
