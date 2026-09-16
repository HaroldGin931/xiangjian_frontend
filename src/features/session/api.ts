import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { RiceSession, RiceUser } from '~/lib/models'
import { isPdsSession, isRiceSession, isSessionUser } from './session-data'

export async function requestPdsSessionRefresh(pds: RiceSession['pds']) {
  const body = await requestJson<{
    accessJwt: string
    refreshJwt: string
    did: string
    handle: string
  }>(
    `${BACKEND_BASE}/pds/xrpc/com.atproto.server.refreshSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${pds.refresh_jwt}` },
    },
  )
  const refreshed = {
    service: pds.service,
    did: body.did,
    handle: body.handle,
    access_jwt: body.accessJwt,
    refresh_jwt: body.refreshJwt,
  }
  if (!isPdsSession(refreshed) || refreshed.did !== pds.did) throw new Error('登录状态刷新失败，请重新登录。')
  return refreshed
}

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
    if (!isRiceSession(body.data)) throw new Error('登录信息返回异常，请稍后重试。')
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
    if (!isSessionUser(body.data)) throw new Error('用户资料返回异常，请稍后重试。')
    return body.data
  })

export const refreshPdsSession = createServerFn({ method: 'POST' })
  .validator((pds: RiceSession['pds']) => pds)
  .handler(({ data }) => requestPdsSessionRefresh(data))
