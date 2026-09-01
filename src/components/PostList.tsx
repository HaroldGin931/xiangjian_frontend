import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Link } from '@tanstack/react-router'
import { Clock3, Repeat2 } from 'lucide-react'

import { PostActions, type RepostChange } from '~/components/PostActions'
import { formatTimestamp } from '~/lib/format'
import type { PostView } from '~/lib/models'

function firstTag(text: string) {
  return text.match(/#[\p{L}\p{N}_-]+/u)?.[0] ?? null
}

export function PostList({
  posts,
  onOpenPost,
  onRepostChange,
}: {
  posts: PostView[]
  onOpenPost?: (post: PostView, focusReply: boolean) => void
  onRepostChange?: (change: RepostChange) => void
}) {
  if (posts.length === 0) {
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
      {posts.map((post) => {
        const tag = firstTag(post.record.text)
        return (
          <article
            className="post-row"
            key={post.reason?.uri ?? post.uri}
          >
            {post.reason ? (
              <div className="post-reason">
                <Repeat2 size={14} aria-hidden="true" />
                {post.reason.by.displayName || post.reason.by.handle.split('.')[0]} 转发了
              </div>
            ) : null}
            <div className="post-heading">
              <div className="post-author">
                <span className="post-avatar" aria-hidden="true">
                  {(post.author.displayName || post.author.handle).slice(0, 1).toUpperCase()}
                </span>
                <div>
                <strong>{post.author.displayName || post.author.handle.split('.')[0]}</strong>
                <div className="post-meta">
                  {post.author.handle} · {formatTimestamp(post.record.createdAt || post.indexedAt)}
                </div>
                </div>
              </div>
              {tag ? <span className="post-tag">{tag}</span> : null}
            </div>
            {onOpenPost ? (
              <button
                type="button"
                className="post-copy-link post-copy-button"
                onClick={() => onOpenPost(post, false)}
              >
                <p className="post-copy">{post.record.text}</p>
              </button>
            ) : (
              <Link to="/post" search={{ uri: post.uri }} className="post-copy-link">
                <p className="post-copy">{post.record.text}</p>
              </Link>
            )}
            <PostActions
              post={post}
              onOpenComments={onOpenPost ? () => onOpenPost(post, true) : undefined}
              onRepostChange={onRepostChange}
            />
          </article>
        )
      })}
    </div>
  )
}

export function PendingPost({ handle, text }: { handle: string; text: string }) {
  return (
    <article className="post-row pending-post" aria-live="polite">
      <div className="post-heading">
        <div>
          <strong>{handle.split('.')[0]}</strong>
          <div className="post-meta">{handle} · 刚刚</div>
        </div>
        <span className="sync-badge">
          <Clock3 size={16} aria-hidden="true" /> 发布中
        </span>
      </div>
      <p className="post-copy">{text}</p>
    </article>
  )
}
