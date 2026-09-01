import { describe, expect, it } from 'vitest'

import {
  normalizePostFeed,
  normalizePostThread,
  recordKeyFromUri,
} from './api'

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

describe('feed data', () => {
  it('accepts both feed wrappers and direct search results', () => {
    expect(normalizePostFeed({ posts: [{ post }], total: 1 })).toEqual({
      posts: [post],
      total: 1,
    })
    expect(normalizePostFeed({ posts: [post] })).toEqual({
      posts: [post],
      total: 1,
    })
  })

  it('normalizes threads without inventing replies', () => {
    expect(normalizePostThread({ thread: { post } })).toEqual({
      post,
      replies: [],
    })
  })

  it('extracts the record key used to undo an interaction', () => {
    expect(
      recordKeyFromUri(
        'at://did:example/app.bsky.feed.like/3abc',
        'app.bsky.feed.like',
      ),
    ).toBe('3abc')
  })
})
