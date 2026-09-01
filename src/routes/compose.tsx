import { Button } from '@astryxdesign/core/Button'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Image, Link2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  createTextPost,
  createdPostView,
  getPosts,
  prependCachedPost,
  readCachedFeed,
  writeCachedFeed,
} from '~/features/feed/api'
import { POST_KINDS, type PostKind, withPostKind } from '~/features/feed/tags'
import { useStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/compose')({ component: ComposePage })

function ComposePage() {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [kind, setKind] = useState<PostKind>('post')
  const [text, setText] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [isPublishing, setPublishing] = useState(false)
  const kindDetails = POST_KINDS[kind]
  const publishText = withPostKind(text, kind, fields)
  const publishLength = text.trim() ? publishText.length : 0
  const fieldsComplete = kindDetails.fields.every((field) => fields[field.key]?.trim())
  const setField = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (isReady && !session) void navigate({ to: '/login' })
  }, [isReady, navigate, session])

  const submit = async () => {
    if (!session || !text.trim() || !fieldsComplete || publishLength > 300) return
    setPublishing(true)
    setNotice('')
    try {
      const cachedFeed = readCachedFeed(session.pds.did)
      const feedPromise = cachedFeed
        ? Promise.resolve(cachedFeed)
        : getPosts({
            data: {
              accessJwt: session.pds.access_jwt,
              did: session.pds.did,
            },
          }).catch(() => null)
      const result = await createTextPost({
        data: {
          did: session.pds.did,
          accessJwt: session.pds.access_jwt,
          text: publishText,
        },
      })
      const feed = await feedPromise
      if (feed) writeCachedFeed(feed, session.pds.did)
      prependCachedPost(createdPostView(result, session), session.pds.did)
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
          aria-invalid={publishLength > 300 || undefined}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          rows={9}
          placeholder={kindDetails.placeholder}
          autoFocus
        />
        <span
          id="compose-character-count"
          className={`compose-character-count ${publishLength > 300 ? 'over-limit' : ''}`}
          aria-live="polite"
        >
          {publishLength}/300
        </span>
      </div>

      {kindDetails.fields.length ? (
        <section
          className="special-compose-form"
          aria-label={`${kindDetails.tag} 补充信息`}
        >
          <header>
            <strong>{kind === 'activity' ? '活动信息' : '商品信息'}</strong>
            <span>随帖子公开</span>
          </header>
          {kindDetails.fields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select
                  value={fields[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.currentTarget.value)}
                  required
                >
                  <option value="">选择状态</option>
                  {field.options.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  inputMode={field.type === 'number' ? 'decimal' : undefined}
                  min={field.type === 'number' ? '0' : undefined}
                  value={fields[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onInput={(event) => setField(field.key, event.currentTarget.value)}
                  required
                />
              )}
            </label>
          ))}
        </section>
      ) : null}

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
        label={kindDetails.publishLabel}
        variant="primary"
        width="100%"
        clickAction={submit}
        isLoading={isPublishing}
        isDisabled={!text.trim() || !fieldsComplete || publishLength > 300}
      />
    </div>
  )
}
