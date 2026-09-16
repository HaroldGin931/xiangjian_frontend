import { describe, expect, it } from 'vitest'

import { notificationTarget, normalizeNotifications } from './api'

const author = { did: 'did:plc:actor', handle: 'mo.local', displayName: '小莫' }
const postUri = 'at://did:plc:poster/app.bsky.feed.post/post-1'
const interactionUri = 'at://did:plc:actor/app.bsky.feed.like/like-1'

function targetFor(fields: Record<string, unknown>) {
  const [notification] = normalizeNotifications({
    notifications: [{ uri: interactionUri, author, reason: 'like', ...fields }],
  })
  return notificationTarget(notification)
}

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
        author: { did: notification.author.did, handle: notification.author.handle },
        reason: notification.reason,
        text: '一条通知内容',
        isRead: notification.isRead,
        indexedAt: notification.indexedAt,
        taskId: notification.taskId,
      },
    ])
  })

  it('tolerates missing or malformed lists and entries', () => {
    for (const payload of [null, {}, { notifications: {} }, { notifications: [null, {}, 'invalid'] }]) {
      expect(normalizeNotifications(payload)).toEqual([])
    }
  })

  it('preserves the post references and actor identity in social notifications', () => {
    const [notification] = normalizeNotifications({ notifications: [{
      uri: interactionUri,
      author,
      reason: 'like',
      reasonSubject: postUri,
      record: { subject: { uri: postUri, cid: 'post-cid' } },
    }] })
    expect(notification).toMatchObject({ author, reasonSubject: postUri, recordSubjectUri: postUri })
  })
})

describe('notification destinations', () => {
  it.each(['like', 'repost'])('opens the referenced post for %s, never the interaction record', (reason) => {
    const uri = `at://did:plc:actor/app.bsky.feed.${reason}/interaction-1`
    expect(targetFor({ reason, uri, reasonSubject: postUri })).toEqual({ kind: 'post', uri: postUri })
    expect(targetFor({ reason, uri, record: { subject: { uri: postUri } } })).toEqual({ kind: 'post', uri: postUri })
    expect(targetFor({ reason, uri })).toBeNull()
  })

  it('uses a valid record subject when reasonSubject is not a post', () => {
    expect(targetFor({
      reasonSubject: 'at://did:plc:actor/app.bsky.feed.generator/feed-1',
      record: { subject: { uri: postUri } },
    })).toEqual({ kind: 'post', uri: postUri })
  })

  it.each(['reply', 'mention', 'quote', 'subscribed-post'])('opens the new post for %s', (reason) => {
    expect(targetFor({ reason, uri: postUri, reasonSubject: 'at://did:plc:poster/app.bsky.feed.post/parent-1' }))
      .toEqual({ kind: 'post', uri: postUri })
  })

  it('opens the follower profile by DID, with a handle fallback', () => {
    expect(targetFor({ reason: 'follow' })).toEqual({ kind: 'profile', actor: author.did })
    expect(targetFor({ reason: 'follow', author: { handle: author.handle } })).toEqual({ kind: 'profile', actor: author.handle })
  })

  it('supports legacy task IDs and shared Rice inbox targets', () => {
    expect(targetFor({ reason: 'task-result_submitted', taskId: 'task-1' })).toEqual({ kind: 'task', id: 'task-1' })
    for (const kind of ['task', 'event', 'node']) {
      expect(targetFor({ subjectType: kind, subjectId: `${kind}-1` })).toEqual({ kind, id: `${kind}-1` })
    }
    expect(targetFor({ subjectType: 'task', subjectId: '', taskId: 'task-1' })).toEqual({ kind: 'task', id: 'task-1' })
  })

  it.each([
    { reason: 'unknown', uri: postUri },
    { reason: 'like', reasonSubject: 'https://example.test/post/1' },
    { reason: 'like', reasonSubject: interactionUri },
    { reason: 'like', record: { subject: { uri: 123 } } },
    { reason: 'reply', uri: 'at://did:plc:actor/app.bsky.feed.post/' },
    { reason: 'reply', uri: interactionUri },
    { reason: 'follow', author: { handle: 'unknown', did: 'https://example.test' } },
    { subjectType: 'event', taskId: 'task-1' },
    { subjectType: 'node', subjectId: ' ' },
    { subjectType: 'wallet', subjectId: 'wallet-1', taskId: 'task-1' },
  ])('leaves unsupported or malformed destinations unopened: %j', (fields) => {
    expect(targetFor(fields)).toBeNull()
  })
})
