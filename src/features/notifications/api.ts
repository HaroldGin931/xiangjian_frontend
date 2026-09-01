import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { NotificationView } from '~/lib/models'

export function normalizeNotifications(payload: unknown): NotificationView[] {
  const body = (payload ?? {}) as {
    notifications?: Array<{
      uri?: unknown
      author?: { handle?: unknown; displayName?: unknown }
      reason?: unknown
      record?: { text?: unknown }
      isRead?: unknown
      indexedAt?: unknown
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
