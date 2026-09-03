import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Link, useNavigate } from '@tanstack/react-router'
import { Repeat2 } from 'lucide-react'
import { useState } from 'react'

import { ContentCardHeader } from '~/components/ContentCardHeader'
import { PostText } from '~/components/PostText'
import { PostActions, type RepostChange } from '~/components/PostActions'
import { isPostHidden } from '~/features/feed/api'
import { postCategory, postDisplayText } from '~/features/feed/tags'
import { authorDisplayName, authorInitial, formatTimestamp } from '~/lib/format'
import type { PostView } from '~/lib/models'

export function PostList({
  posts,
  onOpenPost,
  onRepostChange,
  onPostDeleted,
}: {
  posts: PostView[]
  onOpenPost?: (post: PostView, focusReply: boolean) => void
  onRepostChange?: (change: RepostChange) => void
  onPostDeleted?: (uri: string) => void
}) {
  const [deletedUris, setDeletedUris] = useState(() => new Set<string>())
  const visiblePosts = posts.filter(
    (post) => !deletedUris.has(post.uri) && !isPostHidden(post.uri),
  )

  if (visiblePosts.length === 0) {
    return (
      <div className="empty-panel">
        <EmptyState
          title="这里还没有帖子"
          description="页面没有填充任何演示内容；登录后发布的真实帖子会出现在这里。"
        />
      </div>
    )
  }

  return (
    <div className="post-list">
      {visiblePosts.map((post) => (
        <PostCard
          post={post}
          onOpenPost={onOpenPost}
          onRepostChange={onRepostChange}
          onPostDeleted={(uri) => {
            setDeletedUris((current) => new Set(current).add(uri))
            onPostDeleted?.(uri)
          }}
          key={post.reason?.uri ?? post.uri}
        />
      ))}
    </div>
  )
}

export function PostCard({
  post,
  onOpenPost,
  onRepostChange,
  onPostDeleted,
}: {
  post: PostView
  onOpenPost?: (post: PostView, focusReply: boolean) => void
  onRepostChange?: (change: RepostChange) => void
  onPostDeleted?: (uri: string) => void
}) {
  const navigate = useNavigate()
  const category = postCategory(post.record)
  const openPost = () => {
    if (onOpenPost) {
      onOpenPost(post, false)
    } else {
      void navigate({ to: '/post', search: { uri: post.uri } })
    }
  }

  return (
    <article className={`content-card post-row ${category === 'post' ? '' : `${category}-post`}`}>
      {post.reason ? (
        <div className="post-reason">
          <Repeat2 size={14} aria-hidden="true" />
          <Link to="/profile/$actor" params={{ actor: post.reason.by.did }}>
            {authorDisplayName(post.reason.by)}
          </Link>
          转发了
        </div>
      ) : null}
      <ContentCardHeader
        initial={authorInitial(post.author)}
        name={authorDisplayName(post.author)}
        timestamp={formatTimestamp(post.record.createdAt || post.indexedAt)}
        profileActor={post.author.did}
      />
      <p
        className="post-copy post-copy-link"
        role="link"
        tabIndex={0}
        onClick={openPost}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPost()
          }
        }}
      >
        <PostText text={postDisplayText(post.record.text, category)} />
      </p>
      <PostActions
        post={post}
        onOpenComments={onOpenPost ? () => onOpenPost(post, true) : undefined}
        onRepostChange={onRepostChange}
        onPostDeleted={onPostDeleted}
      />
    </article>
  )
}
