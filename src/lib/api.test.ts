import { describe, expect, it } from 'vitest'

import {
  normalizeNotificationFeed,
  normalizePostFeed,
  normalizePostThread,
  recordKeyFromUri,
} from './api'

describe('normalizePostFeed', () => {
  it('accepts both feed wrappers and direct search results', () => {
    const post = {
      uri: 'at://did:example/app.bsky.feed.post/1',
      cid: 'cid',
      indexedAt: '2026-09-01T00:00:00.000Z',
      author: { did: 'did:example', handle: 'mo.local' },
      record: { text: '真实帖子', createdAt: '2026-09-01T00:00:00.000Z' },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
    }

    expect(normalizePostFeed({ posts: [{ post }], total: 1 })).toEqual({
      posts: [post],
      total: 1,
    })
    expect(normalizePostFeed({ posts: [post] })).toEqual({
      posts: [post],
      total: 1,
    })
  })
})

describe('normalizeNotificationFeed', () => {
  it('keeps only usable notifications without adding demo entries', () => {
    const notification = {
      uri: 'at://did:example/app.bsky.feed.like/1',
      cid: 'cid',
      author: { did: 'did:example', handle: 'mo.local' },
      reason: 'like',
      record: { text: '一条通知内容' },
      isRead: false,
      indexedAt: '2026-09-01T00:00:00.000Z',
    }

    expect(
      normalizeNotificationFeed({
        notifications: [notification, { reason: 'like' }],
        priority: true,
      }),
    ).toEqual({
      notifications: [
        {
          uri: notification.uri,
          cid: notification.cid,
          author: notification.author,
          reason: notification.reason,
          reasonSubject: undefined,
          text: '一条通知内容',
          isRead: notification.isRead,
          indexedAt: notification.indexedAt,
        },
      ],
      priority: true,
      seenAt: undefined,
    })
  })
})

describe('post interactions', () => {
  it('extracts the record key for undoing an interaction', () => {
    expect(
      recordKeyFromUri(
        'at://did:example/app.bsky.feed.like/3abc',
        'app.bsky.feed.like',
      ),
    ).toBe('3abc')
  })

  it('normalizes a real thread without inventing replies', () => {
    const post = {
      uri: 'at://did:example/app.bsky.feed.post/1',
      cid: 'cid',
      indexedAt: '2026-09-01T00:00:00.000Z',
      author: { did: 'did:example', handle: 'mo.local' },
      record: { text: '真实帖子', createdAt: '2026-09-01T00:00:00.000Z' },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
    }
    expect(normalizePostThread({ thread: { post } })).toEqual({
      post,
      replies: [],
    })
  })
})
