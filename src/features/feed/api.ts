import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson, type JsonObject } from '~/lib/http'
import type { PostFeed, PostThread, PostView, RiceSession } from '~/lib/models'

import { hasPostTag } from './tags'

let clientFeedCache: { owner: string | null; feed: PostFeed } | null = null

export function readCachedFeed(did?: string) {
  if (typeof window === 'undefined') return null
  return clientFeedCache?.owner === (did ?? null) ? clientFeedCache.feed : null
}

export function writeCachedFeed(feed: PostFeed, did?: string) {
  if (typeof window === 'undefined') return
  clientFeedCache = { owner: did ?? null, feed }
}

export function prependCachedPost(post: PostView, did?: string) {
  if (
    typeof window === 'undefined' ||
    clientFeedCache?.owner !== (did ?? null)
  ) return

  const posts = [post, ...clientFeedCache.feed.posts.filter((item) => item.uri !== post.uri)]
  clientFeedCache = {
    owner: did ?? null,
    feed: { posts },
  }
}

export function clearCachedFeed(did?: string) {
  if (
    typeof window !== 'undefined' &&
    clientFeedCache?.owner === (did ?? null)
  ) {
    clientFeedCache = null
  }
}

export function recordKeyFromUri(uri: string, collection: string) {
  const parts = uri.split('/')
  const collectionIndex = parts.lastIndexOf(collection)
  const recordKey = parts[collectionIndex + 1]
  if (collectionIndex < 0 || !recordKey) throw new Error('互动记录地址无效')
  return recordKey
}

export function createdPostView(
  created: { uri: string; cid: string; text: string; createdAt: string },
  session: RiceSession,
  reply?: PostView['record']['reply'],
): PostView {
  return {
    uri: created.uri,
    cid: created.cid,
    indexedAt: created.createdAt,
    author: {
      did: session.pds.did,
      handle: session.pds.handle,
      displayName: session.user.nickname ?? undefined,
    },
    record: {
      text: created.text,
      createdAt: created.createdAt,
      ...(reply ? { reply } : {}),
    },
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
  }
}

async function writePdsRecord(
  accessJwt: string,
  body: { repo: string; collection: string; record: JsonObject },
) {
  return requestJson<{ uri: string; cid: string }>(
    `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

async function deletePdsRecord(
  accessJwt: string,
  body: { repo: string; collection: string; rkey: string },
) {
  await requestJson(
    `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.deleteRecord`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

async function hydrateViewerRecords(
  posts: PostView[],
  did?: string,
  accessJwt?: string,
) {
  if (!did || !accessJwt || posts.length === 0) return posts

  const list = async (collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost') => {
    const params = new URLSearchParams({ repo: did, collection, limit: '100' })
    const body = await requestJson<{
      records?: Array<{ uri: string; value?: { subject?: { uri?: string } } }>
    }>(
      `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.listRecords?${params}`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    return new Map(
      (body.records ?? [])
        .filter((record) => typeof record.value?.subject?.uri === 'string')
        .map((record) => [record.value?.subject?.uri as string, record.uri]),
    )
  }

  try {
    const [likes, reposts] = await Promise.all([
      list('app.bsky.feed.like'),
      list('app.bsky.feed.repost'),
    ])
    return posts.map((post) => ({
      ...post,
      viewer: {
        ...post.viewer,
        ...(likes.get(post.uri) ? { like: likes.get(post.uri) } : {}),
        ...(reposts.get(post.uri) ? { repost: reposts.get(post.uri) } : {}),
      },
    }))
  } catch {
    return posts
  }
}

export function normalizePostFeed(payload: unknown): PostFeed {
  const body = (payload ?? {}) as {
    posts?: Array<
      PostView | {
        post?: PostView
        reply?: unknown
        reason?: PostView['reason']
      }
    >
  }
  const posts = (body.posts ?? [])
    .map((item): PostView | undefined => {
      if (!('post' in item)) return item as PostView
      if (!item.post || item.reply) return undefined
      return item.reason ? { ...item.post, reason: item.reason } : item.post
    })
    .filter((post): post is PostView =>
      Boolean(
        post?.uri &&
        post.record?.text !== undefined &&
        !post.record.reply,
      ),
    )

  return { posts }
}

async function loadTimelineReposts(accessJwt?: string) {
  if (!accessJwt) return []
  try {
    const payload = await requestJson<{ feed?: unknown[] }>(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.feed.getTimeline?limit=50`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    return normalizePostFeed({ posts: payload.feed }).posts.filter(
      (post) => post.reason?.$type === 'app.bsky.feed.defs#reasonRepost',
    )
  } catch {
    return []
  }
}

function mergeFeedPosts(posts: PostView[], reposts: PostView[]) {
  const seenReposts = new Set<string>()
  return [...posts, ...reposts]
    .filter((post) => {
      if (!post.reason) return true
      const key = post.reason.uri ?? `${post.reason.by.did}:${post.uri}`
      if (seenReposts.has(key)) return false
      seenReposts.add(key)
      return true
    })
    .sort((a, b) =>
      (b.reason?.indexedAt ?? b.indexedAt).localeCompare(
        a.reason?.indexedAt ?? a.indexedAt,
      ),
    )
}

