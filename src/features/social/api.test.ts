import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  loadActivityParticipations,
  loadSocialConnections,
  loadSocialProfile,
  normalizeSocialProfile,
  updateFollowRecord,
} from './api'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const profile = {
  did: 'did:plc:alice',
  handle: 'alice.local.xjdao.xyz',
  displayName: 'Mo Alice',
  followersCount: 2,
  followsCount: 3,
  postsCount: 4,
  viewer: { following: 'at://did:plc:me/app.bsky.graph.follow/abc' },
}

describe('social graph data', () => {
  it('reads legacy public profiles anonymously and preserves PDS fields missing from Rice', async () => {
    vi.stubEnv('XIANGJIAN_APPVIEW_IMAGE_ORIGINS', 'https://old-appview.example')
    const fetchMock = vi.fn(async (url: string | URL) => new Response(JSON.stringify(String(url).includes('/bsky/')
      ? { ...profile, description: '原有简介', avatar: 'https://old-appview.example/img/avatar.jpg' }
      : { data: { did: profile.did, handle: profile.handle, nickname: null, bio: null, avatar: null } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadSocialProfile(profile.did)).resolves.toMatchObject({ ...profile, description: '原有简介', avatar: '/bsky/img/avatar.jpg' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('/bsky/xrpc/app.bsky.actor.getProfile')
  })

  it('shows a legacy PDS user without a Rice account', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('/bsky/')
      ? new Response(JSON.stringify(profile))
      : new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })))
    await expect(loadSocialProfile(profile.did)).resolves.toMatchObject(profile)
  })

  it('keeps the public profile and current viewer relationship', () => {
    expect(normalizeSocialProfile(profile)).toMatchObject(profile)
    expect(normalizeSocialProfile({ did: 'did:plc:bob', handle: 'bob.local' }))
      .toMatchObject({ followersCount: 0, followsCount: 0, postsCount: 0 })
  })

  it('reads either connection list with the same result shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ subject: profile, followers: [profile], cursor: 'next' }), {
        status: 200,
      }),
    ))

    await expect(loadSocialConnections({ actor: profile.did, kind: 'followers' }))
      .resolves.toEqual({ subject: profile, profiles: [profile], cursor: 'next' })
  })

  it('creates and deletes the same follow record', async () => {
    const recordUri = 'at://did:plc:me/app.bsky.graph.follow/3abc'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uri: recordUri, cid: 'cid' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      did: 'did:plc:me',
      accessJwt: 'access-token',
      targetDid: profile.did,
    }

    await expect(updateFollowRecord(input)).resolves.toEqual({ recordUri })
    await expect(updateFollowRecord({ ...input, recordUri }))
      .resolves.toEqual({ recordUri: null })

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      repo: input.did,
      collection: 'app.bsky.graph.follow',
      record: { subject: profile.did },
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      repo: input.did,
      collection: 'app.bsky.graph.follow',
      rkey: '3abc',
    })
  })

  it('keeps only activity participation replies and their root posts', async () => {
    const activity = {
      uri: 'at://did:plc:bob/app.bsky.feed.post/activity',
      cid: 'activity-cid',
      indexedAt: '2026-09-03T08:00:00Z',
      author: { did: 'did:plc:bob', handle: 'bob.local' },
      record: {
        text: '村庄开放日\n#乡村',
        createdAt: '2026-09-03T08:00:00Z',
        xjdaoCategory: 'activity' as const,
      },
      replyCount: 1,
      repostCount: 0,
      likeCount: 0,
    }
    const reply = {
      ...activity,
      uri: 'at://did:plc:alice/app.bsky.feed.post/reply',
      author: { did: 'did:plc:alice', handle: 'alice.local' },
      record: {
        text: '参与活动',
        createdAt: '2026-09-03T09:00:00Z',
        reply: {
          root: { uri: activity.uri, cid: activity.cid },
          parent: { uri: activity.uri, cid: activity.cid },
        },
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ posts: [{ post: reply, reply: { root: activity } }] }), {
        status: 200,
      }),
    ))

    await expect(loadActivityParticipations('did:plc:alice')).resolves.toEqual([
      { activity, participatedAt: '2026-09-03T09:00:00Z' },
    ])
  })
})
