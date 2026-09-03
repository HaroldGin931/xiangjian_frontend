import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Link } from '@tanstack/react-router'
import { Repeat2 } from 'lucide-react'

import { PostActions, type RepostChange } from '~/components/PostActions'
import { postDisplayText, postKind, postTags } from '~/features/feed/tags'
import { authorDisplayName, authorInitial, formatTimestamp } from '~/lib/format'
import type { PostView } from '~/lib/models'

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
        const kind = postKind(post.record.text)
        const tags = postTags(post.record.text)
        return (
          <article
            className={`post-row ${kind === 'post' ? '' : `${kind}-post`}`}
            key={post.reason?.uri ?? post.uri}
          >
            {post.reason ? (
              <div className="post-reason">
                <Repeat2 size={14} aria-hidden="true" />
                <Link to="/profile/$actor" params={{ actor: post.reason.by.did }}>
                  {authorDisplayName(post.reason.by)}
                </Link>
                转发了
              </div>
            ) : null}
            <div className="post-heading">
              <Link
                to="/profile/$actor"
                params={{ actor: post.author.did }}
                className="post-author"
              >
                <span className="post-avatar" aria-hidden="true">
                  {authorInitial(post.author)}
                </span>
                <div>
                  <strong>{authorDisplayName(post.author)}</strong>
                  <div className="post-meta">
                    {post.author.handle} ·{' '}
                    {formatTimestamp(post.record.createdAt || post.indexedAt)}
                  </div>
                </div>
              </Link>
              {tags.length ? (
                <div className="post-tags" aria-label="帖子标签">
                  {tags.map((tag) => {
                    const tagKind = postKind(tag)
                    return (
                      <span
                        className={`post-tag ${tagKind === 'post' ? '' : `${tagKind}-tag`}`}
                        key={tag}
                      >
                        {tag}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>
            {onOpenPost ? (
              <button
                type="button"
                className="post-copy-link post-copy-button"
                onClick={() => onOpenPost(post, false)}
              >
                <p className="post-copy">{postDisplayText(post.record.text)}</p>
              </button>
            ) : (
              <Link to="/post" search={{ uri: post.uri }} className="post-copy-link">
                <p className="post-copy">{postDisplayText(post.record.text)}</p>
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
