import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PdsImage, RiceSession } from '~/lib/models'
import { MAX_POST_IMAGE_BYTES, newPostRecordKey, pdsBlobUrl, recordKeyFromUri, uploadPdsImage } from '~/lib/pds'

import {
  clearCachedFeed,
  createdPostView,
  createTextPostRecord,
  deleteOwnPostRecord,
  hideDeletedPost,
  isPostHidden,
  loadPostPage,
  loadPostThread,
  loadPosts,
  normalizePostFeed,
  normalizePostImages,
  normalizePostThread,
  prependCachedPost,
  readCachedFeed,
  updateInteractionRecord,
  writeCachedFeed,
} from './api'
import {
  hasPostTag,
  postCategory,
  postDisplayText,
  postFieldValues,
  postTextParts,
  postTags,
  withPostCategory,
} from './tags'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

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

const image: PdsImage = { image: { $type: 'blob', ref: { $link: 'bafkreib5testimage' }, mimeType: 'image/png', size: 20 }, alt: '公共客厅' }

describe('post images', () => {
  it('uploads image bytes to the fixed PDS endpoint using the PDS token', async () => {
    const bytes = Buffer.from([137, 80, 78, 71])
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ blob: image.image })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(uploadPdsImage('pds-token', bytes.toString('base64'), 'image/png')).resolves.toEqual(image.image)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/pds/xrpc/com.atproto.repo.uploadBlob')
    expect(init.headers).toEqual({ Authorization: 'Bearer pds-token', 'Content-Type': 'image/png' })
    expect(init.body).toEqual(bytes)
  })

  it('rejects unsupported and oversized uploads before calling PDS', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(uploadPdsImage('pds-token', 'eA==', 'image/svg+xml')).rejects.toThrow('JPG')
    await expect(uploadPdsImage('pds-token', Buffer.alloc(MAX_POST_IMAGE_BYTES + 1).toString('base64'), 'image/png')).rejects.toThrow('1 MB')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces failed image uploads instead of treating them as empty attachments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: '图片上传失败' }), { status: 500 })))
    await expect(uploadPdsImage('pds-token', 'eA==', 'image/png')).rejects.toThrow('图片上传失败')
  })

  it('stores ordered standard image embeds and supports an image-only post', async () => {
    const second = { ...image, image: { ...image.image, ref: { $link: 'bafkreisecondimage' } }, alt: '门口' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ uri: post.uri, cid: 'created' })))
    vi.stubGlobal('fetch', fetchMock)
    const created = await createTextPostRecord({ did: 'did:example', accessJwt: 'pds-token', text: '', category: 'post', rkey: 'recordkey', createdAt: post.indexedAt, images: [image, second] })
    const record = JSON.parse(fetchMock.mock.calls[0][1].body).record
    expect(record.embed).toEqual({ $type: 'app.bsky.embed.images', images: [image, second] })
    expect(created.images).toEqual([image, second])
    expect(record.text).toBe('')
  })

  it('blocks more than four images and invalid blob sizes before creating a post', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const input = { did: 'did:example', accessJwt: 'pds-token', text: '', category: 'post' as const, rkey: 'recordkey', createdAt: post.indexedAt }
    await expect(createTextPostRecord({ ...input, images: Array(5).fill(image) })).rejects.toThrow('4 张图片')
    await expect(createTextPostRecord({ ...input, images: [{ ...image, image: { ...image.image, size: MAX_POST_IMAGE_BYTES + 1 } }] })).rejects.toThrow('图片信息无效')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not accept an altered image set as an already successful retry', async () => {
    const oldImage = { ...image, image: { ...image.image, ref: { $link: 'bafkreioldimage' } } }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(new Response(JSON.stringify({ uri: post.uri, cid: 'stored', value: { text: post.record.text, createdAt: post.indexedAt, xjdaoCategory: 'post', embed: { $type: 'app.bsky.embed.images', images: [oldImage] } } }))))
    await expect(createTextPostRecord({ did: 'did:example', accessJwt: 'pds-token', text: post.record.text, category: 'post', rkey: 'recordkey', createdAt: post.indexedAt, images: [image] })).rejects.toThrow('上次提交的帖子已发布')
  })

  it('normalizes raw repo embeds for feeds and detail without an arbitrary URL proxy', () => {
    const raw = { ...post, record: { ...post.record, embed: { $type: 'app.bsky.embed.images', images: [image] } } }
    const expected = [{ src: pdsBlobUrl(post.author.did, image.image.ref.$link), alt: image.alt }]
    expect(normalizePostFeed({ posts: [raw] }).posts[0].images).toEqual(expected)
    expect(normalizePostThread({ thread: { post: raw } }).post.images).toEqual(expected)
    expect(normalizePostImages({ ...post, embed: { $type: 'app.bsky.embed.images#view', images: [{ thumb: 'javascript:alert(1)', fullsize: 'data:text/html,test', alt: '' }] } }).images).toBeUndefined()
  })

  it('preserves external image URLs and maps only configured AppView origins to the same-origin gateway', () => {
    vi.stubEnv('XIANGJIAN_APPVIEW_IMAGE_ORIGINS', 'https://internal-appview.example, https://previous-appview.example')
    const viewed = { ...post, record: { ...post.record, embed: { $type: 'app.bsky.embed.images', images: [image] } }, embed: { $type: 'app.bsky.embed.images#view', images: [{ thumb: 'https://cdn.bsky.app/thumb.jpg', fullsize: 'https://cdn.bsky.app/full.jpg', alt: image.alt }] } }
    expect(normalizePostImages(viewed).images).toEqual([{ src: 'https://cdn.bsky.app/thumb.jpg', fullsize: 'https://cdn.bsky.app/full.jpg', alt: image.alt }])
    viewed.embed.images[0].thumb = 'https://internal-appview.example/img/thumb.jpg?format=jpeg'
    viewed.embed.images[0].fullsize = 'https://previous-appview.example/img/full.jpg'
    expect(normalizePostImages(viewed).images).toEqual([{ src: '/bsky/img/thumb.jpg?format=jpeg', fullsize: '/bsky/img/full.jpg', alt: image.alt }])
    // A new deployment's public URLs need no legacy mapping.
    viewed.embed.images[0].thumb = 'https://community.example/bsky/img/thumb.jpg'
    viewed.embed.images[0].fullsize = 'https://community.example/bsky/img/full.jpg'
    expect(normalizePostImages(viewed).images).toEqual([{ src: viewed.embed.images[0].thumb, fullsize: viewed.embed.images[0].fullsize, alt: image.alt }])
  })

  it('does not rewrite lookalike hosts, arbitrary paths, or any origin without deployment configuration', () => {
    const viewed = { ...post, embed: { $type: 'app.bsky.embed.images#view', images: [{ thumb: 'https://internal-appview.example/img/thumb.jpg', fullsize: 'https://internal-appview.example/img/full.jpg', alt: '' }] } }
    vi.stubEnv('XIANGJIAN_APPVIEW_IMAGE_ORIGINS', '')
    expect(normalizePostImages(viewed).images?.[0].src).toBe(viewed.embed.images[0].thumb)
    vi.stubEnv('XIANGJIAN_APPVIEW_IMAGE_ORIGINS', 'https://internal-appview.example')
    viewed.embed.images[0].thumb = 'https://internal-appview.example.attacker.test/img/thumb.jpg'
    viewed.embed.images[0].fullsize = 'https://internal-appview.example/private/file.jpg'
    expect(normalizePostImages(viewed).images).toEqual([{ src: viewed.embed.images[0].thumb, fullsize: viewed.embed.images[0].fullsize, alt: '' }])
  })
})

