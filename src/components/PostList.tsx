import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Clock3 } from 'lucide-react'

import type { PostView } from '~/lib/models'

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function firstTag(text: string) {
  return text.match(/#[\p{L}\p{N}_-]+/u)?.[0] ?? null
}

export function PostList({ posts }: { posts: PostView[] }) {
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
          <article className="post-row" key={post.uri}>
            <div className="post-heading">
              <div>
                <strong>{post.author.displayName || post.author.handle.split('.')[0]}</strong>
                <div className="post-meta">
                  {post.author.handle} · {formatTime(post.record.createdAt || post.indexedAt)}
                </div>
              </div>
              {tag ? <span className="post-tag">{tag}</span> : null}
            </div>
            <p className="post-copy">{post.record.text}</p>
            <div className="post-stats">
              <span>{post.replyCount ?? 0} 条评论</span>
              <span>
                {post.likeCount ?? 0} 赞 · {post.repostCount ?? 0} 转发
              </span>
            </div>
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
          <div className="post-meta">{handle} · 刚刚写入 PDS</div>
        </div>
        <span className="sync-badge">
          <Clock3 size={16} aria-hidden="true" /> 索引同步中
        </span>
      </div>
      <p className="post-copy">{text}</p>
    </article>
  )
}

