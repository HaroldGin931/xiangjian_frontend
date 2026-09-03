import { Button } from '@astryxdesign/core/Button'
import { DateTimeInput, type ISODateTimeString } from '@astryxdesign/core/DateTimeInput'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { Selector } from '@astryxdesign/core/Selector'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
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
import { TaskCreatePage } from '~/features/tasks/TaskCreatePage'
import { localDateTimeValue } from '~/lib/format'

export const Route = createFileRoute('/compose')({
  validateSearch: (search: Record<string, unknown>) => ({
    kind: search.kind === 'task' ? 'task' as const : undefined,
  }),
  component: ComposePage,
})

type ComposeKind = PostKind | 'task'

const composeKinds: Array<{ value: ComposeKind; label: string }> = [
  { value: 'post', label: '帖子' },
  { value: 'activity', label: '活动' },
  { value: 'product', label: '商品' },
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
  const postKind = kind === 'task' ? null : kind
  const kindDetails = postKind ? POST_KINDS[postKind] : null
  const publishText = postKind ? withPostKind(text, postKind, fields) : ''
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
    if (!session || !kindDetails || !text.trim() || deadlineIsPast || publishLength > 300) return
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

      {kind === 'task' ? <TaskCreatePage embedded /> : kindDetails && postKind ? (
        <>
      <div className="compose-editor">
        <TextArea
          label="说点什么"
          isLabelHidden
          value={text}
          onChange={setText}
          rows={5}
          placeholder={kindDetails.placeholder}
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

      {kindDetails.fields.length ? (
        <section
          className="special-compose-form"
          aria-label={`${kindDetails.tag} 补充信息`}
        >
          <header>
            <strong>{postKind === 'activity' ? '活动信息' : '商品信息'}</strong>
            <span>随帖子公开</span>
          </header>
          {kindDetails.fields.map((field) => (
            field.type === 'select' ? (
              <Selector
                key={field.key}
                label={field.label}
                options={[...field.options]}
                value={fields[field.key] ?? ''}
                onChange={(value) => setField(field.key, value)}
                placeholder="选择状态"
                width="100%"
                isOptional
              />
            ) : field.type === 'datetime-local' ? (
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
            ) : field.type === 'number' ? (
              <NumberInput
                key={field.key}
                label={field.label}
                value={fields[field.key] ? Number(fields[field.key]) : null}
                onChange={(value) => setField(field.key, value === null ? '' : String(value))}
                placeholder={field.placeholder}
                min={0}
                step={0.01}
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

      <div className="compose-tools" aria-label="更多发布能力">
        <Button label="图片" icon={<Image size={18} aria-hidden="true" />} variant="secondary" size="sm" isDisabled tooltip="图片发布接口尚未接入" />
        <Button label="话题" icon={<span>#</span>} variant="secondary" size="sm" isDisabled tooltip="话题选择尚未接入" />
        <Button label="关联" icon={<Link2 size={18} aria-hidden="true" />} variant="secondary" size="sm" isDisabled tooltip="关联内容尚未接入" />
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
        isDisabled={!text.trim() || deadlineIsPast || publishLength > 300}
      />
        </>
      ) : null}
    </div>
  )
}
