import { createServerFn } from '@tanstack/react-start'

import { BACKEND_BASE, requestJson } from '~/lib/http'
import type { PdsImage, PostCategory, PostFeed, PostImage, PostThread, PostView, RicePublicUser, RiceSession } from '~/lib/models'
import { createPdsRecord, deletePdsRecord, MAX_POST_IMAGE_BYTES, MAX_POST_IMAGES, pdsBlobUrl, POST_IMAGE_TYPES, recordKeyFromUri, uploadPdsImage } from '~/lib/pds'

import { hasPostTag, postCategory } from './tags'

let clientFeedCache: { owner: string | null; feed: PostFeed } | null = null
const clientDeletedPostUris = new Set<string>()

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

export function hideDeletedPost(uri: string, did?: string) {
  if (typeof window === 'undefined') return
  clientDeletedPostUris.add(uri)

  if (clientFeedCache?.owner === (did ?? null)) {
    clientFeedCache = {
      owner: did ?? null,
      feed: {
        posts: clientFeedCache.feed.posts.filter((post) => post.uri !== uri),
      },
    }
  }
}

export function isPostHidden(uri: string) {
  return typeof window !== 'undefined' && clientDeletedPostUris.has(uri)
}

export function clearCachedFeed(did?: string) {
  if (
    typeof window !== 'undefined' &&
    clientFeedCache?.owner === (did ?? null)
  ) {
    clientFeedCache = null
  }
}

export function createdPostView(
  created: {
    uri: string
    cid: string
    text: string
    createdAt: string
    category?: PostCategory
    images?: PdsImage[]
  },
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
      ...(created.category ? { xjdaoCategory: created.category } : {}),
      ...(reply ? { reply } : {}),
      ...(created.images?.length ? { embed: { $type: 'app.bsky.embed.images', images: created.images } } : {}),
    },
    ...(created.images?.length ? { images: created.images.map((item) => ({ src: pdsBlobUrl(session.pds.did, item.image.ref.$link), alt: item.alt, ...item.aspectRatio })) } : {}),
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
  }
}

type InteractionCollection = 'app.bsky.feed.like' | 'app.bsky.feed.repost'

export function ownedInteractionUri(uri: string | undefined, did: string, collection: InteractionCollection) {
  const prefix = `at://${did}/${collection}/`
  if (typeof uri !== 'string' || !uri.startsWith(prefix)) return undefined
  const key = uri.slice(prefix.length)
  return /^[a-zA-Z0-9._~:-]+$/.test(key) && key !== '.' && key !== '..' ? uri : undefined
}

async function hydrateViewerRecords(
  posts: PostView[],
  did?: string,
  accessJwt?: string,
) {
  // Post Cache is shared. Its viewer belongs to whoever populated it, not this reader.
  const publicPosts = posts.map(({ viewer: _viewer, ...post }) => post)
  if (!did || !accessJwt || posts.length === 0) return publicPosts

  const subjects = new Set(posts.map((post) => post.uri))
  const list = async (collection: InteractionCollection) => {
    // ponytail: Scan the reader's records; use authenticated AppView lookups if histories become large.
    const found = new Map<string, string>()
    let cursor: string | undefined
    do {
      const params = new URLSearchParams({ repo: did, collection, limit: '100' })
      if (cursor) params.set('cursor', cursor)
      const body = await requestJson<{
        records?: Array<{ uri: string; value?: { subject?: { uri?: string } } }>
        cursor?: string
      }>(
        `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.listRecords?${params}`,
        { headers: { Authorization: `Bearer ${accessJwt}` } },
      )
      for (const record of body.records ?? []) {
        const subject = record.value?.subject?.uri
        const uri = ownedInteractionUri(record.uri, did, collection)
        if (subject && subjects.has(subject) && uri) found.set(subject, uri)
      }
      if (found.size === subjects.size || body.cursor === cursor) break
      cursor = body.cursor
    } while (cursor)
    return found
  }

  try {
    const [likes, reposts] = await Promise.all([
      list('app.bsky.feed.like'),
      list('app.bsky.feed.repost'),
    ])
    return publicPosts.map((post) => {
      const like = likes.get(post.uri)
      const repost = reposts.get(post.uri)
      return like || repost ? { ...post, viewer: { ...(like ? { like } : {}), ...(repost ? { repost } : {}) } } : post
    })
  } catch {
    return publicPosts
  }
}

async function hydrateAuthorNames(posts: PostView[]) {
  const authors = posts.flatMap((post) => post.reason ? [post.author, post.reason.by] : [post.author])
  const names = new Map<string, string | undefined>()
  await Promise.all([...new Set(authors.map((author) => author.did))].map(async (did) => {
    const profile = await requestJson<{ data: RicePublicUser }>(`${BACKEND_BASE}/api/users/${encodeURIComponent(did)}/profile`).catch(() => null)
    if (profile?.data?.did === did) names.set(did, profile.data.nickname ?? undefined)
  }))
  const authorName = (author: PostView['author']) => names.has(author.did)
    ? { ...author, displayName: names.get(author.did) }
    : author
  return posts.map((post) => ({
    ...post,
    author: authorName(post.author),
    ...(post.reason ? { reason: { ...post.reason, by: authorName(post.reason.by) } } : {}),
  }))
}

