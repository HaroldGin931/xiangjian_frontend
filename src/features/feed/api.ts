import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson, type JsonObject } from '~/lib/http'
import type { PostFeed, PostThread, PostView } from '~/lib/models'

export function recordKeyFromUri(uri: string, collection: string) {
  const parts = uri.split('/')
  const collectionIndex = parts.lastIndexOf(collection)
  const recordKey = parts[collectionIndex + 1]
  if (collectionIndex < 0 || !recordKey) throw new Error('互动记录地址无效')
  return recordKey
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
    posts?: Array<PostView | { post?: PostView }>
    total?: number
  }
  const posts = (body.posts ?? [])
    .map((item): PostView | undefined =>
      'post' in item ? item.post : (item as PostView),
    )
    .filter((post): post is PostView =>
      Boolean(post?.uri && post.record?.text !== undefined),
    )

  return {
    posts,
    total: typeof body.total === 'number' ? body.total : posts.length,
  }
}

export function normalizePostThread(payload: unknown): PostThread {
  const body = payload as { thread?: { post?: PostView; replies?: unknown[] } }

  const normalizeNode = (value: unknown): PostThread | null => {
    const node = value as { post?: PostView; replies?: unknown[] }
    if (!node?.post?.uri || node.post.record?.text === undefined) return null
    return {
      post: node.post,
      replies: (node.replies ?? [])
        .map(normalizeNode)
        .filter((reply): reply is PostThread => reply !== null),
    }
  }

  const thread = normalizeNode(body.thread)
  if (!thread) throw new Error('帖子暂时无法显示')
  return thread
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
  const endpoint = query ? '/post/api/posts/search' : '/post/api/posts'
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
  return {
    ...feed,
    posts: await hydrateViewerRecords(feed.posts, data.did, data.accessJwt),
  }
}

export const getPosts = createServerFn({ method: 'POST' })
  .validator((data: GetPostsInput) => data)
  .handler(({ data }) => loadPosts(data))

export const getPostThread = createServerFn({ method: 'POST' })
  .validator((data: { uri: string; accessJwt: string; did: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      uri: data.uri,
      depth: '20',
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

    const body = await writePdsRecord(data.accessJwt, {
      repo: data.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        langs: ['zh'],
        createdAt: new Date().toISOString(),
      },
    })
    return { uri: body.uri, cid: body.cid, text }
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
    return { recordUri: null }
  }

  const record = await writePdsRecord(data.accessJwt, {
    repo: data.did,
    collection,
    record: {
      $type: collection,
      subject: { uri: data.postUri, cid: data.postCid },
      createdAt: new Date().toISOString(),
    },
  })
  return { recordUri: record.uri }
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

    const record = await writePdsRecord(data.accessJwt, {
      repo: data.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        langs: ['zh'],
        reply: { root: data.root, parent: data.parent },
        createdAt: new Date().toISOString(),
      },
    })
    return { ...record, text }
  })
