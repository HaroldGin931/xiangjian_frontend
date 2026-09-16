import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'

import { ContentCardHeader } from '~/components/ContentCardHeader'
import { ImageGroup } from '~/components/ContentImages'
import { PostText } from '~/components/PostText'
import {
  PostActions,
  type RepostChange,
} from '~/components/PostActions'
import { authorDisplayName, authorInitial, formatTimestamp } from '~/lib/format'
import type { PostThread } from '~/lib/models'

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

export function PostThreadPanel({
  uri,
  focusReply = false,
  onRepostChange,
  onReplyCreated,
  onPostDeleted,
}: {
  uri: string
  focusReply?: boolean
  onRepostChange?: (change: RepostChange) => void
  onReplyCreated?: (postUri: string) => void
  onPostDeleted?: (postUri: string) => void
}) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [thread, setThread] = useState<PostThread | null>(null)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyNotice, setReplyNotice] = useState('')
  const [isReplying, setReplying] = useState(false)
  const replyComposerId = useId()
  const category = thread ? postCategory(thread.post.record) : 'post'
  const fields = thread ? postFieldValues(thread.post.record.text, category) : {}
  const participants = thread?.replies.filter(
    (reply) => reply.post.record.text === ACTIVITY_PARTICIPATION_TEXT,
  ) ?? []
  const hasParticipated = Boolean(
    session && participants.some((reply) => reply.post.author.did === session.pds.did),
  )
  const participationClosed = Boolean(
    fields.deadline && new Date(fields.deadline).getTime() <= Date.now(),
  )

  useEffect(() => {
    if (!uri || !isReady) return
    let active = true
    setError('')
    setThread(null)
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
  }, [isReady, session, uri])

  useEffect(() => {
    if (!focusReply || !thread) return
    window.requestAnimationFrame(() => {
      const composer = document.getElementById(replyComposerId)
      composer?.scrollIntoView({ block: 'end' })
      composer?.querySelector('textarea')?.focus()
    })
  }, [focusReply, replyComposerId, thread])

  const focusComposer = () => {
    const composer = document.getElementById(replyComposerId)
    composer?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    composer?.querySelector('textarea')?.focus()
  }

  const publishComment = async (text: string) => {
    if (!session || !thread) return
    const subject = { uri: thread.post.uri, cid: thread.post.cid }
    const reply = { root: subject, parent: subject }
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
      replies: [...current.replies, { post }],
    } : current)
    clearCachedFeed(session.pds.did)
    onReplyCreated?.(thread.post.uri)
  }

  const submitComment = async (
    text: string,
    successMessage: string,
    failureMessage: string,
  ) => {
    setReplying(true)
    setReplyNotice('')
    try {
      await publishComment(text)
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
    if (await submitComment(replyText, '评论已发布。', '评论失败')) {
      setReplyText('')
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
              initial={authorInitial(thread.post.author)}
              name={authorDisplayName(thread.post.author)}
              timestamp={formatTimestamp(
                thread.post.record.createdAt || thread.post.indexedAt,
                true,
              )}
              profileActor={thread.post.author.did}
            />
            <p className="post-detail-copy">
              <PostText text={postDisplayText(thread.post.record.text, category)} />
            </p>
            <ImageGroup images={(thread.post.images ?? []).map((image) => ({ ...image, src: image.fullsize ?? image.src }))} />
            <div className="detail-actions">
              <PostActions
                post={thread.post}
                onOpenComments={focusComposer}
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
                <TextArea
                  label="写下评论"
                  value={replyText}
                  onChange={setReplyText}
                  rows={6}
                  maxLength={300}
                  width="100%"
                  placeholder="写下你的评论…"
                  hasAutoFocus={focusReply}
                />
                <div className="reply-composer-footer">
                  <span role="status">{replyNotice}</span>
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
              {thread.replies.length === 0 ? (
                <div className="empty-panel replies-empty">
                  <EmptyState title="还没有评论" description="成为第一个参与讨论的人。" />
                </div>
              ) : (
                <div className="reply-list">
                  {thread.replies.map((reply) => (
                    <article className="reply-row" key={reply.post.uri}>
                      <ContentCardHeader
                        initial={authorInitial(reply.post.author)}
                        name={authorDisplayName(reply.post.author)}
                        timestamp={formatTimestamp(
                          reply.post.record.createdAt || reply.post.indexedAt,
                          true,
                        )}
                        profileActor={reply.post.author.did}
                      />
                      <p><PostText text={reply.post.record.text} /></p>
                      <ImageGroup images={(reply.post.images ?? []).map((image) => ({ ...image, src: image.fullsize ?? image.src }))} />
                      <PostActions post={reply.post} onOpenComments={focusComposer} />
                    </article>
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