export function normalizePostImages(post: PostView): PostView {
  const imageEmbed = (value: unknown) => {
    const embed = value as { $type?: string; images?: unknown[]; media?: unknown } | undefined
    if (embed?.$type === 'app.bsky.embed.recordWithMedia#view' || embed?.$type === 'app.bsky.embed.recordWithMedia') return embed.media as typeof embed
    return embed
  }
  const view = imageEmbed(post.embed)
  const record = imageEmbed(post.record.embed)
  const source = Array.isArray(view?.images) && view.images.length ? view : record
  if (!Array.isArray(source?.images) || !source.images.length) return post
  const images = source.images.slice(0, MAX_POST_IMAGES).flatMap((value, index): PostImage[] => {
    if (!value || typeof value !== 'object') return []
    const item = value as { thumb?: unknown; fullsize?: unknown; alt?: unknown; image?: { ref?: { $link?: unknown }; cid?: unknown }; aspectRatio?: { width?: number; height?: number } }
    const httpUrl = (url: unknown) => typeof url === 'string' && /^https?:\/\//i.test(url) ? url : undefined
    const original = record?.images?.[index] as typeof item | undefined
    const cid = item.image?.ref?.$link ?? item.image?.cid ?? original?.image?.ref?.$link ?? original?.image?.cid
    const blobUrl = typeof cid === 'string' && /^[a-z0-9]+$/i.test(cid) ? pdsBlobUrl(post.author.did, cid) : undefined
    const viewUrl = (value: unknown) => {
      const url = httpUrl(value)
      if (!url) return undefined
      try {
        // Legacy cached AppView URLs may name a deployment's internal origin.
        // Only explicitly configured origins use our AppView gateway: external
        // authors' images must not be redirected to this deployment's PDS.
        const parsed = new URL(url)
        const origins = (process.env.XIANGJIAN_APPVIEW_IMAGE_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
        return origins.includes(parsed.origin) && parsed.pathname.startsWith('/img/')
          ? `/bsky${parsed.pathname}${parsed.search}`
          : url
      } catch { return undefined }
    }
    const fullsize = viewUrl(item.fullsize)
    const src = viewUrl(item.thumb) ?? fullsize ?? blobUrl
    if (!src) return []
    return [{ src, ...(fullsize ? { fullsize } : {}), alt: typeof item.alt === 'string' ? item.alt : '', ...item.aspectRatio }]
  })
  return images.length ? { ...post, images } : post
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
    .map(normalizePostImages)

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
    .map((reply) => ({ post: normalizePostImages(reply) }))
  return { post: normalizePostImages(post), replies }
}

export type GetPostsInput = {
  query?: string
  repo?: string
  tag?: string
  category?: PostCategory
  cursor?: string
  limit?: number
  accessJwt?: string
  did?: string
}

export async function loadPostPage(data: GetPostsInput) {
  const query = data.query?.trim()
  const endpoint = query ? '/post/api/posts/search' : '/post/api/posts/list'
  const requestBody = query
    ? {
        q: query,
        limit: data.limit ?? 25,
        sort: 'latest',
        ...(data.cursor ? { cursor: data.cursor } : {}),
      }
    : {
        page: 1,
        per_page: data.limit ?? 20,
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
    (post) =>
      (!data.tag || hasPostTag(post.record.text, data.tag)) &&
      (!data.category || postCategory(post.record) === data.category),
  )
  const body = payload as { cursor?: unknown }
  return {
    posts: await hydrateAuthorNames(await hydrateViewerRecords(posts, data.did, data.accessJwt)),
    cursor: query && typeof body.cursor === 'string' && body.cursor
      ? body.cursor
      : null,
  }
}

export async function loadPosts(data: GetPostsInput) {
  const { posts } = await loadPostPage(data)
  return { posts }
}

export const getPosts = createServerFn({ method: 'POST' })
  .validator((data: GetPostsInput) => data)
  .handler(({ data }) => loadPosts(data))

export const getPostPage = createServerFn({ method: 'POST' })
  .validator((data: GetPostsInput) => data)
  .handler(({ data }) => loadPostPage(data))

type PostThreadInput = { uri: string; accessJwt?: string; did?: string }
export async function loadPostThread(data: PostThreadInput): Promise<PostThread> {
    const params = new URLSearchParams({
      uri: data.uri,
      depth: '1',
      parentHeight: '0',
    })
    const payload = await requestJson<unknown>(
      `${BACKEND_BASE}/${data.accessJwt ? 'pds' : 'bsky'}/xrpc/app.bsky.feed.getPostThread?${params}`,
      data.accessJwt ? { headers: { Authorization: `Bearer ${data.accessJwt}` } } : undefined,
    )
    const thread = normalizePostThread(payload)
    const posts = await hydrateViewerRecords(
      [thread.post, ...thread.replies.map((reply) => reply.post)],
      data.did,
      data.accessJwt,
    )
    const [namedPost, ...replies] = await hydrateAuthorNames(posts)
    return { post: namedPost, replies: replies.map((reply) => ({ post: reply })) }
}

export const getPostThread = createServerFn({ method: 'POST' })
  .validator((data: PostThreadInput) => data)
  .handler(({ data }) => loadPostThread(data))

type TextPostInput = {
    did: string
    accessJwt: string
    text: string
    category: PostCategory
    rkey: string
    createdAt: string
    images?: PdsImage[]
}

export const uploadPostImage = createServerFn({ method: 'POST' })
  .validator((data: { accessJwt: string; base64: string; contentType: string }) => data)
  .handler(({ data }) => uploadPdsImage(data.accessJwt, data.base64, data.contentType))

export async function createTextPostRecord(data: TextPostInput) {
    const text = data.text.trim()
    const images = data.images ?? []
    if (!Array.isArray(images)) throw new Error('图片信息无效，请重新添加。')
    if (!text && !images.length) throw new Error('请填写帖子内容或添加图片')
    if (text.length > 300) throw new Error('帖子内容最多 300 个字符')
    if (images.length > MAX_POST_IMAGES) throw new Error('帖子最多添加 4 张图片。')
    if (images.some((item) => item.image?.$type !== 'blob' || !item.image.ref?.$link || !POST_IMAGE_TYPES.includes(item.image.mimeType) || !Number.isFinite(item.image.size) || item.image.size <= 0 || item.image.size > MAX_POST_IMAGE_BYTES || typeof item.alt !== 'string')) throw new Error('图片信息无效，请重新添加。')
    if (!['post', 'activity', 'product'].includes(data.category)) {
      throw new Error('内容分类无效')
    }

    const createdAt = data.createdAt
    const record = {
      $type: 'app.bsky.feed.post', text, langs: ['zh'], xjdaoCategory: data.category, createdAt,
      ...(images.length ? { embed: { $type: 'app.bsky.embed.images', images } } : {}),
    }
    let body: { uri: string; cid: string }
    try { body = await createPdsRecord(data.accessJwt, {
      repo: data.did,
      collection: 'app.bsky.feed.post',
      rkey: data.rkey,
      record,
    }) } catch (error) {
      // A create may have succeeded before its response was lost. Read the same key;
      // never retry by creating another record or overwrite the published one.
      const query = new URLSearchParams({ repo: data.did, collection: 'app.bsky.feed.post', rkey: data.rkey })
      const existing = await requestJson<{ uri: string; cid: string; value: typeof record }>(`${BACKEND_BASE}/pds/xrpc/com.atproto.repo.getRecord?${query}`, { headers: { Authorization: `Bearer ${data.accessJwt}` } }).catch(() => { throw error })
      const imageIdentity = (embed: typeof record.embed) => (embed?.images ?? []).map((item) => [item.image.ref.$link, item.alt, item.aspectRatio?.width, item.aspectRatio?.height])
      if (existing.value.text !== text || existing.value.createdAt !== createdAt || existing.value.xjdaoCategory !== data.category || JSON.stringify(imageIdentity(existing.value.embed)) !== JSON.stringify(imageIdentity(record.embed))) throw new Error('上次提交的帖子已发布。请关闭发布窗口后查看，再发布新内容。')
      body = existing
    }
    return { uri: body.uri, cid: body.cid, text, createdAt, category: data.category, ...(images.length ? { images } : {}) }
}

export const createTextPost = createServerFn({ method: 'POST' })
  .validator((data: TextPostInput) => data)
  .handler(({ data }) => createTextPostRecord(data))

type DeletePostInput = {
  did: string
  accessJwt: string
  uri: string
}

export async function deleteOwnPostRecord(data: DeletePostInput) {
  const collection = 'app.bsky.feed.post'
  if (!data.uri.startsWith(`at://${data.did}/${collection}/`)) {
    throw new Error('只能删除自己的帖子')
  }

  await deletePdsRecord(data.accessJwt, {
    repo: data.did,
    collection,
    rkey: recordKeyFromUri(data.uri, collection),
  })
  return { uri: data.uri }
}

export const deletePost = createServerFn({ method: 'POST' })
  .validator((data: DeletePostInput) => data)
  .handler(({ data }) => deleteOwnPostRecord(data))

type ToggleInteractionInput = {
  did: string
  accessJwt: string
  postUri: string
  postCid: string
  recordUri?: string
}

export async function updateInteractionRecord(
  data: ToggleInteractionInput,
  collection: InteractionCollection,
) {
  if (data.recordUri) {
    if (!ownedInteractionUri(data.recordUri, data.did, collection)) throw new Error('只能取消当前账号的点赞或转发')
    await deletePdsRecord(data.accessJwt, {
      repo: data.did,
      collection,
      rkey: recordKeyFromUri(data.recordUri, collection),
    })
    return { recordUri: null, indexedAt: null }
  }

  const indexedAt = new Date().toISOString()
  const record = await createPdsRecord(data.accessJwt, {
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
    const record = await createPdsRecord(data.accessJwt, {
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
