import { Button } from '@astryxdesign/core/Button'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Image, Link2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  clearCachedFeed,
  createTextPost,
  getPosts,
  writeCachedFeed,
} from '~/features/feed/api'
import { useStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/compose')({ component: ComposePage })

function ComposePage() {
  const { session, isReady } = useStoredSession()
  const publish = useServerFn(createTextPost)
  const fetchPosts = useServerFn(getPosts)
  const navigate = useNavigate()
  const [kind, setKind] = useState<'post' | 'activity' | 'product'>('post')
  const [text, setText] = useState('')
  const [notice, setNotice] = useState('')
  const [isPublishing, setPublishing] = useState(false)

  useEffect(() => {
    if (isReady && !session) void navigate({ to: '/login' })
  }, [isReady, navigate, session])

  const submit = async () => {
    if (!session || !text.trim()) return
    setPublishing(true)
    setNotice('')
    try {
      const tag = kind === 'activity' ? '#活动' : kind === 'product' ? '#商品' : ''
      const result = await publish({
        data: {
          did: session.pds.did,
          accessJwt: session.pds.access_jwt,
          text: [text.trim(), tag].filter(Boolean).join('\n'),
        },
      })
      clearCachedFeed(session.pds.did)
      setNotice('发布成功，正在同步。')
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000))
        const feed = await fetchPosts({
          data: {
            accessJwt: session.pds.access_jwt,
            did: session.pds.did,
          },
        })
        if (feed.posts.some((post) => post.uri === result.uri)) {
          writeCachedFeed(feed, session.pds.did)
          break
        }
      }
      await navigate({ to: '/' })
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="page compose-page">
      <header className="compose-header">
        <Link to="/" className="back-link"><X size={18} aria-hidden="true" /> 取消</Link>
        <button type="button" className={kind === 'post' ? 'active' : ''} onClick={() => setKind('post')}>帖子</button>
        <button type="button" className={kind === 'activity' ? 'active' : ''} onClick={() => setKind('activity')}>活动 Tag</button>
        <button type="button" className={kind === 'product' ? 'active' : ''} onClick={() => setKind('product')}>商品 Tag</button>
        <button type="button" disabled>发布任务 →</button>
      </header>

      <div className="compose-editor">
        <label className="sr-only" htmlFor="compose-post-text">说点什么</label>
        <textarea
          id="compose-post-text"
          aria-describedby="compose-character-count"
          aria-invalid={text.length > 300 || undefined}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          rows={9}
          placeholder="说点什么…"
          autoFocus
        />
        <span
          id="compose-character-count"
          className={`compose-character-count ${text.length > 300 ? 'over-limit' : ''}`}
          aria-live="polite"
        >
          {text.length}/300
        </span>
      </div>

      <div className="compose-tools" aria-label="更多发布能力">
        <button type="button" disabled><Image size={18} aria-hidden="true" /> 图片</button>
        <button type="button" disabled># 话题</button>
        <button type="button" disabled><Link2 size={18} aria-hidden="true" /> 关联</button>
      </div>

      <div className="publish-target">
        <span>发布到</span>
        <strong>乡建社区 · 公开</strong>
      </div>
      {notice ? <div className="form-error">{notice}</div> : null}
      <Button
        label="发布内容"
        variant="primary"
        width="100%"
        clickAction={submit}
        isLoading={isPublishing}
        isDisabled={!text.trim() || text.length > 300}
      />
    </div>
  )
}
