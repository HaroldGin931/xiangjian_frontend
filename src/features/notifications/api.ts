import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { NotificationView } from '~/lib/models'

export const NOTIFICATIONS_READ_EVENT = 'xiangjian-notifications-read'

export type NotificationTarget =
  | { kind: 'task' | 'event' | 'node'; id: string }
  | { kind: 'post'; uri: string }
  | { kind: 'profile'; actor: string }

function isPostUri(uri: string | undefined): uri is string {
  return typeof uri === 'string' && /^at:\/\/[^/\s?#]+\/app\.bsky\.feed\.post\/[^/\s?#]+$/.test(uri)
}

export function notificationTarget(notification: NotificationView): NotificationTarget | null {
  const { subjectType, subjectId, taskId, reason } = notification
  if (subjectType === 'event' || subjectType === 'node') {
    return subjectId?.trim() ? { kind: subjectType, id: subjectId } : null
  }
  if (subjectType === 'task' || (!subjectType && taskId)) {
    const id = subjectId?.trim() ? subjectId : taskId
    return id?.trim() ? { kind: 'task', id } : null
  }
  if (subjectType) return null

  if (reason === 'like' || reason === 'repost') {
    // The notification URI is the like/repost record, not the post being referenced.
    const uri = [notification.reasonSubject, notification.recordSubjectUri].find(isPostUri)
    return uri ? { kind: 'post', uri } : null
  }
  if (['reply', 'mention', 'quote', 'subscribed-post'].includes(reason)) {
    return isPostUri(notification.uri) ? { kind: 'post', uri: notification.uri } : null
  }
  if (reason === 'follow') {
    const { did, handle } = notification.author
    if (did && /^did:[a-z0-9]+:[^\s/?#]+$/i.test(did)) return { kind: 'profile', actor: did }
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(handle)) return { kind: 'profile', actor: handle }
  }
  return null
}

export function normalizeNotifications(payload: unknown): NotificationView[] {
  const body = (payload ?? {}) as {
    notifications?: Array<{
      uri?: unknown
      author?: { did?: unknown; handle?: unknown; displayName?: unknown }
      reason?: unknown
      reasonSubject?: unknown
      record?: { text?: unknown; subject?: { uri?: unknown } }
      isRead?: unknown
      indexedAt?: unknown
      taskId?: unknown
      subjectType?: unknown
      subjectId?: unknown
    }>
  }
  return (Array.isArray(body.notifications) ? body.notifications : [])
    .filter(
      (notification) =>
        notification != null &&
        typeof notification.uri === 'string' &&
        typeof notification.author?.handle === 'string',
    )
    .map(
      (notification): NotificationView => ({
        uri: notification.uri as string,
        author: {
          ...(typeof notification.author?.did === 'string' ? { did: notification.author.did } : {}),
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
        ...(typeof notification.reasonSubject === 'string' ? { reasonSubject: notification.reasonSubject } : {}),
        ...(typeof notification.record?.subject?.uri === 'string' ? { recordSubjectUri: notification.record.subject.uri } : {}),
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
