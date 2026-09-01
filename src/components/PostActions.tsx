import { Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { toggleLike, toggleRepost } from '~/features/feed/api'
import type { PostView } from '~/lib/models'
import { useStoredSession } from '~/features/session/session'

export type RepostChange = {
  post: PostView
  reason?: NonNullable<PostView['reason']>
}

export function PostActions({
  post,
  onOpenComments,
  onRepostChange,
}: {
  post: PostView
  onOpenComments?: () => void
  onRepostChange?: (change: RepostChange) => void
}) {
  const { session } = useStoredSession()
  const navigate = useNavigate()
  const like = useServerFn(toggleLike)
  const repost = useServerFn(toggleRepost)
  const [likeUri, setLikeUri] = useState(post.viewer?.like)
  const [repostUri, setRepostUri] = useState(post.viewer?.repost)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0)
  const [pending, setPending] = useState<'like' | 'repost' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setLikeUri(post.viewer?.like)
    setRepostUri(post.viewer?.repost)
    setLikeCount(post.likeCount ?? 0)
    setRepostCount(post.repostCount ?? 0)
  }, [post])

  const requireSession = async () => {
    if (session) return session
    await navigate({ to: '/login' })
    return null
  }

  const handleLike = async () => {
    const activeSession = await requireSession()
    if (!activeSession || pending) return
    setPending('like')
    setError('')
    try {
      const result = await like({
        data: {
          did: activeSession.pds.did,
          accessJwt: activeSession.pds.access_jwt,
          postUri: post.uri,
          postCid: post.cid,
          recordUri: likeUri,
        },
      })
      setLikeCount((count) => Math.max(0, count + (likeUri ? -1 : 1)))
      setLikeUri(result.recordUri ?? undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '点赞失败')
    } finally {
      setPending(null)
    }
  }

  const handleRepost = async () => {
    const activeSession = await requireSession()
    if (!activeSession || pending) return
    setPending('repost')
    setError('')
    try {
      const result = await repost({
        data: {
          did: activeSession.pds.did,
          accessJwt: activeSession.pds.access_jwt,
          postUri: post.uri,
          postCid: post.cid,
          recordUri: repostUri,
        },
      })
      setRepostCount((count) => Math.max(0, count + (repostUri ? -1 : 1)))
      const nextUri = result.recordUri ?? undefined
      setRepostUri(nextUri)
      onRepostChange?.({
        post,
        reason: nextUri && result.indexedAt
          ? {
              $type: 'app.bsky.feed.defs#reasonRepost',
              by: {
                did: activeSession.pds.did,
                handle: activeSession.pds.handle,
                displayName: activeSession.user.nickname ?? undefined,
              },
              uri: nextUri,
              indexedAt: result.indexedAt,
            }
          : undefined,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '转发失败')
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <div className="post-actions" aria-label="帖子互动">
        {onOpenComments ? (
          <button
            type="button"
            className="post-action"
            aria-label={`${post.replyCount ?? 0} 条评论`}
            onClick={onOpenComments}
          >
            <MessageCircle size={18} aria-hidden="true" />
            {post.replyCount ?? 0}
          </button>
        ) : (
          <Link
            to="/post"
            search={{ uri: post.uri }}
            hash="reply"
            className="post-action"
            aria-label={`${post.replyCount ?? 0} 条评论`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            {post.replyCount ?? 0}
          </Link>
        )}
        <button
          type="button"
          className={`post-action ${repostUri ? 'active' : ''}`}
          onClick={handleRepost}
          disabled={pending !== null}
          aria-label={repostUri ? '取消转发' : '转发'}
          aria-pressed={Boolean(repostUri)}
        >
          <Repeat2 size={18} aria-hidden="true" />
          {repostCount}
        </button>
        <button
          type="button"
          className={`post-action ${likeUri ? 'active' : ''}`}
          onClick={handleLike}
          disabled={pending !== null}
          aria-label={likeUri ? '取消点赞' : '点赞'}
          aria-pressed={Boolean(likeUri)}
        >
          <Heart size={18} fill={likeUri ? 'currentColor' : 'none'} aria-hidden="true" />
          {likeCount}
        </button>
      </div>
      {error ? <div className="post-action-error" role="status">{error}</div> : null}
    </>
  )
}
