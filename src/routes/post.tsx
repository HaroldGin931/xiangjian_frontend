import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { TextArea } from '@astryxdesign/core/TextArea'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PostActions } from '~/components/PostActions'
import { createReply, getPostThread } from '~/features/feed/api'
import { formatTimestamp } from '~/lib/format'
import type { PostThread } from '~/lib/models'
import { useStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/post')({
  validateSearch: (search: Record<string, unknown>) => ({
    uri: typeof search.uri === 'string' ? search.uri : '',
  }),
  component: PostPage,
})

function PostPage() {
  const { uri } = Route.useSearch()
  const { session, isReady } = useStoredSession()
  const fetchThread = useServerFn(getPostThread)
  const publishReply = useServerFn(createReply)
  const [thread, setThread] = useState<PostThread | null>(null)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyNotice, setReplyNotice] = useState('')
  const [isReplying, setReplying] = useState(false)

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

  const submitReply = async () => {
    if (!session || !thread || !replyText.trim()) return
    setReplying(true)
    setReplyNotice('')
    try {
      const result = await publishReply({
        data: {
          did: session.pds.did,
          accessJwt: session.pds.access_jwt,
          text: replyText,
          root: { uri: thread.post.uri, cid: thread.post.cid },
          parent: { uri: thread.post.uri, cid: thread.post.cid },
        },
      })
      setReplyText('')
      setReplyNotice('评论已发布，正在同步。')
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000))
        const next = await fetchThread({
          data: {
            uri,
            accessJwt: session.pds.access_jwt,
            did: session.pds.did,
          },
        })
        setThread(next)
        if (next.replies.some((reply) => reply.post.uri === result.uri)) {
          setReplyNotice('评论已发布。')
          return
        }
      }
      setReplyNotice('评论已经发布，稍后刷新即可看到。')
    } catch (reason) {
      setReplyNotice(reason instanceof Error ? reason.message : '评论失败')
    } finally {
      setReplying(false)
    }
  }

  if (isReady && !session) {
    return (
      <div className="page narrow-page">
        <div className="empty-panel account-empty">
          <EmptyState
            title="登录后查看帖子详情"
            description="登录后可以查看评论并参与互动。"
            actions={<Button label="前往登录" variant="primary" href="/login" />}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page post-page">
      <a href="/" className="back-link">
        <ArrowLeft size={19} aria-hidden="true" /> 返回广场
      </a>
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
            <p className="post-detail-copy">{thread.post.record.text}</p>
            <time className="post-detail-time">
              {formatTimestamp(
                thread.post.record.createdAt || thread.post.indexedAt,
                true,
              )}
            </time>
            <div className="detail-actions">
              <PostActions post={thread.post} />
            </div>
          </article>
          <section className="reply-section" id="reply">
            <h2>评论</h2>
            <div className="reply-composer">
              <TextArea
                label="写下评论"
                value={replyText}
                onChange={setReplyText}
                rows={4}
                maxLength={300}
                width="100%"
                placeholder="友善交流，共同建设"
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
                    <PostActions post={reply.post} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : !error ? (
        <div className="loading-line">正在加载帖子…</div>
      ) : null}
    </div>
  )
}
