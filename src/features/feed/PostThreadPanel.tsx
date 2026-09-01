import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useId, useState } from 'react'

import {
  PostActions,
  type RepostChange,
} from '~/components/PostActions'
import { formatTimestamp } from '~/lib/format'
import type { PostThread, PostView } from '~/lib/models'

import { useStoredSession } from '../session/session'
import { clearCachedFeed, createReply, getPostThread } from './api'
import {
  formatPostFieldValue,
  POST_KINDS,
  postDisplayText,
  postFieldValues,
  postKind,
} from './tags'

const ACTIVITY_REPLY = '参与活动'

export function PostThreadPanel({
  uri,
  focusReply = false,
  onRepostChange,
  onReplyCreated,
}: {
  uri: string
  focusReply?: boolean
  onRepostChange?: (change: RepostChange) => void
  onReplyCreated?: (postUri: string) => void
}) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const fetchThread = useServerFn(getPostThread)
  const publishReply = useServerFn(createReply)
  const [thread, setThread] = useState<PostThread | null>(null)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyNotice, setReplyNotice] = useState('')
  const [isReplying, setReplying] = useState(false)
  const replyComposerId = useId()
  const kind = thread ? postKind(thread.post.record.text) : 'post'
  const fields = thread ? postFieldValues(thread.post.record.text, kind) : {}
  const participants = thread?.replies.filter(
    (reply) => reply.post.record.text === ACTIVITY_REPLY,
  ) ?? []
  const hasParticipated = Boolean(
    session && participants.some((reply) => reply.post.author.did === session.pds.did),
  )
  const participationClosed = Boolean(
    fields.deadline && new Date(fields.deadline).getTime() <= Date.now(),
  )

  useEffect(() => {
    if (!uri || !session) return
    setError('')
    fetchThread({
      data: {
        uri,
        accessJwt: session.pds.access_jwt,
        did: session.pds.did,
      },
    })
      .then(setThread)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : '帖子暂时无法显示')
      })
  }, [fetchThread, session, uri])

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
    const result = await publishReply({
      data: {
        did: session.pds.did,
        accessJwt: session.pds.access_jwt,
        text,
        root: { uri: thread.post.uri, cid: thread.post.cid },
        parent: { uri: thread.post.uri, cid: thread.post.cid },
      },
    })
    const post: PostView = {
      uri: result.uri,
      cid: result.cid,
      indexedAt: result.createdAt,
      author: {
        did: session.pds.did,
        handle: session.pds.handle,
        displayName: session.user.nickname ?? undefined,
      },
      record: {
        text: result.text,
        createdAt: result.createdAt,
        langs: ['zh'],
        reply: {
          root: { uri: thread.post.uri, cid: thread.post.cid },
          parent: { uri: thread.post.uri, cid: thread.post.cid },
        },
      },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
    }
    setThread((current) => current ? {
      ...current,
      post: {
        ...current.post,
        replyCount: (current.post.replyCount ?? 0) + 1,
      },
      replies: [...current.replies, { post, replies: [] }],
    } : current)
    clearCachedFeed(session.pds.did)
    onReplyCreated?.(thread.post.uri)
  }

  const submitReply = async () => {
    if (!session || !thread || !replyText.trim()) return
    setReplying(true)
    setReplyNotice('')
    try {
      await publishComment(replyText)
      setReplyText('')
      setReplyNotice('评论已发布。')
    } catch (reason) {
      setReplyNotice(reason instanceof Error ? reason.message : '评论失败')
    } finally {
      setReplying(false)
    }
  }

  const participate = async () => {
    if (!session || !thread || hasParticipated || participationClosed) return
    setReplying(true)
    setReplyNotice('')
    try {
      await publishComment(ACTIVITY_REPLY)
      setReplyNotice('已参与活动。')
    } catch (reason) {
      setReplyNotice(reason instanceof Error ? reason.message : '参与失败')
    } finally {
      setReplying(false)
    }
  }

  if (isReady && !session) {
    return (
      <div className="account-empty">
        <EmptyState
          title="登录后查看帖子详情"
          description="登录后可以查看评论并参与互动。"
          actions={
            <Button
              label="前往登录"
              variant="primary"
              clickAction={() => { void navigate({ to: '/login' }) }}
            />
          }
        />
      </div>
    )
  }

  return (
    <div className="post-thread-panel">
      {error ? <div className="form-error">{error}</div> : null}
      {thread ? (
        <>
          <article className="post-detail-card">
            <div className="post-author">
              <span className="post-avatar" aria-hidden="true">
                {(thread.post.author.displayName || thread.post.author.handle)
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <div>
                <strong>
                  {thread.post.author.displayName ||
                    thread.post.author.handle.split('.')[0]}
                </strong>
                <div className="post-meta">{thread.post.author.handle}</div>
              </div>
            </div>
            <p className="post-detail-copy">
              {postDisplayText(thread.post.record.text)}
            </p>
            <time className="post-detail-time">
              {formatTimestamp(
                thread.post.record.createdAt || thread.post.indexedAt,
                true,
              )}
            </time>
            <div className="detail-actions">
              <PostActions
                post={thread.post}
                onOpenComments={focusComposer}
                onRepostChange={onRepostChange}
              />
            </div>
          </article>

          {kind === 'post' ? (
            <section className="reply-section" aria-label="评论">
              <div className="reply-composer" id={replyComposerId}>
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
              </div>

              <h2>评论 <span>{thread.replies.length}</span></h2>
              {thread.replies.length === 0 ? (
                <div className="empty-panel replies-empty">
                  <EmptyState title="还没有评论" description="成为第一个参与讨论的人。" />
                </div>
              ) : (
                <div className="reply-list">
                  {thread.replies.map((reply) => (
                    <article className="reply-row" key={reply.post.uri}>
                      <div className="post-author">
                        <span className="post-avatar" aria-hidden="true">
                          {(reply.post.author.displayName || reply.post.author.handle)
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {reply.post.author.displayName ||
                              reply.post.author.handle.split('.')[0]}
                          </strong>
                          <div className="post-meta">
                            {formatTimestamp(
                              reply.post.record.createdAt || reply.post.indexedAt,
                              true,
                            )}
                          </div>
                        </div>
                      </div>
                      <p>{reply.post.record.text}</p>
                      <PostActions post={reply.post} onOpenComments={focusComposer} />
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section
              className="special-post-details"
              aria-label={`${POST_KINDS[kind].tag} 信息`}
            >
              {POST_KINDS[kind].fields.map((field) => (
                <div key={field.key}>
                  <span>{field.label}</span>
                  <strong>{formatPostFieldValue(field.key, fields[field.key])}</strong>
                </div>
              ))}
              {kind === 'activity' ? (
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
