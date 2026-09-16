import { ImageGroup } from '~/components/ContentImages'
import { attachmentImages } from '~/lib/attachments'
import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, Sprout } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { formatTimestamp } from '~/lib/format'

import { useStoredSession } from '../session/session'
import {
  applyForTask,
  appointTaskApplication,
  approveTaskResult,
  cancelTask,
  getTask,
  requestTaskChanges,
  submitTaskResult,
} from './api'
import {
  taskEventLabel,
  taskStatusLabel,
  type RiceTask,
  type TaskSubmission,
} from './types'

export function TaskDetailPage({ taskId, embedded = false }: { taskId: string; embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [task, setTask] = useState<RiceTask | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [appointmentReason, setAppointmentReason] = useState('')
  const [result, setResult] = useState('')
  const [reviewReason, setReviewReason] = useState('')

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError('')
    try {
      setTask(await getTask({ data: { id: taskId, token: session?.token } }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务暂时无法加载')
    } finally {
      setLoading(false)
    }
  }, [isReady, session?.token, taskId])

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
      window.dispatchEvent(new Event('rice-changed'))
      setApproveOpen(false)
      setApplyOpen(false)
      setCancelOpen(false)
      setReason('')
      setAppointmentReason('')
      setResult('')
      setReviewReason('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || loading) return <div className="page loading-line">正在加载任务…</div>
  if (!task) return <div className="page"><div className="inline-error">{error || '任务不存在'}</div></div>

  const actions = new Set(task.allowed_actions)
  const token = session?.token
  const visibleEvents = (task.events ?? []).filter((event) => event.to_status !== 'draft')

  return (
    <div className="page task-detail-page">
      {!embedded && <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> 任务</Link>}
      <article className="task-detail-card">
        <header className="task-detail-heading">
          <div>
            <span className={`task-status status-${task.status}`}>{taskStatusLabel[task.status]}</span>
            <h1>{task.title}</h1>
            <p>{task.node?.name} · {task.creator.nickname || task.creator.handle}发起</p>
          </div>

        </header>
        <section className="task-description">
          <h2>任务说明</h2>
          <p>{task.description}</p>
          <ImageGroup images={attachmentImages(task.attachments)} />
        </section>
        {task.requirement && <section className="task-description"><h2>交付要求</h2><p>{task.requirement}</p></section>}
        <section className="task-facts">
          <div><strong>{task.application_count}</strong><span>申请人数</span></div>
          <div><strong>{task.assignee?.nickname || task.assignee?.handle || '待任命'}</strong><span>承接者</span></div>
          <div><strong className="rice-amount" aria-label={`${task.reward_amount} 稻米`}><Sprout size={24} />{task.reward_amount}</strong><span>任务报酬</span></div>
        </section>

        {task.reward_status === 'settled' ? (
          <div className="task-success-note"><CheckCircle2 size={18} /> 任务奖励已发放给承接者</div>
        ) : null}
        {task.reward_status === 'refunded' ? (
          <div className="task-neutral-note">任务奖励已退回发布者可用余额。</div>
        ) : null}

        {task.application_deadline ? (
          <div className="task-neutral-note">申请截止：{formatTimestamp(task.application_deadline, true)}</div>
        ) : null}
        {task.execution_deadline && <div className="task-neutral-note">交付截止：{formatTimestamp(task.execution_deadline, true)}</div>}
        {task.overdue && <div className="task-warning-note"><CircleAlert size={18} /><div><strong>任务已逾期</strong><p>请与负责人 {task.creator.nickname || task.creator.handle} 联系，确认交付安排。</p><Link to="/profile/$actor" params={{ actor: task.creator.did }}>查看负责人主页</Link></div></div>}

        {task.status === 'completed' ? (
          <div className="task-success-note"><CheckCircle2 size={18} /> 结果已认可，任务完成</div>
        ) : null}
        {task.status === 'draft' ? <div className="task-neutral-note">草稿仅你可见，发布后才进入任务列表。</div> : null}
        {task.status === 'cancelled' ? <div className="task-neutral-note">该任务已由发布者取消。</div> : null}
        {task.status === 'expired' ? <div className="task-neutral-note">该任务已结束。</div> : null}
        {latestRejected && task.status === 'in_progress' ? <ChangesRequested submission={latestRejected} /> : null}
        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        {actions.has('publish') && token ? (
          <section className="task-action-section">
            <Link to="/tasks/new" className="primary-link">继续编辑</Link>
          </section>
        ) : null}

        {actions.has('apply') && token ? (
          <section className="task-action-section">
            {!applyOpen ? (
              <Button label="申请承接" variant="primary" onClick={() => setApplyOpen(true)} />
            ) : (
              <>
                <TextArea
                  label="申请理由"
                  value={reason}
                  onChange={setReason}
                  maxLength={512}
                  rows={5}
                  width="100%"
                  isOptional
                />
                <div className="button-row">
                  <Button label="取消" variant="secondary" onClick={() => setApplyOpen(false)} />
                  <Button
                    label="提交申请"
                    variant="primary"
                    isDisabled={busy}
                    clickAction={() => run(() => applyForTask({ data: { token, taskId, reason } }))}
                  />
                </div>
              </>
            )}
          </section>
        ) : null}

        {task.my_application_status === 'pending' ? (
          <div className="task-neutral-note">申请已提交，等待发布者审批。</div>
        ) : null}
        {task.my_application_status === 'not_selected' ? (
          <div className="task-neutral-note">本次申请未入选。</div>
        ) : null}
        {task.my_application_status === 'cancelled' ? (
          <div className="task-neutral-note">你申请过该任务；任务现已取消。</div>
        ) : null}
        {task.my_application_status === 'expired' ? (
          <div className="task-neutral-note">你申请过该任务；任务现已失效。</div>
        ) : null}

        {actions.has('appoint') && token ? (
          <section className="task-action-section">
            <h2>待审批申请</h2>
            <TextArea
              label="选人说明"
              value={appointmentReason}
              onChange={setAppointmentReason}
              maxLength={512}
              rows={3}
              width="100%"
              isOptional
            />
            <div className="applicant-list">
              {(task.applications ?? []).filter((item) => item.status === 'pending').map((application) => (
                <article key={application.id}>
                  <strong>{application.user.nickname || application.user.handle}</strong>
                  <p>{application.reason || '没有填写申请理由'}</p>
                  <Button
                    label="选定此人"
                    variant="primary"
                    isDisabled={busy}
                    clickAction={() => run(() => appointTaskApplication({
                      data: {
                        token,
                        taskId,
                        applicationId: application.id,
                        appointmentReason,
                      },
                    }))}
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {actions.has('cancel') && token ? (
          <section className="task-action-section">
            {!cancelOpen ? (
              <Button label="取消任务" variant="destructive" onClick={() => setCancelOpen(true)} />
            ) : (
              <>
                <div className="task-warning-note">
                  <CircleAlert size={18} />
                  <div><strong>确认取消这个任务？</strong><p>取消后任务保留记录，不能再申请；{task.reward_amount} 稻米报酬将退回。</p></div>
                </div>
                <div className="button-row">
                  <Button label="保留任务" variant="secondary" onClick={() => setCancelOpen(false)} />
                  <Button
                    label="确认取消"
                    variant="destructive"
                    isDisabled={busy}
                    clickAction={() => run(() => cancelTask({ data: { token, taskId } }))}
                  />
                </div>
              </>
            )}
          </section>
        ) : null}

        {actions.has('submit_result') && token ? (
          <section className="task-action-section">
            <h2>{latestRejected ? '修改并重新提交' : '提交完成'}</h2>
            <TextArea
              label="完成说明"
              value={result}
              onChange={setResult}
              maxLength={4000}
              rows={7}
              width="100%"
              isRequired
            />
            <Button
              label="提交结果"
              variant="primary"
              isDisabled={!result.trim() || busy}
              clickAction={() => run(() => submitTaskResult({ data: { token, taskId, body: result } }))}
            />
          </section>
        ) : null}

        {pendingSubmission && (actions.has('approve_result') || actions.has('request_changes')) && token ? (
          <section className="task-action-section review-section">
            <h2>承接者提交</h2>
            <p className="submission-copy">{pendingSubmission.body}</p>
            <TextArea
              label="退回理由"
              description="退回修改时必填"
              value={reviewReason}
              onChange={setReviewReason}
              maxLength={512}
              rows={4}
              width="100%"
            />
            <div className="button-row">
              <Button
                label="退回修改"
                variant="destructive"
                isDisabled={!reviewReason.trim() || busy}
                clickAction={() => run(() => requestTaskChanges({
                  data: { token, taskId, submissionId: pendingSubmission.id, reason: reviewReason },
                }))}
              />
              <Button label="验收并发放" variant="primary" isDisabled={busy} onClick={() => setApproveOpen(true)} />
            </div>
            {approveOpen && <section className="business-confirm"><h3>确认验收并发放</h3><p>向 {task.assignee?.nickname || task.assignee?.handle} 发放 {task.reward_amount} 稻米，任务将完成。</p><div className="button-row"><Button label="返回" variant="secondary" onClick={() => setApproveOpen(false)} /><Button label="确认验收并发放" variant="primary" isDisabled={busy} clickAction={() => run(() => approveTaskResult({ data: { token, taskId, submissionId: pendingSubmission.id } }))} /></div></section>}
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

        {visibleEvents.length ? (
          <details className="task-event-history">
            <summary>查看进展</summary>
            <ol>
              {visibleEvents.map((event) => (
                <li key={event.id}>
                  <strong>{taskEventLabel(event)}</strong>
                  <span>
                    {event.actor?.nickname || event.actor?.handle || '系统'}
                    {' · '}
                    <time>{formatTimestamp(event.inserted_at, true)}</time>
                  </span>
                  {event.detail ? <blockquote>{event.detail}</blockquote> : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </article>
    </div>
  )
}

function ChangesRequested({ submission }: { submission: TaskSubmission }) {
  return (
    <div className="task-warning-note">
      <CircleAlert size={18} />
      <div><strong>结果未被认可，可修改后重新提交</strong><p>{submission.review_reason}</p></div>
    </div>
  )
}

function submissionStatus(submission: TaskSubmission) {
  if (submission.status === 'approved') return '结果已认可'
  if (submission.status === 'changes_requested') return '结果未被认可'
  return '等待验收'
}
