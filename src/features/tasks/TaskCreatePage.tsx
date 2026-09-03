import { Button } from '@astryxdesign/core/Button'
import { DateTimeInput, type ISODateTimeString } from '@astryxdesign/core/DateTimeInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useStoredSession } from '../session/session'
import { createTask, getTasks, publishTask, updateTaskDraft } from './api'

export function TaskCreatePage() {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [applicationDeadline, setApplicationDeadline] = useState('')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [draftLoading, setDraftLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState<'draft' | 'open' | null>(null)

  useEffect(() => {
    if (!isReady) return
    if (!session?.user.can_publish_tasks) {
      setDraftLoading(false)
      return
    }
    let active = true
    setDraftLoading(true)

    void getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } })
      .then(([draft]) => {
        if (!active || !draft) return
        setEditingDraftId(draft.id)
        setTitle(draft.title)
        setDescription(draft.description)
        setApplicationDeadline(toLocalDateTime(draft.application_deadline))
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '草稿暂时无法加载')
      })
      .finally(() => {
        if (active) setDraftLoading(false)
      })

    return () => {
      active = false
    }
  }, [isReady, session?.token, session?.user.can_publish_tasks])

  if (!isReady) {
    return <div className="page loading-line">正在恢复登录状态…</div>
  }

  if (!session) {
    return <LoginRequired />
  }

  if (!session.user.can_publish_tasks) {
    return (
      <div className="page narrow-page task-form-page">
        <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 返回任务</Link>
        <section className="task-empty-state">
          <strong>当前账号没有任务发布权限</strong>
          <p>任务发布者需要由管理员明确授权；普通用户仍可申请领取任务。</p>
        </section>
      </div>
    )
  }

  if (draftLoading) {
    return <div className="page loading-line">正在恢复草稿…</div>
  }

  const submit = async (status: 'draft' | 'open') => {
    setSubmitting(status)
    setError('')
    try {
      const deadline = applicationDeadline ? new Date(applicationDeadline).toISOString() : null
      let task

      if (editingDraftId) {
        task = await updateTaskDraft({
          data: {
            token: session.token,
            taskId: editingDraftId,
            title,
            description,
            applicationDeadline: deadline,
          },
        })
        if (status === 'open') {
          task = await publishTask({ data: { token: session.token, taskId: task.id } })
        }
      } else {
        task = await createTask({
          data: {
            token: session.token,
            title,
            description,
            status,
            applicationDeadline: deadline ?? undefined,
          },
        })
      }
      await navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务保存失败')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="page narrow-page task-form-page">
      <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 取消</Link>
      <section className="page-intro">
        <div className="eyebrow">发布后直接进入可领取</div>
        <h1>发布任务</h1>
        <p>这一版只记录任务内容。奖励和节点稻米池暂不接入。</p>
      </section>
      <section className="form-card">
        {editingDraftId ? <div className="form-notice">正在编辑已保存的草稿</div> : null}
        <TextInput
          label="任务标题"
          value={title}
          onChange={(value) => setTitle(value.slice(0, 128))}
          width="100%"
          isRequired
        />
        <TextArea
          label="任务说明与预期成果"
          value={description}
          onChange={setDescription}
          maxLength={4000}
          rows={8}
          width="100%"
          isRequired
        />
        <DateTimeInput
          label="领取截止"
          value={applicationDeadline ? applicationDeadline as ISODateTimeString : undefined}
          onChange={(value) => setApplicationDeadline(value ?? '')}
          hourFormat="24h"
          timeOptionInterval={15}
          width="100%"
          isOptional
          hasClear
        />
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="button-row">
          <Button
            label={editingDraftId ? '更新草稿' : '存为草稿'}
            variant="secondary"
            clickAction={() => submit('draft')}
            isLoading={submitting === 'draft'}
            isDisabled={!title.trim() || !description.trim() || submitting === 'open'}
          />
          <Button
            label="发布任务"
            variant="primary"
            clickAction={() => submit('open')}
            isLoading={submitting === 'open'}
            isDisabled={!title.trim() || !description.trim() || submitting === 'draft'}
          />
        </div>
      </section>
    </div>
  )
}

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function LoginRequired() {
  return (
    <div className="page signed-out-state">
      <strong>登录后才能发布任务</strong>
      <Link to="/login" className="primary-link">前往登录</Link>
    </div>
  )
}
