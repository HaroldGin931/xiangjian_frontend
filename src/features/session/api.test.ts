import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestPdsSessionRefresh, requestSemiSession } from './api'

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

describe('Semi handoff', () => {
  const ticket = 'a'.repeat(32)
  const handoff = { riceToken: 'rice-token', service: 'https://app.example/pds', did: 'did:plc:alice', handle: 'alice.test', accessJwt: 'pds-access', refreshJwt: 'pds-refresh' }
  it('uses the Rice token for the profile and retains distinct PDS tokens', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(handoff))
      .mockResolvedValueOnce(Response.json({ data: { id: 'user-1', did: handoff.did, handle: handoff.handle } }))
    vi.stubGlobal('fetch', fetchMock)
    const session = await requestSemiSession(ticket)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer rice-token')
    expect(session.token).toBe('rice-token')
    expect(session.pds.access_jwt).toBe('pds-access')
  })
  it('rejects a different Rice identity and invalid tickets instead of pretending login succeeded', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(handoff))
      .mockResolvedValueOnce(Response.json({ data: { id: 'user-2', did: 'did:plc:other', handle: 'other.test' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(requestSemiSession(ticket)).rejects.toThrow('登录信息不完整')
    await expect(requestSemiSession('../wrong')).rejects.toThrow('登录凭证无效')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
