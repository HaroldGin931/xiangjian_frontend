import { Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { formatTimestamp } from '~/lib/format'

import { useStoredSession } from '../session/session'
import {
  applyForTask,
  appointTaskApplication,
  approveTaskResult,
  getTask,
  requestTaskChanges,
  submitTaskResult,
} from './api'
import { taskStatusLabel, type RiceTask, type TaskSubmission } from './types'

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const { session } = useStoredSession()
  const [task, setTask] = useState<RiceTask | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState('')
  const [reviewReason, setReviewReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTask(await getTask({ data: { id: taskId, token: session?.token } }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务暂时无法加载')
    } finally {
      setLoading(false)
    }
  }, [session?.token, taskId])

  useEffect(() => {
    void load()
  }, [load])

  const pendingSubmission = useMemo(
    () => task?.submissions?.find((submission) => submission.status === 'pending') ?? null,
    [task],
  )
  const latestRejected = useMemo(
    () => [...(task?.submissions ?? [])].reverse().find((item) => item.status === 'changes_requested'),
    [task],
  )

  const run = async (action: () => Promise<RiceTask>) => {
    setBusy(true)
    setError('')
    try {
      const next = await action()
      setTask(next)
      setApplyOpen(false)
      setReason('')
      setResult('')
      setReviewReason('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page loading-line">正在加载任务…</div>
  if (!task) return <div className="page"><div className="inline-error">{error || '任务不存在'}</div></div>

  const actions = new Set(task.allowed_actions)
  const token = session?.token

  return (
    <div className="page task-detail-page">
      <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 任务</Link>
      <article className="task-detail-card">
        <header className="task-detail-heading">
          <div>
            <span className={`task-status status-${task.status}`}>{taskStatusLabel[task.status]}</span>
            <h1>{task.title}</h1>
            <p>{task.creator.nickname || task.creator.handle} · {formatTimestamp(task.inserted_at)}</p>
          </div>
          <div className="task-owner-mark"><UserRound size={22} /></div>
        </header>
        <section className="task-description">
          <h2>任务说明与预期成果</h2>
          <p>{task.description}</p>
        </section>
        <section className="task-facts">
          <div><strong>{task.application_count}</strong><span>申请人数</span></div>
          <div><strong>{task.assignee?.nickname || task.assignee?.handle || '待任命'}</strong><span>承作人</span></div>
        </section>

        {task.status === 'completed' ? (
          <div className="task-success-note"><CheckCircle2 size={18} /> 结果已认可，任务完成</div>
        ) : null}
        {latestRejected && task.status === 'in_progress' ? <ChangesRequested submission={latestRejected} /> : null}
        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        {!session && task.status === 'open' ? (
          <Link to="/login" className="primary-link">登录后申请领取</Link>
        ) : null}

        {actions.has('apply') && token ? (
          <section className="task-action-section">
            {!applyOpen ? (
              <button type="button" className="primary-button" onClick={() => setApplyOpen(true)}>
                申请领取
              </button>
            ) : (
              <>
                <label className="field-label">
                  <span>申请理由（选填）</span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={512} rows={5} />
                </label>
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => setApplyOpen(false)}>取消</button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy}
                    onClick={() => run(() => applyForTask({ data: { token, taskId, reason } }))}
                  >提交申请</button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {task.my_application_status === 'pending' ? (
          <div className="task-neutral-note">申请已提交，等待发布者任命。</div>
        ) : null}
        {task.my_application_status === 'not_selected' ? (
          <div className="task-neutral-note">本次申请未入选。</div>
        ) : null}

        {actions.has('appoint') && token ? (
          <section className="task-action-section">
            <h2>申请人</h2>
            <div className="applicant-list">
              {(task.applications ?? []).filter((item) => item.status === 'pending').map((application) => (
                <article key={application.id}>
                  <strong>{application.user.nickname || application.user.handle}</strong>
                  <p>{application.reason || '没有填写申请理由'}</p>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy}
                    onClick={() => run(() => appointTaskApplication({
                      data: { token, taskId, applicationId: application.id },
                    }))}
                  >确认任命</button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {actions.has('submit_result') && token ? (
          <section className="task-action-section">
            <h2>{latestRejected ? '修改并重新提交' : '提交完成'}</h2>
            <label className="field-label">
              <span>完成说明</span>
              <textarea value={result} onChange={(event) => setResult(event.target.value)} maxLength={4000} rows={7} />
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!result.trim() || busy}
              onClick={() => run(() => submitTaskResult({ data: { token, taskId, body: result } }))}
            >提交结果</button>
          </section>
        ) : null}

        {pendingSubmission && (actions.has('approve_result') || actions.has('request_changes')) && token ? (
          <section className="task-action-section review-section">
            <h2>承作人提交</h2>
            <p className="submission-copy">{pendingSubmission.body}</p>
            <label className="field-label">
              <span>驳回留言（驳回时必填）</span>
              <textarea
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                maxLength={512}
                rows={4}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="danger-button"
                disabled={!reviewReason.trim() || busy}
                onClick={() => run(() => requestTaskChanges({
                  data: { token, taskId, submissionId: pendingSubmission.id, reason: reviewReason },
                }))}
              >驳回并留言</button>
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => run(() => approveTaskResult({
                  data: { token, taskId, submissionId: pendingSubmission.id },
                }))}
              >审核通过</button>
            </div>
          </section>
        ) : null}

        {task.submissions?.length ? (
          <section className="task-history">
            <h2>提交历史</h2>
            {[...task.submissions].reverse().map((submission) => (
              <article key={submission.id}>
                <header><strong>{submissionStatus(submission)}</strong><time>{formatTimestamp(submission.inserted_at)}</time></header>
                <p>{submission.body}</p>
                {submission.review_reason ? <blockquote>{submission.review_reason}</blockquote> : null}
              </article>
            ))}
          </section>
        ) : null}
      </article>
    </div>
  )
}

function ChangesRequested({ submission }: { submission: TaskSubmission }) {
  return (
    <div className="task-warning-note">
      <CircleAlert size={18} />
      <div><strong>审核未通过，可修改后重新提交</strong><p>{submission.review_reason}</p></div>
    </div>
  )
}

function submissionStatus(submission: TaskSubmission) {
  if (submission.status === 'approved') return '结果已认可'
  if (submission.status === 'changes_requested') return '审核未通过'
  return '等待审核'
}
