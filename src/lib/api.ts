import { createServerFn } from '@tanstack/react-start'

import type { PostFeed, PostView, RiceSession, RiceUser } from './models'

const BACKEND_BASE = process.env.XIANGJIAN_BACKEND_URL ?? 'http://localhost:19006'

type JsonObject = Record<string, unknown>

async function readJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as JsonObject
  if (!response.ok) {
    const errors = body.errors as JsonObject | undefined
    const detail = typeof errors?.detail === 'string' ? errors.detail : null
    throw new Error(detail ?? `接口请求失败 (${response.status})`)
  }
  return body
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

export const getPosts = createServerFn({ method: 'POST' })
  .validator((data: { query?: string; repo?: string }) => data)
  .handler(async ({ data }) => {
    const query = data.query?.trim()
    const endpoint = query ? '/post/api/posts/search' : '/post/api/posts'
    const requestBody = query
      ? { q: query, limit: 25, sort: 'latest' }
      : { page: 1, per_page: 20, ...(data.repo ? { repo: data.repo } : {}) }
    const response = await fetch(`${BACKEND_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    return normalizePostFeed(await readJson(response))
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

export const createTextPost = createServerFn({ method: 'POST' })
  .validator(
    (data: { did: string; accessJwt: string; text: string }) => data,
  )
  .handler(async ({ data }) => {
    const text = data.text.trim()
    if (!text) throw new Error('帖子内容不能为空')
    if (text.length > 300) throw new Error('首版文字帖最多 300 个字符')

    const response = await fetch(
      `${BACKEND_BASE}/pds/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: data.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            langs: ['zh'],
            createdAt: new Date().toISOString(),
          },
        }),
      },
    )
    const body = (await readJson(response)) as { uri: string; cid: string }
    return { uri: body.uri, cid: body.cid, text }
  })
