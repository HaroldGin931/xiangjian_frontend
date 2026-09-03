import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, MessageCircle, PackageCheck, Repeat2, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  clearCachedFeed,
  deletePost,
  hideDeletedPost,
  toggleLike,
  toggleRepost,
} from '~/features/feed/api'
import { postFieldValues, postKind } from '~/features/feed/tags'
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
  onPostDeleted,
}: {
  post: PostView
  onOpenComments?: () => void
  onRepostChange?: (change: RepostChange) => void
  onPostDeleted?: (uri: string) => void
}) {
  const { session } = useStoredSession()
  const navigate = useNavigate()
  const [likeUri, setLikeUri] = useState(post.viewer?.like)
  const [repostUri, setRepostUri] = useState(post.viewer?.repost)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0)
  const [pending, setPending] = useState<'like' | 'repost' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const kind = postKind(post.record.text)
  const fields = postFieldValues(post.record.text, kind)
  const canDelete = Boolean(
    session &&
    session.pds.did === post.author.did &&
    !post.record.reply,
  )

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
      const result = await toggleLike({
        data: {
          did: activeSession.pds.did,
          accessJwt: activeSession.pds.access_jwt,
          postUri: post.uri,
          postCid: post.cid,
          recordUri: likeUri,
        },
      })
      clearCachedFeed(activeSession.pds.did)
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
      const result = await toggleRepost({
        data: {
          did: activeSession.pds.did,
          accessJwt: activeSession.pds.access_jwt,
          postUri: post.uri,
          postCid: post.cid,
          recordUri: repostUri,
        },
      })
      clearCachedFeed(activeSession.pds.did)
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

  const handleDelete = async () => {
    if (!session || !canDelete || pending) return
    if (!window.confirm('删除后无法恢复，确定删除这条帖子吗？')) return

    setPending('delete')
    setError('')
    try {
      await deletePost({
        data: {
          did: session.pds.did,
          accessJwt: session.pds.access_jwt,
          uri: post.uri,
        },
      })
      hideDeletedPost(post.uri, session.pds.did)
      onPostDeleted?.(post.uri)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败')
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <div className="content-card-actions post-actions" aria-label="帖子互动">
        {kind === 'activity' ? (
          <span className="post-action special-post-state" aria-label={`${post.replyCount ?? 0} 人参与`}>
            <Users size={18} aria-hidden="true" /> 参与 {post.replyCount ?? 0}
          </span>
        ) : kind === 'product' ? (
          <span className="post-action special-post-state" aria-label={`商品状态：${fields.availability || '待确认'}`}>
            <PackageCheck size={18} aria-hidden="true" /> {fields.availability || '状态待确认'}
          </span>
        ) : onOpenComments ? (
          <Button
            label={`${post.replyCount ?? 0} 条评论`}
            variant="ghost"
            size="sm"
            icon={<MessageCircle size={18} aria-hidden="true" />}
            className="post-action"
            onClick={onOpenComments}
          >
            {post.replyCount ?? 0}
          </Button>
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
        {kind === 'post' ? (
          <Button
            label={repostUri ? '取消转发' : '转发'}
            variant="ghost"
            size="sm"
            icon={<Repeat2 size={18} aria-hidden="true" />}
            className={`post-action ${repostUri ? 'active' : ''}`}
            clickAction={handleRepost}
            isDisabled={pending !== null}
            aria-pressed={Boolean(repostUri)}
          >
            {repostCount}
          </Button>
        ) : null}
        <Button
          label={likeUri ? '取消点赞' : '点赞'}
          variant="ghost"
          size="sm"
          icon={<Heart size={18} fill={likeUri ? 'currentColor' : 'none'} aria-hidden="true" />}
          className={`post-action ${likeUri ? 'active' : ''}`}
          clickAction={handleLike}
          isDisabled={pending !== null}
          aria-pressed={Boolean(likeUri)}
        >
          {likeCount}
        </Button>
        {canDelete ? (
          <IconButton
            label="删除帖子"
            variant="ghost"
            size="sm"
            icon={<Trash2 size={18} aria-hidden="true" />}
            className="post-action"
            clickAction={handleDelete}
            isLoading={pending === 'delete'}
            isDisabled={pending !== null}
          />
        ) : null}
      </div>
      {error ? <div className="post-action-error" role="status">{error}</div> : null}
    </>
  )
}
