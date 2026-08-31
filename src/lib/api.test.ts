import { describe, expect, it } from 'vitest'

import { normalizePostFeed } from './api'

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

