import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { NotificationView } from '~/lib/models'

export const NOTIFICATIONS_READ_EVENT = 'xiangjian-notifications-read'

export function normalizeNotifications(payload: unknown): NotificationView[] {
  const body = (payload ?? {}) as {
    notifications?: Array<{
      uri?: unknown
      author?: { handle?: unknown; displayName?: unknown }
      reason?: unknown
      record?: { text?: unknown }
      isRead?: unknown
      indexedAt?: unknown
      taskId?: unknown
      subjectType?: unknown
      subjectId?: unknown
    }>
  }
  return (body.notifications ?? [])
    .filter(
      (notification) =>
        typeof notification.uri === 'string' &&
        typeof notification.author?.handle === 'string',
    )
    .map(
      (notification): NotificationView => ({
        uri: notification.uri as string,
        author: {
          handle: notification.author?.handle as string,
          displayName:
            typeof notification.author?.displayName === 'string'
              ? notification.author.displayName
              : undefined,
        },
        reason:
          typeof notification.reason === 'string'
            ? notification.reason
            : 'unknown',
        text:
          typeof notification.record?.text === 'string'
            ? notification.record.text
            : '',
        isRead: notification.isRead === true,
        indexedAt:
          typeof notification.indexedAt === 'string'
            ? notification.indexedAt
            : new Date(0).toISOString(),
        ...(typeof notification.subjectType === 'string' ? { subjectType: notification.subjectType } : {}),
        ...(typeof notification.subjectId === 'string' ? { subjectId: notification.subjectId } : {}),
        ...(typeof notification.taskId === 'string'
          ? { taskId: notification.taskId }
          : {}),
      }),
    )
}

export const getNotifications = createServerFn({ method: 'POST' })
  .validator((accessJwt: string) => accessJwt)
  .handler(async ({ data: accessJwt }) => {
    const body = await requestJson<unknown>(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.notification.listNotifications?limit=30`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    return normalizeNotifications(body)
  })

export const getTaskNotifications = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const body = await requestJson<unknown>(`${BACKEND_BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return normalizeNotifications(body)
  })

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .validator((accessJwt: string) => accessJwt)
  .handler(async ({ data: accessJwt }) => {
    await requestJson(`${BACKEND_BASE}/pds/xrpc/app.bsky.notification.updateSeen`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seenAt: new Date().toISOString() }),
    })
  })

export const markTaskNotificationsRead = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    await requestJson(`${BACKEND_BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  })