export function normalizePostThread(payload: unknown): PostThread {
  const body = payload as { thread?: { post?: PostView; replies?: unknown[] } }
  const post = body.thread?.post
  if (!post?.uri || post.record?.text === undefined) {
    throw new Error('帖子暂时无法显示')
  }

  // ponytail: 当前产品只展示根帖下一层评论，嵌套回复留到 UI 真正支持时再取。
  const replies = (body.thread?.replies ?? [])
    .map((value) => (value as { post?: PostView }).post)
    .filter(
      (reply): reply is PostView =>
        Boolean(reply?.uri && reply.record?.text !== undefined),
    )
    .map((reply) => ({ post: reply }))
  return { post, replies }
}

export type GetPostsInput = {
  query?: string
  repo?: string
  tag?: string
  accessJwt?: string
  did?: string
}

export async function loadPosts(data: GetPostsInput) {
  const query = data.query?.trim()
  const endpoint = query ? '/post/api/posts/search' : '/post/api/posts/list'
  const requestBody = query
    ? { q: query, limit: 25, sort: 'latest' }
    : {
        page: 1,
        per_page: 20,
        ...(data.repo ? { repo: data.repo } : {}),
        ...(data.tag ? { tag: data.tag } : {}),
      }
  const payload = await requestJson<unknown>(`${BACKEND_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  const feed = normalizePostFeed(payload)
  const timelineReposts = !query && !data.repo
    ? await loadTimelineReposts(data.accessJwt)
    : []
  const posts = mergeFeedPosts(feed.posts, timelineReposts).filter(
    (post) => !data.tag || hasPostTag(post.record.text, data.tag),
  )
  return { posts: await hydrateViewerRecords(posts, data.did, data.accessJwt) }
}

export const getPosts = createServerFn({ method: 'POST' })
  .validator((data: GetPostsInput) => data)
  .handler(({ data }) => loadPosts(data))

export const getPostThread = createServerFn({ method: 'POST' })
  .validator((data: { uri: string; accessJwt: string; did: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      uri: data.uri,
      depth: '1',
      parentHeight: '0',
    })
    const payload = await requestJson<unknown>(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.feed.getPostThread?${params}`,
      { headers: { Authorization: `Bearer ${data.accessJwt}` } },
    )
    const thread = normalizePostThread(payload)
    const [post] = await hydrateViewerRecords(
      [thread.post],
      data.did,
      data.accessJwt,
    )
    return { ...thread, post }
  })

export const createTextPost = createServerFn({ method: 'POST' })
  .validator((data: { did: string; accessJwt: string; text: string }) => data)
  .handler(async ({ data }) => {
    const text = data.text.trim()
    if (!text) throw new Error('帖子内容不能为空')
    if (text.length > 300) throw new Error('首版文字帖最多 300 个字符')

    const createdAt = new Date().toISOString()
    const body = await writePdsRecord(data.accessJwt, {
      repo: data.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        langs: ['zh'],
        createdAt,
      },
    })
    return { uri: body.uri, cid: body.cid, text, createdAt }
  })

type ToggleInteractionInput = {
  did: string
  accessJwt: string
  postUri: string
  postCid: string
  recordUri?: string
}

export async function updateInteractionRecord(
  data: ToggleInteractionInput,
  collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost',
) {
  if (data.recordUri) {
    await deletePdsRecord(data.accessJwt, {
      repo: data.did,
      collection,
      rkey: recordKeyFromUri(data.recordUri, collection),
    })
    return { recordUri: null, indexedAt: null }
  }

  const indexedAt = new Date().toISOString()
  const record = await writePdsRecord(data.accessJwt, {
    repo: data.did,
    collection,
    record: {
      $type: collection,
      subject: { uri: data.postUri, cid: data.postCid },
      createdAt: indexedAt,
    },
  })
  return { recordUri: record.uri, indexedAt }
}

export const toggleLike = createServerFn({ method: 'POST' })
  .validator((data: ToggleInteractionInput) => data)
  .handler(({ data }) => updateInteractionRecord(data, 'app.bsky.feed.like'))

export const toggleRepost = createServerFn({ method: 'POST' })
  .validator((data: ToggleInteractionInput) => data)
  .handler(({ data }) => updateInteractionRecord(data, 'app.bsky.feed.repost'))

export const createReply = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      did: string
      accessJwt: string
      text: string
      root: { uri: string; cid: string }
      parent: { uri: string; cid: string }
    }) => data,
  )
  .handler(async ({ data }) => {
    const text = data.text.trim()
    if (!text) throw new Error('评论内容不能为空')
    if (text.length > 300) throw new Error('评论最多 300 个字符')

    const createdAt = new Date().toISOString()
    const record = await writePdsRecord(data.accessJwt, {
      repo: data.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        langs: ['zh'],
        reply: { root: data.root, parent: data.parent },
        createdAt,
      },
    })
    return { ...record, text, createdAt }
  })
