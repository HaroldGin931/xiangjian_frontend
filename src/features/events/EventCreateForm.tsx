import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ImagePicker } from '~/components/ContentImages'
import { RICE_IMAGE_MAX_BYTES, useRiceImages } from '../media/useRiceImages'
import { localDateTimeValue } from '~/lib/format'
import { getNodes, type CommunityNode } from '../nodes/api'
import { useStoredSession } from '../session/session'
import { getEvents, saveEvent } from './api'

const emptyFields = { node_id: '', title: '', description: '', location: '', application_deadline: '', starts_at: '', ends_at: '', fee_amount: '0', capacity: '' }
export function EventCreateForm({ onPublished }: { onPublished?: () => void }) {
  const { session } = useStoredSession()
  return <EventEditor key={session?.token ?? 'guest'} onPublished={onPublished} />
}

function EventEditor({ onPublished }: { onPublished?: () => void }) {
  const { session, isReady } = useStoredSession()
  const navigate = useNavigate()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [fields, setFields] = useState(emptyFields)
  const [nodes, setNodes] = useState<CommunityNode[]>([])
  const [draftId, setDraftId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestId = useRef('')
  const imageSelection = useRiceImages()
  const restoreImages = imageSelection.restore
  const set = (key: keyof typeof fields, value: string) => setFields((f) => ({ ...f, [key]: value }))
  useEffect(() => {
    if (!isReady) return
    if (!session) { setLoading(false); return }
    let active = true
    void Promise.all([getNodes({ data: { token: session.token, mine: 'managed' } }), getEvents({ data: { token: session.token, mine: 'created', status: 'draft' } })]).then(([managed, page]) => {
      if (!active) return
      setNodes(managed)
      const draft = page.data[0]
      if (draft) { setDraftId(draft.id); restoreImages(draft.attachments ?? []); setFields({ node_id: draft.node.id, title: draft.title, description: draft.description, location: draft.location, application_deadline: localDateTimeValue(draft.application_deadline), starts_at: localDateTimeValue(draft.starts_at), ends_at: localDateTimeValue(draft.ends_at), fee_amount: String(draft.fee_amount), capacity: String(draft.capacity) }) }
      else setFields((f) => ({ ...f, node_id: managed[0]?.id ?? '' }))
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.token, isReady, restoreImages])
  if (!isReady || loading) return <p className="loading-line">正在恢复草稿…</p>
  if (!session) return <Link to="/login" className="primary-link">登录后发布活动</Link>
  if (!nodes.length) return <div className="form-card"><p>只有社区管理员可以发布活动。</p>{error && <p className="inline-error" role="alert">{error}</p>}<Button label="发布活动" variant="primary" isDisabled /></div>
  const submit = async (status: 'draft' | 'open') => {
    if (busy) return
    if (fields.application_deadline > fields.starts_at || fields.starts_at >= fields.ends_at || fields.application_deadline < localDateTimeValue()) { setError('请确认报名截止不晚于开始时间，结束时间晚于开始时间。'); return }
    if (!requestId.current) requestId.current = crypto.randomUUID()
    setBusy(true); setError(''); setNotice('')
    try {
      const attachment_ids = await imageSelection.upload(session.token)
      const event = await saveEvent({ data: { token: session.token, id: draftId, status, fields: { ...fields, attachment_ids, fee_amount: Number(fields.fee_amount), capacity: Number(fields.capacity), application_deadline: new Date(fields.application_deadline).toISOString(), starts_at: new Date(fields.starts_at).toISOString(), ends_at: new Date(fields.ends_at).toISOString(), client_request_id: requestId.current } } })
      if (!mounted.current) return
      setDraftId(event.id)
      if (status === 'draft') { setNotice('草稿已保存'); return }
      window.dispatchEvent(new Event('rice-changed'))
      if (onPublished) onPublished(); else await navigate({ to: '/events' })
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '保存失败') } finally { if (mounted.current) setBusy(false) }
  }
  const disabled = busy || !fields.node_id || !fields.title.trim() || !fields.description.trim() || !fields.location.trim() || !fields.application_deadline || !fields.starts_at || !fields.ends_at || Number(fields.capacity) < 1
  return <section className="form-card event-compose-form">
    <label className="native-field">所属社区<select value={fields.node_id} onChange={(e) => set('node_id', e.target.value)}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    <TextInput label="活动标题" value={fields.title} onChange={(v) => set('title', v.slice(0, 128))} width="100%" isRequired />
    <TextArea label="活动介绍" value={fields.description} onChange={(v) => set('description', v)} maxLength={4000} rows={4} width="100%" isRequired />
    <ImagePicker images={imageSelection.images} onSelect={imageSelection.select} onRemove={imageSelection.remove} disabled={busy} maxBytes={RICE_IMAGE_MAX_BYTES} />
    <TextInput label="活动地点" value={fields.location} onChange={(v) => set('location', v)} width="100%" isRequired />
    {([['application_deadline', '报名截止'], ['starts_at', '开始时间'], ['ends_at', '结束时间']] as const).map(([key, label]) => <label className="native-field" key={key}>{label}<input required type="datetime-local" value={fields[key]} min={localDateTimeValue()} onChange={(e) => set(key, e.target.value)} /></label>)}
    <TextInput label="参与名额" value={fields.capacity} onChange={(v) => set('capacity', v.replace(/\D/g, '').slice(0, 6))} width="100%" isRequired />
    <TextInput label="每人报名费（测试稻米，0 为免费）" value={fields.fee_amount} onChange={(v) => set('fee_amount', v.replace(/\D/g, '').slice(0, 9))} width="100%" isRequired />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
    <div className="button-row"><Button label="保存草稿" variant="secondary" isDisabled={disabled} clickAction={() => submit('draft')} /><Button label="发布活动" variant="primary" isDisabled={disabled} clickAction={() => submit('open')} /></div>
  </section>
}