describe('feed data', () => {
  it('loads a public thread for guests without bearer headers or private viewer record reads', async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => String(input).includes('getPostThread')
      ? new Response(JSON.stringify({ thread: { post, replies: [] } }))
      : new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadPostThread({ uri: post.uri })).resolves.toEqual({ post, replies: [] })
    expect(String(fetchMock.mock.calls[0][0])).toContain('/bsky/xrpc/app.bsky.feed.getPostThread?')
    expect(fetchMock.mock.calls[0][1]).toBeUndefined()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('listRecords'))).toBe(false)
  })

  it.each([undefined, '真实帖子'])('uses local author names in list/search and preserves external authors (query=%s)', async (query) => {
    const external = { ...post, uri: `${post.uri}-external`, author: { did: 'did:external', handle: 'outside.test', displayName: '外部作者' } }
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/post/api/posts/')) return new Response(JSON.stringify({ posts: [post, { ...post, uri: `${post.uri}-second` }, external] }))
      if (url.includes('/api/users/did%3Aexample/profile')) return new Response(JSON.stringify({ data: { did: post.author.did, nickname: '测试参与者 B' } }))
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const page = await loadPostPage({ query })
    expect(page.posts.filter((item) => item.author.did === post.author.did).map((item) => item.author.displayName)).toEqual(['测试参与者 B', '测试参与者 B'])
    expect(page.posts.find((item) => item.author.did === 'did:external')?.author).toEqual(external.author)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/users/'))).toHaveLength(2)
    expect(page.posts[0].record).toEqual(post.record)
  })

  it('uses the same local name for thread author and replies with one profile read per DID', async () => {
    const localReply = { ...post, uri: `${post.uri}-reply` }
    const externalReply = { ...post, uri: `${post.uri}-external`, author: { did: 'did:external', handle: 'outside.test', displayName: '外部作者' } }
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('getPostThread')) return new Response(JSON.stringify({ thread: { post, replies: [{ post: localReply }, { post: externalReply }] } }))
      if (url.includes('listRecords')) return new Response(JSON.stringify({ records: [] }))
      if (url.includes('/api/users/did%3Aexample/profile')) return new Response(JSON.stringify({ data: { did: post.author.did, nickname: '测试参与者 B' } }))
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const thread = await loadPostThread({ uri: post.uri, did: 'did:viewer', accessJwt: 'pds-token' })
    expect(thread.post.author.displayName).toBe('测试参与者 B')
    expect(thread.replies[0].post.author.displayName).toBe('测试参与者 B')
    expect(thread.replies[1].post.author).toEqual(externalReply.author)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/users/'))).toHaveLength(2)
  })

  it('reuses the post key when a successful publish response was lost', async () => {
    const rkey = newPostRecordKey()
    expect(rkey).toMatch(/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/)
    expect(newPostRecordKey() > rkey).toBe(true)
    const input = { did: 'did:alice', accessJwt: 'pds-token', text: '一起种花 #社区', category: 'post' as const, rkey, createdAt: '2026-09-15T01:00:00.000Z' }
    const uri = `at://${input.did}/app.bsky.feed.post/${rkey}`
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(new Response(JSON.stringify({ uri, cid: 'stored-cid', value: { text: input.text, createdAt: input.createdAt, xjdaoCategory: 'post' } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createTextPostRecord(input)).resolves.toMatchObject({ uri, cid: 'stored-cid' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).rkey).toBe(rkey)
    expect(String(fetchMock.mock.calls[1][0])).toContain(`rkey=${rkey}`)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer pds-token')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not replace an already published post with a changed retry payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('already exists')).mockResolvedValueOnce(new Response(JSON.stringify({ value: { text: '已发布内容', createdAt: '2026-09-15T01:00:00.000Z', xjdaoCategory: 'post' } }))))
    await expect(createTextPostRecord({ did: 'did:alice', accessJwt: 'pds-token', text: '编辑后的内容', category: 'post', rkey: newPostRecordKey(), createdAt: '2026-09-15T01:00:00.000Z' })).rejects.toThrow('上次提交的帖子已发布')
  })

  it('keeps category independent from exact searchable tags', () => {
    const text = '赶集信息\n#乡村 #商品 #活动'
    const productRecord = { ...post.record, text, xjdaoCategory: 'product' as const }

    expect(postTags(text)).toEqual(['#乡村', '#商品', '#活动'])
    expect(postCategory(productRecord)).toBe('product')
    expect(postCategory({ ...post.record, text })).toBe('post')
    expect(hasPostTag('#活动周', '活动')).toBe(false)
    expect(postTextParts('开放日 #活动').filter((part) => part.isTag)).toEqual([
      { value: '#活动', isTag: true },
    ])
    expect(withPostCategory('开放日 #商品', 'activity')).toBe('开放日 #商品')
    expect(withPostCategory('开放日', 'activity')).toBe('开放日')
  })

  it('stores special fields in the post and reads them back for rendering', () => {
    const text = withPostCategory('古村开放日 #乡村', 'activity', {
      deadline: '2026-09-10T18:00',
      location: '漈下村村委',
      conditions: '自带水杯',
    })

    expect(text).toBe(
      '古村开放日 #乡村\n截止时间：2026-09-10T18:00\n活动地点：漈下村村委\n参与条件：自带水杯',
    )
    expect(postFieldValues(text, 'activity')).toEqual({
      deadline: '2026-09-10T18:00',
      location: '漈下村村委',
      conditions: '自带水杯',
    })
    expect(postDisplayText(text, 'activity')).toBe('古村开放日 #乡村')

    const product = withPostCategory('秋收新米', 'product', {
      price: '88',
      availability: '可提供',
      fulfillment: '村口自提',
    })
    expect(postFieldValues(product, 'product')).toEqual({
      price: '88',
      availability: '可提供',
      fulfillment: '村口自提',
    })
    expect(postDisplayText(product, 'product')).toBe('秋收新米')
  })

  it('filters direct posts and repost events by category rather than tag', async () => {
    const activityPost = {
      ...post,
      uri: `${post.uri}-activity`,
      record: { ...post.record, text: '开放日\n#商品 #乡村', xjdaoCategory: 'activity' as const },
    }
    const taggedPlainPost = {
      ...post,
      record: { ...post.record, text: '普通讨论\n#活动' },
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
        new Response(JSON.stringify({ posts: [activityPost, taggedPlainPost] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            feed: [
              { post: taggedPlainPost, reason: { ...reason, uri: `${reason.uri}-plain` } },
              { post: activityPost, reason },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const feed = await loadPosts({ category: 'activity', accessJwt: 'access-token' })

    expect(feed.posts).toHaveLength(2)
    expect(feed.posts.every((item) => postCategory(item.record) === 'activity')).toBe(true)
  })

  it('reuses one account feed until that account writes', () => {
    vi.stubGlobal('window', {})
    const feed = { posts: [post] }

    writeCachedFeed(feed, 'did:alice')
    expect(readCachedFeed('did:alice')).toBe(feed)
    expect(readCachedFeed('did:bob')).toBeNull()

    clearCachedFeed('did:bob')
    expect(readCachedFeed('did:alice')).toBe(feed)
    clearCachedFeed('did:alice')
    expect(readCachedFeed('did:alice')).toBeNull()
  })

  it('shows a newly created post from cache without waiting for indexing', () => {
    vi.stubGlobal('window', {})
    const created = { ...post, uri: `${post.uri}-new` }

    writeCachedFeed({ posts: [post] }, 'did:alice')
    prependCachedPost(created, 'did:alice')

    expect(readCachedFeed('did:alice')?.posts).toEqual([created, post])
  })

  it('keeps a deleted post out of the current client feed while indexing catches up', () => {
    vi.stubGlobal('window', {})
    writeCachedFeed({ posts: [post] }, 'did:example')

    hideDeletedPost(post.uri, 'did:example')

    expect(isPostHidden(post.uri)).toBe(true)
    expect(readCachedFeed('did:example')?.posts).toEqual([])
  })

  it('builds the same optimistic view for posts and replies', () => {
    const session = {
      user: { nickname: 'Mo Alice' },
      pds: { did: 'did:alice', handle: 'alice.local' },
    } as RiceSession
    const subject = { uri: post.uri, cid: post.cid }
    const reply = { root: subject, parent: subject }

    expect(createdPostView(
      { ...post, text: post.record.text, createdAt: post.indexedAt },
      session,
      reply,
    ))
      .toMatchObject({ author: { did: 'did:alice' }, record: { reply } })
  })

  it('accepts both feed wrappers and direct search results', () => {
    expect(normalizePostFeed({ posts: [{ post }], total: 1 })).toEqual({
      posts: [post],
    })
    expect(normalizePostFeed({ posts: [post] })).toEqual({
      posts: [post],
    })
  })

  it('preserves the post search cursor and requested page size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ posts: [post], cursor: 'next-post-page' }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const page = await loadPostPage({
      query: '古村',
      cursor: 'current-post-page',
      limit: 10,
    })

    expect(page).toEqual({ posts: [post], cursor: 'next-post-page' })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      q: '古村',
      limit: 10,
      sort: 'latest',
      cursor: 'current-post-page',
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
    ).toEqual({ posts: [{ ...post, reason }] })
  })

  it('normalizes only the reply depth rendered by the product', () => {
    const reply = { ...post, uri: `${post.uri}-reply` }
    expect(normalizePostThread({
      thread: {
        post,
        replies: [{ post: reply, replies: [{ post }] }, { blocked: true }],
      },
    })).toEqual({
      post,
      replies: [{ post: reply }],
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

  it('deletes only a post from the signed-in repository', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteOwnPostRecord({
      did: post.author.did,
      accessJwt: 'access-token',
      uri: post.uri,
    })).resolves.toEqual({ uri: post.uri })

    const deleteBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as Record<string, string>
    expect(deleteBody).toEqual({
      repo: post.author.did,
      collection: 'app.bsky.feed.post',
      rkey: '1',
    })

    await expect(deleteOwnPostRecord({
      did: 'did:someone-else',
      accessJwt: 'access-token',
      uri: post.uri,
    })).rejects.toThrow('只能删除自己的帖子')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('viewer interaction isolation', () => {
  const alice = 'did:alice'
  const bob = 'did:bob'
  const liked = {
    ...post,
    likeCount: 1,
    repostCount: 1,
    viewer: {
      like: `at://${alice}/app.bsky.feed.like/same-key`,
      repost: `at://${alice}/app.bsky.feed.repost/same-key`,
    },
  }
  const response = (value: unknown) => new Response(JSON.stringify(value))

  it.each([
    ['plaza', {}],
    ['search', { query: '真实帖子' }],
    ['profile posts', { repo: post.author.did }],
  ] as const)('rebuilds %s interactions for A, B and guests from the same cached post', async (_name, filters) => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/post/api/posts/')) return response({ posts: [liked] })
      if (url.pathname.endsWith('listRecords')) {
        const collection = url.searchParams.get('collection')!
        return response({ records: url.searchParams.get('repo') === alice
          ? [{ uri: `at://${alice}/${collection}/same-key`, value: { subject: { uri: post.uri } } }]
          : [] })
      }
      return response({ feed: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const a = await loadPostPage({ ...filters, did: alice, accessJwt: 'alice-token' })
    const b = await loadPostPage({ ...filters, did: bob, accessJwt: 'bob-token' })
    const guest = await loadPostPage(filters)
    expect(a.posts[0].viewer).toEqual(liked.viewer)
    expect(b.posts[0].viewer).toBeUndefined()
    expect(guest.posts[0].viewer).toBeUndefined()
    expect([a, b, guest].map((feed) => [feed.posts[0].likeCount, feed.posts[0].repostCount])).toEqual([[1, 1], [1, 1], [1, 1]])
    expect(liked.viewer.like).toContain(alice)
    for (const [input, init] of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      const url = new URL(input)
      if (url.pathname.endsWith('listRecords')) {
        expect(init.headers).toEqual({ Authorization: `Bearer ${url.searchParams.get('repo') === alice ? 'alice' : 'bob'}-token` })
      }
    }
  })

  it('never preserves another account viewer when private hydration fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/post/api/posts/')) return response({ posts: [liked] })
      if (url.includes('listRecords')) return new Response(JSON.stringify({ message: 'PDS unavailable' }), { status: 503 })
      return response({ feed: [] })
    }))
    const feed = await loadPosts({ did: bob, accessJwt: 'bob-token' })
    expect(feed.posts[0].viewer).toBeUndefined()
    expect(feed.posts[0].likeCount).toBe(1)
  })

  it('hydrates thread replies as well as the root and strips all guest viewer records', async () => {
    const reply = { ...liked, uri: `${post.uri}-reply` }
    const bobLike = `at://${bob}/app.bsky.feed.like/reply-like`
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('getPostThread')) return response({ thread: { post: liked, replies: [{ post: reply }] } })
      if (url.pathname.endsWith('listRecords')) return response({ records: url.searchParams.get('collection') === 'app.bsky.feed.like'
        ? [{ uri: bobLike, value: { subject: { uri: reply.uri } } }]
        : [] })
      return response({})
    }))
    const thread = await loadPostThread({ uri: post.uri, did: bob, accessJwt: 'bob-token' })
    expect(thread.post.viewer).toBeUndefined()
    expect(thread.replies[0].post.viewer).toEqual({ like: bobLike })
    const guest = await loadPostThread({ uri: post.uri })
    expect(guest.post.viewer).toBeUndefined()
    expect(guest.replies[0].post.viewer).toBeUndefined()
  })

  it('reads subsequent interaction pages and ignores records from a different repository or collection', async () => {
    const bobLike = `at://${bob}/app.bsky.feed.like/older`
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/post/api/posts/')) return response({ posts: [liked] })
      if (!url.pathname.endsWith('listRecords')) return response({ feed: [] })
      if (url.searchParams.get('collection') === 'app.bsky.feed.repost') return response({ records: [] })
      if (!url.searchParams.has('cursor')) return response({ records: [
        { uri: liked.viewer.like, value: { subject: { uri: post.uri } } },
        { uri: `at://${bob}/app.bsky.feed.repost/wrong-collection`, value: { subject: { uri: post.uri } } },
      ], cursor: 'older-page' })
      return response({ records: [{ uri: bobLike, value: { subject: { uri: post.uri } } }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const feed = await loadPosts({ did: bob, accessJwt: 'bob-token' })
    expect(feed.posts[0].viewer).toEqual({ like: bobLike })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('cursor=older-page'))).toBe(true)
  })

  it.each(['app.bsky.feed.like', 'app.bsky.feed.repost'] as const)('rejects cancelling a foreign %s URI before contacting PDS', async (collection) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(updateInteractionRecord({ did: bob, accessJwt: 'bob-token', postUri: post.uri, postCid: post.cid, recordUri: `at://${alice}/${collection}/same-key` }, collection)).rejects.toThrow('只能取消当前账号')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
