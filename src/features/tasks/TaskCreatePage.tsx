import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useRef, useState } from 'react'
import { ImagePicker } from '~/components/ContentImages'
import { DateTimeField } from '~/components/DateTimeField'
import { usePanelReady } from '~/components/DetailDialog'
import { useRiceImages } from '../media/useRiceImages'
import { addMinutes, beijingTime, beijingTimeIso, nextTimeSlot, roundedTimeValue } from '~/lib/date-time'
import { useFormCloseState, type FormCloseState } from '~/lib/form-state'
import type { CommunityNode } from '../nodes/api'
import type { RiceSession } from '~/lib/models'
import { createTask, getTask, getTasks, publishTask, updateTaskDraft } from './api'

export function TaskCreatePage({ session, nodes, onPublished, active, onCloseStateChange }: { session: RiceSession; nodes: CommunityNode[]; onPublished: (id: string) => void; active: boolean; onCloseStateChange: (state: FormCloseState) => void }) {
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [nodeId, setNodeId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requirement, setRequirement] = useState('')
  const [applicationDeadline, setApplicationDeadline] = useState('')
  const [executionDeadline, setExecutionDeadline] = useState('')
  const [rewardAmount, setRewardAmount] = useState('')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [draftLoading, setDraftLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState<'draft' | 'open' | null>(null)
  usePanelReady(!active || !draftLoading)
  const requestId = useRef('')
  const imageSelection = useRiceImages()
  const markSaved = useFormCloseState(JSON.stringify([nodeId, title, description, requirement, applicationDeadline, executionDeadline, rewardAmount, imageSelection.images.map(image => image.src)]), !draftLoading, !!submitting, onCloseStateChange, () => submit('draft'))
  const restoreImages = imageSelection.restore
  useEffect(() => {
    let active = true; setDraftLoading(true)
    void getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } }).then(([draft]) => {
      if (!active) return
      setNodeId(draft?.node?.id ?? nodes[0]?.id ?? '')
      if (draft) { setEditingDraftId(draft.id); restoreImages(draft.attachments ?? []); setTitle(draft.title); setDescription(draft.description); setRequirement(draft.requirement ?? ''); setApplicationDeadline(draft.application_deadline ? roundedTimeValue(draft.application_deadline) : ''); setExecutionDeadline(draft.execution_deadline ? roundedTimeValue(draft.execution_deadline) : ''); setRewardAmount(String(draft.reward_amount)) }
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setDraftLoading(false) })
    return () => { active = false }
  }, [session.token, restoreImages, nodes])
  if (draftLoading) return <p className="loading-line">正在恢复草稿…</p>
  async function submit(status: 'draft' | 'open'): Promise<boolean> {
    if (submitting) return false
    if (!nodeId || !title.trim() || !description.trim() || !requirement.trim() || rewardAmount === '') { setError('请先填写任务标题、说明、交付要求和报酬，再保存草稿。'); return false }
    if ((applicationDeadline && !(beijingTime(applicationDeadline) > Date.now())) || (executionDeadline && !(beijingTime(executionDeadline) > Date.now())) || (applicationDeadline && executionDeadline && beijingTime(executionDeadline) <= beijingTime(applicationDeadline))) { setError('申请截止应早于交付截止，日期应晚于当前时间。'); return false }
    setSubmitting(status); setError(''); setNotice('')
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      const attachmentIds = await imageSelection.upload(session.token)
      const fields = { attachmentIds, token: session.token, title, description, nodeId, requirement, applicationDeadline: applicationDeadline ? beijingTimeIso(applicationDeadline) : null, executionDeadline: executionDeadline ? beijingTimeIso(executionDeadline) : null, rewardAmount: Number(rewardAmount || 0), clientRequestId: requestId.current }
      // Save first so a failed publish leaves a recoverable server draft.
      let draftId = editingDraftId
      if (!draftId) {
        const [saved] = await getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } })
        if (saved && saved.node?.id !== nodeId) throw new Error('已有另一社区的任务草稿。请重新打开发布窗口后继续编辑。')
        draftId = saved?.id ?? null
      }
      let task = draftId ? await getTask({ data: { token: session.token, id: draftId } }) : null
      if (task?.status === 'open' && status === 'open') {
        const iso = (date?: string | null) => date ? new Date(date).toISOString() : null
        const published = [task.title, task.description, task.requirement ?? '', task.reward_amount, iso(task.application_deadline), iso(task.execution_deadline), (task.attachments ?? []).map((image) => image.id)]
        const requested = [title, description, requirement, fields.rewardAmount, fields.applicationDeadline, fields.executionDeadline, attachmentIds]
        if (JSON.stringify(published) !== JSON.stringify(requested)) throw new Error('这项任务已发布，当前修改尚未保存。请关闭发布窗口后查看已发布的任务。')
      } else {
        task = draftId
          ? await updateTaskDraft({ data: { ...fields, taskId: draftId } })
          : await createTask({ data: { ...fields, status: 'draft', applicationDeadline: fields.applicationDeadline ?? undefined } })
        setEditingDraftId(task.id)
        if (status === 'open') task = await publishTask({ data: { token: session.token, taskId: task.id } })
      }
      if (!mounted.current) return false
      setEditingDraftId(task.id)
      markSaved()
      if (status === 'draft') { setNotice('草稿已保存'); return true }
      window.dispatchEvent(new Event('rice-changed'))
      onPublished(task.id)
      return true
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '任务保存失败'); return false } finally { if (mounted.current) setSubmitting(null) }
  }
  const disabled = !nodeId || !title.trim() || !description.trim() || !requirement.trim() || rewardAmount === '' || !!submitting
  return <section className="form-card task-compose-form">
    <label className="native-field">所属社区<select value={nodeId} disabled={!!editingDraftId || !!submitting} onChange={(e) => setNodeId(e.target.value)}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    <TextInput isDisabled={!!submitting} label="任务标题" value={title} onChange={(v) => setTitle(v.slice(0, 128))} width="100%" isRequired />
    <TextArea isDisabled={!!submitting} label="任务说明" value={description} onChange={setDescription} maxLength={4000} rows={4} width="100%" isRequired />
    <ImagePicker images={imageSelection.images} onSelect={imageSelection.select} onRemove={imageSelection.remove} disabled={!!submitting} />
    <TextArea isDisabled={!!submitting} label="交付要求" value={requirement} onChange={setRequirement} maxLength={4000} rows={3} width="100%" isRequired />
    <DateTimeField label="申请截止时间" value={applicationDeadline} min={nextTimeSlot()} disabled={!!submitting} onChange={value => { setApplicationDeadline(value); if (value && executionDeadline && executionDeadline <= value) setExecutionDeadline(addMinutes(value, 15)); setError('') }} />
    <DateTimeField label="交付截止时间" value={executionDeadline} min={applicationDeadline ? addMinutes(applicationDeadline, 15) : nextTimeSlot()} disabled={!!submitting} onChange={value => { setExecutionDeadline(value); setError('') }} />
    <TextInput isDisabled={!!submitting} label="任务报酬（测试稻米）" value={rewardAmount} onChange={(v) => setRewardAmount(v.replace(/\D/g, '').slice(0, 9))} width="100%" isRequired />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
    <div className="form-actions"><Button label="保存草稿" variant="secondary" isDisabled={disabled} isLoading={submitting === 'draft'} clickAction={async () => { await submit('draft') }} /><Button label="发布任务" variant="primary" isDisabled={disabled} isLoading={submitting === 'open'} clickAction={async () => { await submit('open') }} /></div>
  </section>
}
