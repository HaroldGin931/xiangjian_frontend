import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useStoredSession } from '../session/session'
import { createTask } from './api'

export function TaskCreatePage() {
  const { session } = useStoredSession()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const task = await createTask({ data: { token: session.token, title, description } })
      await navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务发布失败')
    } finally {
      setSubmitting(false)
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
        <label className="field-label">
          <span>任务标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={128} />
        </label>
        <label className="field-label">
          <span>任务说明与预期成果</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            rows={8}
          />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button
          type="button"
          className="primary-button"
          disabled={!title.trim() || !description.trim() || submitting}
          onClick={submit}
        >
          {submitting ? '正在发布…' : '发布任务'}
        </button>
      </section>
    </div>
  )
}

function LoginRequired() {
  return (
    <div className="page signed-out-state">
      <strong>登录后才能发布任务</strong>
      <Link to="/login" className="primary-link">前往登录</Link>
    </div>
  )
}
