import { Button } from '@astryxdesign/core/Button'
import { useEffect, useState } from 'react'

import type { RepostChange } from '~/components/PostActions'
import { PostList } from '~/components/PostList'
import type { PostFeed } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { getPosts, readCachedFeed, writeCachedFeed } from './api'
import { PostThreadDialog } from './PostThreadDialog'
import { postCategory } from './tags'
import type { PostCategory } from '~/lib/models'

type FeedTab = 'all' | 'activity'

export function PlazaPage({ initialFeed }: { initialFeed: PostFeed }) {
  const [feed, setFeed] = useState(initialFeed)
  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedPost, setSelectedPost] = useState<{
    uri: string
    focusReply: boolean
    category: PostCategory
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
        category: activeTab === 'all' ? undefined : activeTab,
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

  const handlePostDeleted = (postUri: string) => {
    setFeed((current) => ({
      posts: current.posts.filter((post) => post.uri !== postUri),
    }))
    setSelectedPost((current) => current?.uri === postUri ? null : current)
  }

  return (
    <div className="page plaza-page">
      <section className="feed-toolbar" aria-label="帖子分类">
        <div className="feed-tabs filter-buttons" role="group" aria-label="帖子分类">
          {(
            [
              ['all', '全部帖子'],
              ['activity', '活动'],
            ] as const
          ).map(([value, label]) => (
            <Button
              label={label}
              variant="ghost"
              size="sm"
              className={activeTab === value ? 'active' : undefined}
              aria-pressed={activeTab === value}
              onClick={() => setActiveTab(value)}
              key={value}
            />
          ))}
        </div>
        <span className="feed-progress" aria-live="polite">
          {isLoading ? '正在更新…' : ''}
        </span>
      </section>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <Button label="重试" variant="ghost" size="sm" onClick={() => setReloadKey((value) => value + 1)} />
        </div>
      ) : null}

      <section className="feed-section">
        <PostList
          posts={feed.posts}
          onOpenPost={(post, focusReply) =>
            setSelectedPost({
              uri: post.uri,
              focusReply,
              category: postCategory(post.record),
            })
          }
          onRepostChange={handleRepostChange}
          onPostDeleted={handlePostDeleted}
        />
      </section>

      {selectedPost ? (
        <PostThreadDialog
          uri={selectedPost.uri}
          category={selectedPost.category}
          focusReply={selectedPost.focusReply}
          onClose={() => setSelectedPost(null)}
          onRepostChange={handleRepostChange}
          onReplyCreated={handleReplyCreated}
          onPostDeleted={handlePostDeleted}
        />
      ) : null}
    </div>
  )
}
