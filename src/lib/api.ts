import { createServerFn } from '@tanstack/react-start'

import type {
  NotificationFeed,
  NotificationView,
  PostFeed,
  PostThread,
  PostView,
  RiceSession,
  RiceUser,
} from './models'

const BACKEND_BASE = process.env.XIANGJIAN_BACKEND_URL ?? 'http://localhost:19006'

type JsonObject = Record<string, unknown>

async function readJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as JsonObject
  if (!response.ok) {
    const errors = body.errors as JsonObject | undefined
    const detail = typeof errors?.detail === 'string' ? errors.detail : null
    throw new Error(detail ?? '服务暂时不可用，请稍后重试。')
  }
  return body
}

export function recordKeyFromUri(uri: string, collection: string) {
  const parts = uri.split('/')
  const collectionIndex = parts.lastIndexOf(collection)
  const recordKey = parts[collectionIndex + 1]
  if (collectionIndex < 0 || !recordKey) throw new Error('互动记录地址无效')
  return recordKey
}

async function writePdsRecord(
  accessJwt: string,
  body: {
    repo: string
    collection: string
    record: JsonObject
  },
) {
  const response = await fetch(
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
  return (await readJson(response)) as { uri: string; cid: string }
}

async function deletePdsRecord(
  accessJwt: string,
  body: { repo: string; collection: string; rkey: string },
) {
  const response = await fetch(
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
  await readJson(response)
}

async function hydrateViewerRecords(
  posts: PostView[],
  did?: string,
  accessJwt?: string,
) {
  if (!did || !accessJwt || posts.length === 0) return posts

  const list = async (collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost') => {
    const params = new URLSearchParams({ repo: did, collection, limit: '100' })
    const response = await fetch(
      `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.listRecords?${params}`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    const body = (await readJson(response)) as {
      records?: Array<{ uri: string; value?: { subject?: { uri?: string } } }>
    }
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
    .filter((post): post is PostView => {
      return Boolean(post?.uri && post.record?.text !== undefined)
    })

  return {
    posts,
    total: typeof body.total === 'number' ? body.total : posts.length,
  }
}

export function normalizeNotificationFeed(payload: unknown): NotificationFeed {
  const body = (payload ?? {}) as {
    notifications?: Array<{
      uri?: unknown
      cid?: unknown
      author?: { did?: unknown; handle?: unknown; displayName?: unknown }
      reason?: unknown
      reasonSubject?: unknown
      record?: { text?: unknown }
      isRead?: unknown
      indexedAt?: unknown
    }>
    priority?: boolean
    seenAt?: string
  }
  const notifications = (body.notifications ?? [])
    .filter(
      (notification) =>
        typeof notification.uri === 'string' &&
        typeof notification.author?.handle === 'string',
    )
    .map(
      (notification): NotificationView => ({
        uri: notification.uri as string,
        cid: typeof notification.cid === 'string' ? notification.cid : '',
        author: {
          did:
            typeof notification.author?.did === 'string'
              ? notification.author.did
              : '',
          handle: notification.author?.handle as string,
          displayName:
            typeof notification.author?.displayName === 'string'
              ? notification.author.displayName
              : undefined,
        },
        reason:
          typeof notification.reason === 'string'
            ? notification.reason
            : 'unknown',
        reasonSubject:
          typeof notification.reasonSubject === 'string'
            ? notification.reasonSubject
            : undefined,
        text:
          typeof notification.record?.text === 'string'
            ? notification.record.text
            : '',
        isRead: notification.isRead === true,
        indexedAt:
          typeof notification.indexedAt === 'string'
            ? notification.indexedAt
            : new Date(0).toISOString(),
      }),
    )

  return {
    notifications,
    priority: body.priority === true,
    seenAt: body.seenAt,
  }
}

export function normalizePostThread(payload: unknown): PostThread {
  const body = payload as {
    thread?: { post?: PostView; replies?: unknown[] }
  }

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

export const getPosts = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      query?: string
      repo?: string
      tag?: string
      accessJwt?: string
      did?: string
    }) => data,
  )
  .handler(async ({ data }) => {
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
    const response = await fetch(`${BACKEND_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.accessJwt
          ? { Authorization: `Bearer ${data.accessJwt}` }
          : {}),
      },
      body: JSON.stringify(requestBody),
    })

    const feed = normalizePostFeed(await readJson(response))
    return {
      ...feed,
      posts: await hydrateViewerRecords(feed.posts, data.did, data.accessJwt),
    }
  })

export const getPostThread = createServerFn({ method: 'POST' })
  .validator((data: { uri: string; accessJwt: string; did: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      uri: data.uri,
      depth: '20',
      parentHeight: '0',
    })
    const response = await fetch(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.feed.getPostThread?${params}`,
      { headers: { Authorization: `Bearer ${data.accessJwt}` } },
    )
    const thread = normalizePostThread(await readJson(response))
    const [post] = await hydrateViewerRecords(
      [thread.post],
      data.did,
      data.accessJwt,
    )
    return { ...thread, post }
  })

export const loginRice = createServerFn({ method: 'POST' })
  .validator((data: { identifier: string; password: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${BACKEND_BASE}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: data.identifier.trim().toLowerCase(),
        password: data.password,
      }),
    })
    const body = (await readJson(response)) as { data: RiceSession }
    return body.data
  })

export const logoutRice = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    await fetch(`${BACKEND_BASE}/api/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return true
  })

export const getCurrentUser = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const response = await fetch(`${BACKEND_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await readJson(response)) as { data: RiceUser }
    return body.data
  })

export const getNotifications = createServerFn({ method: 'POST' })
  .validator((accessJwt: string) => accessJwt)
  .handler(async ({ data: accessJwt }) => {
    const response = await fetch(
      `${BACKEND_BASE}/pds/xrpc/app.bsky.notification.listNotifications?limit=30`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    const feed = normalizeNotificationFeed(await readJson(response))

    if (feed.notifications.some((notification) => !notification.isRead)) {
      await fetch(
        `${BACKEND_BASE}/pds/xrpc/app.bsky.notification.updateSeen`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seenAt: new Date().toISOString() }),
        },
      ).catch(() => undefined)
    }

    return feed
  })

export const createTextPost = createServerFn({ method: 'POST' })
  .validator(
    (data: { did: string; accessJwt: string; text: string }) => data,
  )
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

function toggleInteraction(collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost') {
  return createServerFn({ method: 'POST' })
    .validator((data: ToggleInteractionInput) => data)
    .handler(async ({ data }) => {
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
    })
}

export const toggleLike = toggleInteraction('app.bsky.feed.like')
export const toggleRepost = toggleInteraction('app.bsky.feed.repost')

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
