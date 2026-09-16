import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ImagePicker } from '~/components/ContentImages'
import { usePanelReady } from '~/components/DetailDialog'
import { RICE_IMAGE_MAX_BYTES, useRiceImages } from '../media/useRiceImages'
import { localDateTimeValue } from '~/lib/format'
import { getNodes, type CommunityNode } from '../nodes/api'
import { useStoredSession } from '../session/session'
import { createTask, getTask, getTasks, publishTask, updateTaskDraft } from './api'

export function TaskCreatePage({ embedded = false, onPublished, active = true, managedNodes }: { embedded?: boolean; onPublished?: () => void; active?: boolean; managedNodes?: CommunityNode[] }) {
  const { session } = useStoredSession()
  return <TaskCreateForm key={session?.token ?? 'guest'} embedded={embedded} active={active} onPublished={onPublished} managedNodes={managedNodes} />
}

function TaskCreateForm({ embedded, onPublished, active, managedNodes }: { embedded: boolean; onPublished?: () => void; active: boolean; managedNodes?: CommunityNode[] }) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [nodes, setNodes] = useState<CommunityNode[]>([])
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
  usePanelReady(!active || (isReady && !draftLoading))
  const requestId = useRef('')
  const imageSelection = useRiceImages()
  const restoreImages = imageSelection.restore
  useEffect(() => {
    if (!isReady) return
    if (!session) { setDraftLoading(false); return }
    let active = true; setDraftLoading(true)
    void Promise.all([managedNodes ?? getNodes({ data: { token: session.token, mine: 'managed' } }), getTasks({ data: { token: session.token, mine: 'created', status: 'draft', limit: 1 } })]).then(([managed, [draft]]) => {
      if (!active) return
      setNodes(managed); setNodeId(draft?.node?.id ?? managed[0]?.id ?? '')
      if (draft) { setEditingDraftId(draft.id); restoreImages(draft.attachments ?? []); setTitle(draft.title); setDescription(draft.description); setRequirement(draft.requirement ?? ''); setApplicationDeadline(draft.application_deadline ? localDateTimeValue(draft.application_deadline) : ''); setExecutionDeadline(draft.execution_deadline ? localDateTimeValue(draft.execution_deadline) : ''); setRewardAmount(String(draft.reward_amount)) }
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setDraftLoading(false) })
    return () => { active = false }
  }, [isReady, session?.token, restoreImages, managedNodes])
  if (!isReady || draftLoading) return <p className="loading-line">正在恢复草稿…</p>
  if (!session) return <Link to="/login" className="primary-link">登录后发布任务</Link>
  if (!nodes.length) return <div className="form-card"><p>只有社区管理员可以发布任务。</p>{error && <p className="inline-error" role="alert">{error}</p>}<Button label="发布任务" variant="primary" isDisabled /></div>
  const submit = async (status: 'draft' | 'open') => {
    if (submitting) return
    if ((applicationDeadline && applicationDeadline < localDateTimeValue()) || (executionDeadline && executionDeadline < localDateTimeValue()) || (applicationDeadline && executionDeadline && executionDeadline <= applicationDeadline)) { setError('申请截止应早于交付截止，日期应晚于当前时间。'); return }
    setSubmitting(status); setError(''); setNotice('')
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      const attachmentIds = await imageSelection.upload(session.token)
      const fields = { attachmentIds, token: session.token, title, description, nodeId, requirement, applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null, executionDeadline: executionDeadline ? new Date(executionDeadline).toISOString() : null, rewardAmount: Number(rewardAmount || 0), clientRequestId: requestId.current }
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
      if (!mounted.current) return
      setEditingDraftId(task.id)
      if (status === 'draft') { setNotice('草稿已保存'); return }
      window.dispatchEvent(new Event('rice-changed'))
      if (onPublished) onPublished(); else await navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '任务保存失败') } finally { if (mounted.current) setSubmitting(null) }
  }
  const disabled = !nodeId || !title.trim() || !description.trim() || !requirement.trim() || rewardAmount === '' || !!submitting
  return <section className={`form-card task-compose-form ${embedded ? '' : 'page'}`}>
    {!embedded && <h1>发布任务</h1>}<label className="native-field">所属社区<select value={nodeId} disabled={!!editingDraftId || !!submitting} onChange={(e) => setNodeId(e.target.value)}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    <TextInput label="任务标题" value={title} onChange={(v) => setTitle(v.slice(0, 128))} width="100%" isRequired />
    <TextArea label="任务说明" value={description} onChange={setDescription} maxLength={4000} rows={4} width="100%" isRequired />
    <ImagePicker images={imageSelection.images} onSelect={imageSelection.select} onRemove={imageSelection.remove} disabled={!!submitting} maxBytes={RICE_IMAGE_MAX_BYTES} />
    <TextArea label="交付要求" value={requirement} onChange={setRequirement} maxLength={4000} rows={3} width="100%" isRequired />
    <label className="native-field">申请截止时间<input type="datetime-local" value={applicationDeadline} min={localDateTimeValue()} onChange={(e) => setApplicationDeadline(e.target.value)} /></label>
    <label className="native-field">交付截止时间<input type="datetime-local" value={executionDeadline} min={applicationDeadline || localDateTimeValue()} onChange={(e) => setExecutionDeadline(e.target.value)} /></label>
    <TextInput label="任务报酬（测试稻米）" value={rewardAmount} onChange={(v) => setRewardAmount(v.replace(/\D/g, '').slice(0, 9))} width="100%" isRequired />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
    <div className="button-row"><Button label="保存草稿" variant="secondary" isDisabled={disabled} isLoading={submitting === 'draft'} clickAction={() => submit('draft')} /><Button label="发布任务" variant="primary" isDisabled={disabled} isLoading={submitting === 'open'} clickAction={() => submit('open')} /></div>
  </section>
}
