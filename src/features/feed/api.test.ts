import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearCachedFeed,
  loadPosts,
  normalizePostFeed,
  normalizePostThread,
  readCachedFeed,
  recordKeyFromUri,
  updateInteractionRecord,
  writeCachedFeed,
} from './api'
import { hasPostTag, postKind, postTags, withPostKind } from './tags'

afterEach(() => vi.unstubAllGlobals())

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
  it('uses exact tags to select one special rendering while preserving every tag', () => {
    const text = '赶集信息\n#乡村 #商品 #活动'

    expect(postTags(text)).toEqual(['#乡村', '#商品', '#活动'])
    expect(postKind(text)).toBe('product')
    expect(hasPostTag('#活动周', '活动')).toBe(false)
    expect(withPostKind('开放日 #活动', 'activity')).toBe('开放日 #活动')
    expect(withPostKind('开放日', 'activity')).toBe('开放日\n#活动')
  })

  it('filters direct posts and repost events by the original post tag', async () => {
    const activityPost = {
      ...post,
      uri: `${post.uri}-activity`,
      record: { ...post.record, text: '开放日\n#活动 #乡村' },
    }
    const reason = {
      $type: 'app.bsky.feed.defs#reasonRepost' as const,
      by: { did: 'did:viewer', handle: 'viewer.local' },
      uri: 'at://did:viewer/app.bsky.feed.repost/1',
      indexedAt: '2026-09-01T01:00:00.000Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ posts: [activityPost, post] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            feed: [
              { post, reason: { ...reason, uri: `${reason.uri}-plain` } },
              { post: activityPost, reason },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const feed = await loadPosts({ tag: '活动', accessJwt: 'access-token' })

    expect(feed.posts).toHaveLength(2)
    expect(feed.posts.every((item) => hasPostTag(item.record.text, '活动'))).toBe(true)
  })

  it('reuses one account feed until that account writes', () => {
    vi.stubGlobal('window', {})
    const feed = { posts: [post], total: 1 }

    writeCachedFeed(feed, 'did:alice')
    expect(readCachedFeed('did:alice')).toBe(feed)
    expect(readCachedFeed('did:bob')).toBeNull()

    clearCachedFeed('did:bob')
    expect(readCachedFeed('did:alice')).toBe(feed)
    clearCachedFeed('did:alice')
    expect(readCachedFeed('did:alice')).toBeNull()
  })

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

  it('keeps replies out of top-level feeds and preserves repost reasons', () => {
    const reply = {
      ...post,
      uri: 'at://did:example/app.bsky.feed.post/reply',
      record: {
        ...post.record,
        reply: {
          root: { uri: post.uri, cid: post.cid },
          parent: { uri: post.uri, cid: post.cid },
        },
      },
    }
    const reason = {
      $type: 'app.bsky.feed.defs#reasonRepost' as const,
      by: { did: 'did:viewer', handle: 'viewer.local' },
      uri: 'at://did:viewer/app.bsky.feed.repost/1',
      indexedAt: '2026-09-01T01:00:00.000Z',
    }

    expect(
      normalizePostFeed({
        posts: [
          { post: reply, reply: { parent: post } },
          { post, reason },
        ],
      }),
    ).toEqual({ posts: [{ ...post, reason }], total: 1 })
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

  it('keeps public Post Cache reads independent from an expired PDS token', async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      if (String(input).includes('/post/api/posts/list')) {
        return new Response(JSON.stringify({ posts: [post] }), { status: 200 })
      }
      return new Response(
        JSON.stringify({ error: 'ExpiredToken', message: 'Token has expired' }),
        { status: 400 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const feed = await loadPosts({
      did: 'did:example',
      accessJwt: 'expired-access',
    })
    const [, postCacheInit] = fetchMock.mock.calls[0]

    expect(feed.posts).toEqual([post])
    expect(postCacheInit?.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('returns the record URI needed to toggle likes and reposts', async () => {
    const recordUri = 'at://did:example/app.bsky.feed.like/3abc'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uri: recordUri, cid: 'interaction-cid' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      did: 'did:example',
      accessJwt: 'access-token',
      postUri: post.uri,
      postCid: post.cid,
    }

    await expect(
      updateInteractionRecord(input, 'app.bsky.feed.like'),
    ).resolves.toMatchObject({ recordUri })
    await expect(
      updateInteractionRecord(
        { ...input, recordUri },
        'app.bsky.feed.like',
      ),
    ).resolves.toEqual({ recordUri: null, indexedAt: null })

    const deleteBody = JSON.parse(
      String(fetchMock.mock.calls[1][1]?.body),
    ) as Record<string, string>
    expect(deleteBody).toMatchObject({
      repo: input.did,
      collection: 'app.bsky.feed.like',
      rkey: '3abc',
    })
  })
})
