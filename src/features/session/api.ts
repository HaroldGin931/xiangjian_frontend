import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { RiceSession, RiceUser } from '~/lib/models'

export const loginRice = createServerFn({ method: 'POST' })
  .validator((data: { identifier: string; password: string }) => data)
  .handler(async ({ data }) => {
    const body = await requestJson<{ data: RiceSession }>(`${BACKEND_BASE}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: data.identifier.trim().toLowerCase(),
        password: data.password,
      }),
    })
    return body.data
  })

export const logoutRice = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    await requestJson(`${BACKEND_BASE}/api/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return true
  })

export const getCurrentUser = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const body = await requestJson<{ data: RiceUser }>(`${BACKEND_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return body.data
  })

export const refreshPdsSession = createServerFn({ method: 'POST' })
  .validator((pds: RiceSession['pds']) => pds)
  .handler(async ({ data: pds }) => {
    const body = await requestJson<{
      accessJwt: string
      refreshJwt: string
      did: string
      handle: string
    }>(
      `${BACKEND_BASE}/pds/xrpc/com.atproto.server.refreshSession`,
      { headers: { Authorization: `Bearer ${pds.refresh_jwt}` } },
    )
    return {
      service: pds.service,
      did: body.did,
      handle: body.handle,
      access_jwt: body.accessJwt,
      refresh_jwt: body.refreshJwt,
    }
  })
