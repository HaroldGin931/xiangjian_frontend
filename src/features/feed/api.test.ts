import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  loadPosts,
  normalizePostFeed,
  normalizePostThread,
  recordKeyFromUri,
  updateInteractionRecord,
} from './api'

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
