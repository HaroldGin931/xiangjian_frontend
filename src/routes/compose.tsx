import { Button } from '@astryxdesign/core/Button'
import { DateTimeInput, type ISODateTimeString } from '@astryxdesign/core/DateTimeInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  createTextPost,
  createdPostView,
  getPosts,
  prependCachedPost,
  readCachedFeed,
  writeCachedFeed,
} from '~/features/feed/api'
import { POST_CATEGORIES, withPostCategory } from '~/features/feed/tags'
import { useStoredSession } from '~/features/session/session'
import { TaskCreatePage } from '~/features/tasks/TaskCreatePage'
import { localDateTimeValue } from '~/lib/format'
import type { PostCategory } from '~/lib/models'

export const Route = createFileRoute('/compose')({
  validateSearch: (search: Record<string, unknown>) => ({
    kind: search.kind === 'task' ? 'task' as const : undefined,
  }),
  component: ComposePage,
})

type ComposeKind = Exclude<PostCategory, 'product'> | 'task'

const composeKinds: Array<{ value: ComposeKind; label: string }> = [
  { value: 'post', label: '帖子' },
  { value: 'activity', label: '活动' },
  { value: 'task', label: '任务' },
]

function ComposePage() {
  const { kind: requestedKind } = Route.useSearch()
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [kind, setKind] = useState<ComposeKind>(requestedKind ?? 'post')
  const [text, setText] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [isPublishing, setPublishing] = useState(false)
  const postCategory = kind === 'task' ? null : kind
  const categoryDetails = postCategory ? POST_CATEGORIES[postCategory] : null
  const publishText = postCategory ? withPostCategory(text, postCategory, fields) : ''
  const publishLength = text.trim() ? publishText.length : 0
  const minDateTime = localDateTimeValue()
  const deadlineIsPast = Boolean(fields.deadline && fields.deadline < minDateTime)
  const setField = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (isReady && !session) void navigate({ to: '/login' })
  }, [isReady, navigate, session])

  const submit = async () => {
    if (!session || !categoryDetails || !postCategory || !text.trim() || deadlineIsPast || publishLength > 300) return
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
          category: postCategory,
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
        <Link to={requestedKind === 'task' ? '/tasks' : '/'} className="back-link">
          <X size={18} aria-hidden="true" /> 取消
        </Link>
        <div className="compose-type-tabs filter-buttons" role="group" aria-label="发布类型">
          {composeKinds.map((item) => (
            <Button
              label={item.label}
              variant="ghost"
              size="sm"
              className={kind === item.value ? 'active' : undefined}
              aria-pressed={kind === item.value}
              onClick={() => setKind(item.value)}
              key={item.value}
            />
          ))}
        </div>
      </header>

      {kind === 'task' ? <TaskCreatePage embedded /> : categoryDetails && postCategory ? (
        <>
      <div className="compose-editor">
        <TextArea
          label="说点什么"
          isLabelHidden
          value={text}
          onChange={setText}
          rows={5}
          placeholder={categoryDetails.placeholder}
          width="100%"
          size="lg"
          hasAutoFocus
          status={publishLength > 300 ? { type: 'error', message: '内容和附加信息合计不能超过 300 字。' } : undefined}
        />
        <span
          id="compose-character-count"
          className={`compose-character-count ${publishLength > 300 ? 'over-limit' : ''}`}
          aria-live="polite"
        >
          {publishLength}/300
        </span>
      </div>

      {categoryDetails.fields.length ? (
        <section
          className="special-compose-form"
          aria-label={`${categoryDetails.label}补充信息`}
        >
          <header>
            <strong>活动信息</strong>
            <span>随帖子公开</span>
          </header>
          {categoryDetails.fields.map((field) => (
            field.type === 'datetime-local' ? (
              <DateTimeInput
                key={field.key}
                label={field.label}
                timeLabel="时间"
                value={fields[field.key] ? fields[field.key] as ISODateTimeString : undefined}
                onChange={(value) => setField(field.key, value ?? '')}
                hourFormat="24h"
                timeOptionInterval={15}
                min={minDateTime as ISODateTimeString}
                width="100%"
                isOptional
                hasClear
              />
            ) : (
              <TextInput
                key={field.key}
                label={field.label}
                value={fields[field.key] ?? ''}
                onChange={(value) => setField(field.key, value)}
                placeholder={field.placeholder}
                width="100%"
                isOptional
              />
            )
          ))}
        </section>
      ) : null}

      <div className="publish-target">
        <span>发布到</span>
        <strong>乡建社区 · 公开</strong>
      </div>
      {notice ? <div className="form-error">{notice}</div> : null}
      <Button
        label={categoryDetails.publishLabel}
        variant="primary"
        width="100%"
        clickAction={submit}
        isLoading={isPublishing}
        isDisabled={!text.trim() || deadlineIsPast || publishLength > 300}
      />
        </>
      ) : null}
    </div>
  )
}
