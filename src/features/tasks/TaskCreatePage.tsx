import { TextArea } from '~/components/AutoTextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useRef, useState } from 'react'
import { ContactField } from '~/components/ContactField'
import { ImageGroup, ImagePicker } from '~/components/ContentImages'
import { PublishSchedule } from '~/components/PublishSchedule'
import { LoadingState } from '~/components/LoadingState'
import { PublishSteps } from '~/components/PublishSteps'
import { useRiceImages } from '../media/useRiceImages'
import { addMinutes, beijingTime, beijingTimeIso, nextTimeSlot, roundedTimeValue } from '~/lib/date-time'
import { useFormCloseState, type FormCloseState } from '~/lib/form-state'
import { integerInputError } from '~/lib/integer-input'
import type { CommunityNode } from '../nodes/api'
import type { RiceSession } from '~/lib/models'
import { createTask, getTask, getTasks, publishTask, updateTaskDraft } from './api'
import type { RiceTask } from './types'

export function TaskCreatePage({ session, nodes, initialDraft, initialError = '', onPublished, active, onCloseStateChange }: { session: RiceSession; nodes: CommunityNode[]; initialDraft?: RiceTask | null; initialError?: string; onPublished: (id: string) => void; active: boolean; onCloseStateChange: (state: FormCloseState) => void }) {
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [nodeId, setNodeId] = useState(initialDraft === undefined ? '' : initialDraft?.node?.id ?? nodes[0]?.id ?? '')
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [description, setDescription] = useState(initialDraft?.description ?? '')
  const [organizerContact, setOrganizerContact] = useState(initialDraft?.organizer_contact ?? '')
  const [requirement, setRequirement] = useState(initialDraft?.requirement ?? '')
  const [applicationDeadline, setApplicationDeadline] = useState(initialDraft?.application_deadline ? roundedTimeValue(initialDraft.application_deadline) : '')
  const [executionDeadline, setExecutionDeadline] = useState(initialDraft?.execution_deadline ? roundedTimeValue(initialDraft.execution_deadline) : '')
  const [rewardAmount, setRewardAmount] = useState(initialDraft ? String(initialDraft.reward_amount) : '')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(initialDraft?.id ?? null)
  const [draftLoading, setDraftLoading] = useState(initialDraft === undefined)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState<'draft' | 'open' | null>(null)
  const requestId = useRef('')
  const imageSelection = useRiceImages(initialDraft?.attachments ?? [])
  const markSaved = useFormCloseState(JSON.stringify([nodeId, title, description, organizerContact, requirement, applicationDeadline, executionDeadline, rewardAmount, imageSelection.images.map(image => image.src)]), !draftLoading, !!submitting, onCloseStateChange, () => submit('draft'))
  const restoreImages = imageSelection.restore
  useEffect(() => {
    if (initialDraft !== undefined) return
    let active = true; setDraftLoading(true)
    void getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } }).then(([draft]) => {
      if (!active) return
      setNodeId(draft?.node?.id ?? nodes[0]?.id ?? '')
      if (draft) { setEditingDraftId(draft.id); restoreImages(draft.attachments ?? []); setTitle(draft.title); setDescription(draft.description); setOrganizerContact(draft.organizer_contact ?? ''); setRequirement(draft.requirement ?? ''); setApplicationDeadline(draft.application_deadline ? roundedTimeValue(draft.application_deadline) : ''); setExecutionDeadline(draft.execution_deadline ? roundedTimeValue(draft.execution_deadline) : ''); setRewardAmount(String(draft.reward_amount)) }
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setDraftLoading(false) })
    return () => { active = false }
  }, [session.token, restoreImages, nodes, initialDraft])
  if (draftLoading) return <LoadingState label="正在恢复草稿…" />
  function validate(step: number, publishing = false): string | null {
    if (step === 0) {
      if (!nodeId || !title.trim()) return '请选择所属社区并填写任务标题。'
      if ((publishing && !organizerContact.trim()) || organizerContact.trim().length > 256) return '请填写组织方联系方式，最多 256 字。'
    }
    if (step === 1 && (!description.trim() || !requirement.trim())) return '请填写任务说明和交付要求。'
    if (step === 2 && ((applicationDeadline && !(beijingTime(applicationDeadline) > Date.now())) || (executionDeadline && !(beijingTime(executionDeadline) > Date.now())) || (applicationDeadline && executionDeadline && beijingTime(executionDeadline) <= beijingTime(applicationDeadline)))) return '申请截止应早于交付截止，日期应晚于当前时间。'
    if (step === 3) return integerInputError(rewardAmount, '任务报酬')
    return null
  }
  async function submit(status: 'draft' | 'open'): Promise<boolean> {
    if (submitting) return false
    if (!nodeId || !title.trim() || !description.trim() || !requirement.trim() || rewardAmount === '') { setError('请先填写任务标题、说明、交付要求和报酬，再保存草稿。'); return false }
    if ((status === 'open' && !organizerContact.trim()) || organizerContact.trim().length > 256) { setError('请填写组织方联系方式，最多 256 字。'); return false }
    const amountError = integerInputError(rewardAmount, '任务报酬')
    if (amountError) { setError(amountError); return false }
    const deadlineError = validate(2)
    if (deadlineError) { setError(deadlineError); return false }
    setSubmitting(status); setError(''); setNotice('')
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      const attachmentIds = await imageSelection.upload(session.token)
      const fields = { attachmentIds, token: session.token, title, description, organizerContact: organizerContact.trim(), nodeId, requirement, applicationDeadline: applicationDeadline ? beijingTimeIso(applicationDeadline) : null, executionDeadline: executionDeadline ? beijingTimeIso(executionDeadline) : null, rewardAmount: Number(rewardAmount || 0), clientRequestId: requestId.current }
      // Save first so a failed publish leaves a recoverable server draft.
      let draftId = editingDraftId
      if (!draftId) {
        const [saved] = await getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } })
        if (saved && saved.node?.id !== nodeId) throw new Error('已有另一社区的任务草稿。请重新打开发布页面后继续编辑。')
        draftId = saved?.id ?? null
      }
      let task = draftId ? await getTask({ data: { token: session.token, id: draftId } }) : null
      if (task?.status === 'open' && status === 'open') {
        const iso = (date?: string | null) => date ? new Date(date).toISOString() : null
        const published = [task.title, task.description, task.organizer_contact ?? '', task.requirement ?? '', task.reward_amount, iso(task.application_deadline), iso(task.execution_deadline), (task.attachments ?? []).map((image) => image.id)]
        const requested = [title, description, organizerContact.trim(), requirement, fields.rewardAmount, fields.applicationDeadline, fields.executionDeadline, attachmentIds]
        if (JSON.stringify(published) !== JSON.stringify(requested)) throw new Error('这项任务已发布，当前修改尚未保存。请离开发布页面后查看已发布的任务。')
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
  const amountError = rewardAmount === '' ? null : integerInputError(rewardAmount, '任务报酬')
  const disabled = !nodeId || !title.trim() || !description.trim() || !requirement.trim() || rewardAmount === '' || !!amountError || !!submitting
  const communityName = nodes.find(node => node.id === nodeId)?.name ?? '未选择'
  return <section className="form-card task-compose-form">
    <PublishSteps busy={!!submitting} error={error} notice={notice} onError={setError} validate={validate} canSaveDraft={!disabled} onSaveDraft={() => submit('draft')} onPublish={() => submit('open')} publishLabel="发布任务" steps={[
      {
        label: '基本信息', title: '你想一起做什么？',
        content: <>
          <label className="native-field">所属社区<select value={nodeId} disabled={!!editingDraftId || !!submitting} onChange={(e) => setNodeId(e.target.value)}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
          <TextInput isDisabled={!!submitting} label="任务标题" value={title} onChange={(v) => setTitle(v.slice(0, 128))} width="100%" isRequired />
          <ContactField organizer value={organizerContact} onChange={setOrganizerContact} disabled={!!submitting} />
        </>,
        review: <dl className="publish-review-fields"><div><dt>所属社区</dt><dd>{communityName}</dd></div><div><dt>任务标题</dt><dd>{title}</dd></div><div><dt>组织方联系方式</dt><dd>{organizerContact.trim() || '未填写'}</dd></div></dl>,
      },
      {
        label: '内容', title: '把这件事说清楚。',
        content: <>
          <TextArea isDisabled={!!submitting} label="任务说明" value={description} onChange={setDescription} maxLength={4000} width="100%" isRequired />
          <TextArea isDisabled={!!submitting} label="交付要求" value={requirement} onChange={setRequirement} maxLength={4000} width="100%" isRequired />
          <ImagePicker images={imageSelection.images} onSelect={imageSelection.select} onRemove={imageSelection.remove} disabled={!!submitting} />
        </>,
        review: <><dl className="publish-review-fields"><div><dt>任务说明</dt><dd className="publish-review-text">{description}</dd></div><div><dt>交付要求</dt><dd className="publish-review-text">{requirement}</dd></div><div><dt>参考图片</dt><dd>{imageSelection.images.length ? `${imageSelection.images.length} 张` : '未添加'}</dd></div></dl><ImageGroup images={imageSelection.images} /></>,
      },
      {
        label: '时间', title: '时间怎么安排？',
        content: <PublishSchedule disabled={!!submitting} fields={[
          { label: '申请截止', value: applicationDeadline, min: nextTimeSlot(), onChange: value => { setApplicationDeadline(value); if (value && executionDeadline && executionDeadline <= value) setExecutionDeadline(addMinutes(value, 15)); setError('') } },
          { label: '交付截止', value: executionDeadline, min: applicationDeadline ? addMinutes(applicationDeadline, 15) : nextTimeSlot(), onChange: value => { setExecutionDeadline(value); setError('') } },
        ]} />,
        review: <dl className="publish-review-fields"><div><dt>申请截止时间</dt><dd>{applicationDeadline ? `${applicationDeadline.replace('T', ' ')}（北京时间）` : '未设置'}</dd></div><div><dt>交付截止时间</dt><dd>{executionDeadline ? `${executionDeadline.replace('T', ' ')}（北京时间）` : '未设置'}</dd></div></dl>,
      },
      {
        label: '参与与稻米', title: '给多少稻米？',
        content: <TextInput isDisabled={!!submitting} label="任务报酬（社区测试稻米）" description="从所选社区账户支付，个人账户不扣款。" value={rewardAmount} onChange={v => { setRewardAmount(v); setError(''); setNotice('') }} status={amountError ? { type: 'error', message: amountError } : undefined} width="100%" isRequired />,
        review: <dl className="publish-review-fields"><div><dt>任务报酬</dt><dd>{rewardAmount} 社区测试稻米</dd></div><div><dt>支付账户</dt><dd>{communityName}社区账户；个人账户不扣款。</dd></div></dl>,
      },
    ]} />
  </section>
}
