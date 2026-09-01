import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { NotificationFeed, NotificationView } from '~/lib/models'

export function normalizeNotificationFeed(payload: unknown): NotificationFeed {
  const body = (payload ?? {}) as {
    notifications?: Array<{
      uri?: unknown
      cid?: unknown
      author?: { did?: unknown; handle?: unknown; displayName?: unknown }
      reason?: unknown
      reasonSubject?: unknown
      record?: { text?: unknown }
      isRead?: unknown
      indexedAt?: unknown
    }>
    priority?: boolean
    seenAt?: string
  }
  const notifications = (body.notifications ?? [])
    .filter(
      (notification) =>
        typeof notification.uri === 'string' &&
        typeof notification.author?.handle === 'string',
    )
    .map(
      (notification): NotificationView => ({
        uri: notification.uri as string,
        cid: typeof notification.cid === 'string' ? notification.cid : '',
        author: {
          did:
            typeof notification.author?.did === 'string'
              ? notification.author.did
              : '',
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
        reasonSubject:
          typeof notification.reasonSubject === 'string'
            ? notification.reasonSubject
            : undefined,
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

  return {
    notifications,
    priority: body.priority === true,
    seenAt: body.seenAt,
  }
}

export const getNotifications = createServerFn({ method: 'POST' })
  .validator((accessJwt: string) => accessJwt)
  .handler(async ({ data: accessJwt }) => {
    const body = await requestJson<unknown>(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.notification.listNotifications?limit=30`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    return normalizeNotificationFeed(body)
  })
