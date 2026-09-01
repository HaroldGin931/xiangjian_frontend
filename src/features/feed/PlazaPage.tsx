import { useEffect, useState } from 'react'

import type { RepostChange } from '~/components/PostActions'
import { PostList } from '~/components/PostList'
import type { PostFeed } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getPosts, readCachedFeed, writeCachedFeed } from './api'
import { PostThreadDialog } from './PostThreadDialog'
import { postKind, type PostKind } from './tags'

type FeedTab = 'all' | 'activity' | 'product'

export function PlazaPage({ initialFeed }: { initialFeed: PostFeed }) {
  const [feed, setFeed] = useState(initialFeed)
  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedPost, setSelectedPost] = useState<{
    uri: string
    focusReply: boolean
    kind: PostKind
  } | null>(null)
  const { session, isReady } = useStoredSession()
  const accessJwt = session?.pds.access_jwt
  const did = session?.pds.did

  useEffect(() => {
    if (!isReady) return
    if (activeTab === 'all' && reloadKey === 0) {
      const cachedFeed = readCachedFeed(did)
      if (cachedFeed) {
        setLoading(false)
        setError('')
        setFeed(cachedFeed)
        return
      }
      if (!session) {
        setLoading(false)
        setError('')
        writeCachedFeed(initialFeed)
        setFeed(initialFeed)
        return
      }
    }

    let active = true
    setLoading(true)
    setError('')
    void getPosts({
      data: {
        accessJwt,
        did,
        tag:
          activeTab === 'activity'
            ? '活动'
            : activeTab === 'product'
              ? '商品'
              : undefined,
      },
    })
      .then((nextFeed) => {
        if (!active) return
        if (activeTab === 'all') writeCachedFeed(nextFeed, did)
        setFeed(nextFeed)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '帖子暂时无法加载')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessJwt, activeTab, did, initialFeed, isReady, reloadKey, session])

  const handleRepostChange = ({ post, reason }: RepostChange) => {
    if (!did) return
    setFeed((current) => {
      const { reason: _previousReason, ...basePost } = post
      const viewer = { ...basePost.viewer, repost: reason?.uri }
      const remaining = current.posts
        .filter(
          (item) =>
            !(item.uri === post.uri && item.reason?.by.did === did),
        )
        .map((item) =>
          item.uri === post.uri ? { ...item, viewer } : item,
        )
      const posts = reason
        ? [{ ...basePost, viewer, reason }, ...remaining]
        : remaining
      return { posts }
    })
  }

  const handleReplyCreated = (postUri: string) => {
    setFeed((current) => ({
      ...current,
      posts: current.posts.map((post) =>
        post.uri === postUri
          ? { ...post, replyCount: (post.replyCount ?? 0) + 1 }
          : post,
      ),
    }))
  }

  return (
    <div className="page plaza-page">
      <section className="feed-toolbar" aria-label="帖子分类">
        <div className="feed-tabs" role="tablist">
          {(
            [
              ['all', '全部帖子'],
              ['activity', '活动'],
              ['product', '商品'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={activeTab === value ? 'active' : ''}
              onClick={() => setActiveTab(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="feed-progress" aria-live="polite">
          {isLoading ? '正在更新…' : ''}
        </span>
      </section>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            重试
          </button>
        </div>
      ) : null}

      <section className="feed-section">
        <PostList
          posts={feed.posts}
          onOpenPost={(post, focusReply) =>
            setSelectedPost({
              uri: post.uri,
              focusReply,
              kind: postKind(post.record.text),
            })
          }
          onRepostChange={handleRepostChange}
        />
      </section>

      {selectedPost ? (
        <PostThreadDialog
          uri={selectedPost.uri}
          kind={selectedPost.kind}
          focusReply={selectedPost.focusReply}
          onClose={() => setSelectedPost(null)}
          onRepostChange={handleRepostChange}
          onReplyCreated={handleReplyCreated}
        />
      ) : null}
    </div>
  )
}
