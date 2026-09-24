import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'

import { ContentCardHeader } from '~/components/ContentCardHeader'
import { usePanelReady } from '~/components/DetailDialog'
import { ImageGroup } from '~/components/ContentImages'
import { PostText } from '~/components/PostText'
import {
  PostActions,
  type RepostChange,
} from '~/components/PostActions'
import { authorDisplayName, formatTimestamp } from '~/lib/format'
import type { PostThread, PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import {
  clearCachedFeed,
  createdPostView,
  createReply,
  getPostThread,
} from './api'
import {
  ACTIVITY_PARTICIPATION_TEXT,
  formatPostFieldValue,
  POST_CATEGORIES,
  postCategory,
  postDisplayText,
  postFieldValues,
} from './tags'

type PostThreadPanelProps = {
  uri: string
  focusReply?: boolean
  onRepostChange?: (change: RepostChange) => void
  onReplyCreated?: (postUri: string) => void
  onPostDeleted?: (postUri: string) => void
}

export function PostThreadPanel(props: PostThreadPanelProps) {
  const { session } = useStoredSession()
  return <PostThreadContent key={`${props.uri}:${session?.user.id ?? 'guest'}`} {...props} />
}

function PostThreadContent({
  uri,
  focusReply = false,
  onRepostChange,
  onReplyCreated,
  onPostDeleted,
}: PostThreadPanelProps) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [thread, setThread] = useState<PostThread | null>(null)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyTo, setReplyTo] = useState<PostView | null>(null)
  const [replyNotice, setReplyNotice] = useState('')
  const [isReplying, setReplying] = useState(false)
  const replyComposerId = useId()
  usePanelReady(isReady && Boolean(thread || error))
  const category = thread ? postCategory(thread.post.record) : 'post'
  const fields = thread ? postFieldValues(thread.post.record.text, category) : {}
  const participants = thread?.replies.filter(
    (reply) => reply.parentUri === thread.post.uri && reply.post.record.text === ACTIVITY_PARTICIPATION_TEXT,
  ) ?? []
  const hasParticipated = Boolean(
    session && participants.some((reply) => reply.post.author.did === session.pds.did),
  )
  const participationClosed = Boolean(
    fields.deadline && new Date(fields.deadline).getTime() <= Date.now(),
  )

  useEffect(() => {
    if (!isReady) return
    if (!uri) { setError('帖子不存在'); return }
    let active = true
    setError('')
    getPostThread({
      data: {
        uri,
        accessJwt: session?.pds.access_jwt,
        did: session?.pds.did,
      },
    })
      .then((next) => { if (active) setThread(next) })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '帖子暂时无法显示')
      })
    return () => { active = false }
  }, [isReady, session?.pds.access_jwt, session?.pds.did, uri])

  useEffect(() => {
    if (!focusReply || !thread) return
    window.requestAnimationFrame(() => {
      const composer = document.getElementById(replyComposerId)
      composer?.scrollIntoView({ block: 'end' })
      composer?.querySelector('textarea')?.focus()
    })
  }, [focusReply, replyComposerId, thread])

  const focusComposer = (target: PostView | null = null) => {
    setReplyTo(target)
    setReplyNotice('')
    const composer = document.getElementById(replyComposerId)
    composer?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    composer?.querySelector('textarea')?.focus()
  }

  const publishComment = async (text: string, target: PostView | null) => {
    if (!session || !thread) return
    const subject = { uri: thread.post.uri, cid: thread.post.cid }
    const reply = { root: subject, parent: target ? { uri: target.uri, cid: target.cid } : subject }
    const result = await createReply({
      data: {
        did: session.pds.did,
        accessJwt: session.pds.access_jwt,
        text,
        ...reply,
      },
    })
    const post = createdPostView(result, session, reply)
    setThread((current) => current ? {
      ...current,
      post: {
        ...current.post,
        replyCount: (current.post.replyCount ?? 0) + 1,
      },
      replies: [
        ...current.replies.map((item) => target?.uri === item.post.uri
          ? { ...item, post: { ...item.post, replyCount: (item.post.replyCount ?? 0) + 1 } }
          : item),
        { post, parentUri: reply.parent.uri },
      ],
    } : current)
    clearCachedFeed(session.pds.did)
    onReplyCreated?.(thread.post.uri)
  }

  const submitComment = async (
    text: string,
    successMessage: string,
    failureMessage: string,
    target: PostView | null = null,
  ) => {
    setReplying(true)
    setReplyNotice('')
    try {
      await publishComment(text, target)
      setReplyNotice(successMessage)
      return true
    } catch (reason) {
      setReplyNotice(reason instanceof Error ? reason.message : failureMessage)
      return false
    } finally {
      setReplying(false)
    }
  }

  const submitReply = async () => {
    if (!session || !thread || !replyText.trim()) return
    if (await submitComment(replyText, '评论已发布。', '评论失败', replyTo)) {
      setReplyText('')
      setReplyTo(null)
    }
  }

  const participate = async () => {
    if (!session || !thread || hasParticipated || participationClosed) return
    await submitComment(ACTIVITY_PARTICIPATION_TEXT, '已参与活动。', '参与失败')
  }

  return (
    <div className="post-thread-panel">
      {error ? <div className="form-error">{error}</div> : null}
      {thread ? (
        <>
          <article className="content-card post-detail-card">
            <ContentCardHeader
              name={authorDisplayName(thread.post.author)}
              timestamp={formatTimestamp(
                thread.post.record.createdAt || thread.post.indexedAt,
                true,
              )}
              profileActor={thread.post.author.did}
              avatarUrl={thread.post.author.avatar}
            />
            <p className="post-detail-copy">
              <PostText text={postDisplayText(thread.post.record.text, category)} />
            </p>
            <ImageGroup images={(thread.post.images ?? []).map((image) => ({ ...image, src: image.fullsize ?? image.src }))} />
            <div className="detail-actions">
              <PostActions
                post={thread.post}
                onOpenComments={() => focusComposer()}
                onRepostChange={onRepostChange}
                onPostDeleted={(postUri) => {
                  if (onPostDeleted) {
                    onPostDeleted(postUri)
                  } else {
                    void navigate({ to: '/' })
                  }
                }}
              />
            </div>
          </article>

          {category === 'post' ? (
            <section className="reply-section" aria-label="评论">
              {session && <div className="reply-composer" id={replyComposerId}>
                {replyTo && <div className="reply-composer-target"><span>回复 {authorDisplayName(replyTo.author)}</span><Button label="取消回复" variant="ghost" size="sm" onClick={() => setReplyTo(null)} /></div>}
                <TextArea
                  label={replyTo ? `回复 ${authorDisplayName(replyTo.author)}` : '写下评论'}
                  value={replyText}
                  onChange={setReplyText}
                  rows={6}
                  maxLength={300}
                  width="100%"
                  placeholder="写下你的评论…"
                  hasAutoFocus={focusReply}
                />
                {replyNotice && <p className="reply-composer-notice" role="status">{replyNotice}</p>}
                <div className="form-actions">
                  <Button
                    label="发布评论"
                    variant="primary"
                    clickAction={submitReply}
                    isLoading={isReplying}
                    isDisabled={!replyText.trim() || replyText.length > 300}
                  />
                </div>
              </div>}

              <h2>评论 <span>{thread.replies.length}</span></h2>
              {!thread.replies.length ? (
                <div className="empty-panel replies-empty">
                  <EmptyState title="还没有评论" description="成为第一个参与讨论的人。" />
                </div>
              ) : (
                <div className="reply-list">
                  {thread.replies.filter((reply) => reply.parentUri === thread.post.uri).map((reply) => (
                    <div className="reply-thread" key={reply.post.uri}>
                      <CommentRow post={reply.post} onReply={() => focusComposer(reply.post)} />
                      {thread.replies.filter((child) => child.parentUri === reply.post.uri).map((child) => (
                        <CommentRow key={child.post.uri} post={child.post} repliedTo={authorDisplayName(reply.post.author)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section
              className="special-post-details"
              aria-label={`${POST_CATEGORIES[category].label}信息`}
            >
              {POST_CATEGORIES[category].fields.map((field) => (
                <div key={field.key}>
                  <span>{field.label}</span>
                  <strong>{formatPostFieldValue(field.key, fields[field.key])}</strong>
                </div>
              ))}
              {session && category === 'activity' ? (
                <div className="activity-participation">
                  <span>{participants.length} 人已参与</span>
                  <Button
                    label={participationClosed ? '活动已截止' : hasParticipated ? '已参与' : '参与活动'}
                    variant="primary"
                    clickAction={participate}
                    isLoading={isReplying}
                    isDisabled={participationClosed || hasParticipated}
                  />
                  <small>参与将作为一条评论写入该活动帖子。</small>
                  <em role="status">{replyNotice}</em>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : !error ? (
        <div className="loading-line">正在加载帖子…</div>
      ) : null}
    </div>
  )
}

function CommentRow({ post, onReply, repliedTo }: { post: PostView; onReply?: () => void; repliedTo?: string }) {
  return <article className={`reply-row${repliedTo ? ' reply-row-child' : ''}`}>
    <ContentCardHeader name={authorDisplayName(post.author)} timestamp={formatTimestamp(post.record.createdAt || post.indexedAt, true)} profileActor={post.author.did} avatarUrl={post.author.avatar} />
    {repliedTo && <p className="reply-parent">回复 {repliedTo}</p>}
    <p><PostText text={post.record.text} /></p>
    <ImageGroup images={(post.images ?? []).map((image) => ({ ...image, src: image.fullsize ?? image.src }))} />
    <PostActions post={post} onOpenComments={onReply} commentAction={repliedTo ? 'hidden' : 'reply'} />
  </article>
}
