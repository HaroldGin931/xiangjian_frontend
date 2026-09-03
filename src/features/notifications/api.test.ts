import { describe, expect, it } from 'vitest'

import { normalizeNotifications } from './api'

describe('notification data', () => {
  it('keeps only usable notifications without adding demo entries', () => {
    const notification = {
      uri: 'at://did:example/app.bsky.feed.like/1',
      cid: 'cid',
      author: { did: 'did:example', handle: 'mo.local' },
      reason: 'like',
      record: { text: '一条通知内容' },
      isRead: false,
      indexedAt: '2026-09-01T00:00:00.000Z',
      taskId: 'task-1',
    }

    expect(
      normalizeNotifications({
        notifications: [notification, { reason: 'like' }],
        priority: true,
      }),
    ).toEqual([
      {
        uri: notification.uri,
        author: { handle: notification.author.handle },
        reason: notification.reason,
        text: '一条通知内容',
        isRead: notification.isRead,
        indexedAt: notification.indexedAt,
        taskId: notification.taskId,
      },
    ])
  })
})
