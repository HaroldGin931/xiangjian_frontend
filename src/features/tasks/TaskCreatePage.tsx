import { Button } from '@astryxdesign/core/Button'
import { DateTimeInput, type ISODateTimeString } from '@astryxdesign/core/DateTimeInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { localDateTimeValue } from '~/lib/format'

import { useStoredSession } from '../session/session'
import { createTask, getTasks, publishTask, updateTaskDraft } from './api'

export function TaskCreatePage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [applicationDeadline, setApplicationDeadline] = useState('')
  const [rewardAmount, setRewardAmount] = useState('')
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
        setRewardAmount(String(draft.reward_amount))
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
    const unavailable = (
      <section className="task-empty-state">
        <strong>当前账号没有任务发布权限</strong>
        <p>任务发布者需要由管理员明确授权；普通用户仍可申请领取任务。</p>
      </section>
    )
    return embedded ? unavailable : (
      <div className="page narrow-page task-form-page">
        <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 返回任务</Link>
        {unavailable}
      </div>
    )
  }

  if (draftLoading) {
    return <div className="page loading-line">正在恢复草稿…</div>
  }

  const submit = async (status: 'draft' | 'open') => {
    if (applicationDeadline && applicationDeadline < localDateTimeValue()) {
      setError('截止日期不能早于当前时间')
      return
    }
    setSubmitting(status)
    setError('')
    try {
      const deadline = applicationDeadline ? new Date(applicationDeadline).toISOString() : null
      const reward = Number(rewardAmount || 0)
      let task

      if (editingDraftId) {
        task = await updateTaskDraft({
          data: {
            token: session.token,
            taskId: editingDraftId,
            title,
            description,
            applicationDeadline: deadline,
            rewardAmount: reward,
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
            rewardAmount: reward,
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

  const form = (
    <section className={`form-card ${embedded ? 'task-compose-form' : ''}`}>
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
        rows={4}
        width="100%"
        isRequired
      />
      <DateTimeInput
        label="截止日期"
        timeLabel="截止时间"
        description="可选，只能选择当前时间之后"
        value={applicationDeadline ? applicationDeadline as ISODateTimeString : undefined}
        onChange={(value) => setApplicationDeadline(value ?? '')}
        hourFormat="24h"
        timeOptionInterval={15}
        min={localDateTimeValue() as ISODateTimeString}
        width="100%"
        isOptional
        hasClear
      />
      <TextInput
        label="任务奖励（稻米）"
        description="0 稻米不冻结；大于 0 时，发布后从可用余额中冻结。"
        value={rewardAmount}
        onChange={(value) => setRewardAmount(value.replace(/\D/g, '').slice(0, 9))}
        placeholder="请输入 0 或正整数"
        width="100%"
        isRequired
      />
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="button-row">
        <Button
          label={editingDraftId ? '更新草稿' : '存为草稿'}
          variant="secondary"
          clickAction={() => submit('draft')}
          isLoading={submitting === 'draft'}
          isDisabled={!title.trim() || !description.trim() || Boolean(applicationDeadline && applicationDeadline < localDateTimeValue()) || submitting === 'open'}
        />
        <Button
          label="发布任务"
          variant="primary"
          clickAction={() => submit('open')}
          isLoading={submitting === 'open'}
          isDisabled={!title.trim() || !description.trim() || rewardAmount === '' || Boolean(applicationDeadline && applicationDeadline < localDateTimeValue()) || submitting === 'draft'}
        />
      </div>
    </section>
  )

  if (embedded) return form

  return (
    <div className="page narrow-page task-form-page">
      <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 取消</Link>
      <section className="page-intro">
        <div className="eyebrow">发布后直接进入可领取</div>
        <h1>发布任务</h1>
        <p>发布时冻结任务奖励；完成后发给承作人，取消或失效时自动退回。</p>
      </section>
      {form}
    </div>
  )
}

function toLocalDateTime(value: string | null) {
  return value ? localDateTimeValue(value) : ''
}

function LoginRequired() {
  return (
    <div className="page signed-out-state">
      <strong>登录后才能发布任务</strong>
      <Link to="/login" className="primary-link">前往登录</Link>
    </div>
  )
}
