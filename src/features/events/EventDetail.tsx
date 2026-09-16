import { ImageGroup } from '~/components/ContentImages'
import { usePanelReady } from '~/components/DetailDialog'
import { attachmentImages } from '~/lib/attachments'
import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Link } from '@tanstack/react-router'
import { Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { applicationStatusLabel, eventAction, eventStatusLabel, getEvent, type RiceEvent } from './api'

const historyLabels: Record<string, string> = { applied: '提交申请', completed: '活动结束', application_completed: '完成参与记录', application_cancelled: '报名已取消', created: '创建活动', published: '发布活动', application_created: '提交申请', application_approved: '通过申请', application_rejected: '拒绝申请', application_removed: '移除报名', started: '活动开始', finished: '活动结束', cancelled: '活动取消', application_not_selected: '申请未入选' }
export function EventDetail({ eventId, loadEvent }: { eventId: string; loadEvent?: (token?: string) => Promise<RiceEvent> }) {
  const { session } = useStoredSession()
  return <EventDetails key={`${eventId}:${session?.user.id ?? 'guest'}`} eventId={eventId} loadEvent={loadEvent} />
}

function EventDetails({ eventId, loadEvent }: { eventId: string; loadEvent?: (token?: string) => Promise<RiceEvent> }) {
  const { session, isReady } = useStoredSession()
  const [event, setEvent] = useState<RiceEvent | null>(null)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState<'apply' | 'finish' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)
  usePanelReady(isReady && Boolean(event || error))
  useEffect(() => {
    if (!isReady) return
    let active = true
    setError('')
    void (loadEvent ? loadEvent(session?.token) : getEvent({ data: { id: eventId, token: session?.token } })).then((value) => { if (active) setEvent(value) }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [isReady, session?.token, eventId, loadEvent])
  const run = async (action: 'apply' | 'approve' | 'reject' | 'remove' | 'finish' | 'cancel', applicationId?: string) => {
    if (!session) return
    setBusy(true); setError('')
    try { setEvent(await eventAction({ data: { token: session.token, id: eventId, action, applicationId, reason } })); setConfirm(null); setReason(''); window.dispatchEvent(new Event('rice-changed')) }
    catch (e) { setError(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) }
  }
  return <div className="page business-panel">{error && <p className="inline-error" role="alert">{error}</p>}{!event && !error && <p>正在加载活动…</p>}{event && <>
    <span className={`task-status status-${event.status}`}>{eventStatusLabel[event.status]}</span><h1>{event.title}</h1><p className="muted">{event.node.name} · {event.creator.nickname || event.creator.handle}发起</p>
    <div className="business-money"><strong className="rice-amount">{event.fee_amount ? <><Sprout size={25} />{event.fee_amount}<small> / 人</small></> : '免费'}</strong></div>
    <p>{formatTimestamp(event.starts_at, true)} — {formatTimestamp(event.ends_at, true)}</p><p>{event.location}</p><p className="muted">报名截止：{formatTimestamp(event.application_deadline, true)}</p>
    <div className="business-counts"><div><strong>{event.application_count}</strong><span>已提交申请</span></div><div><strong>{event.approved_count} / {event.capacity}</strong><span>已通过 / 名额</span></div></div>
    {event.my_application && <p className="task-neutral-note">我的申请：{applicationStatusLabel[event.my_application.status]}{event.my_application.payment_status === 'refunded' ? '，费用已退回' : event.my_application.payment_status === 'settled' ? '，报名费已结算' : ''}</p>}
    {session && (confirm ? <section className="business-section"><h2>{confirm === 'apply' ? '申请参加' : confirm === 'finish' ? '确认活动结束' : '确认取消活动'}</h2>
      {confirm === 'apply' ? <><p>{event.fee_amount ? `本次报名费 ${event.fee_amount} 稻米，未入选将全额退回。` : '本次活动免费。'}</p><TextArea label="参与说明" value={reason} onChange={setReason} maxLength={512} rows={3} width="100%" /></> : <p>{confirm === 'finish' ? `确认后，将完成 ${event.approved_count} 位有效参与者的活动记录${event.fee_amount ? `，并结算 ${event.approved_count * event.fee_amount} 稻米` : ''}。` : '取消后不能继续报名，尚未结算的报名费将退回申请人。'}</p>}
      <div className="button-row"><Button label="返回" variant="secondary" isDisabled={busy} onClick={() => setConfirm(null)} /><Button label={confirm === 'apply' ? '确认申请' : confirm === 'finish' ? '确认结束' : '确认取消'} variant={confirm === 'cancel' ? 'destructive' : 'primary'} isDisabled={busy} clickAction={() => run(confirm)} /></div>
    </section> : <div className="button-row business-section">{event.allowed_actions.includes('apply') && <Button label="申请参加" variant="primary" onClick={() => setConfirm('apply')} />}{event.allowed_actions.includes('finish') && <Button label="确认活动结束" variant="primary" onClick={() => setConfirm('finish')} />}{event.allowed_actions.includes('cancel') && <Button label="取消活动" variant="destructive" onClick={() => setConfirm('cancel')} />}{event.allowed_actions.includes('edit') && <Link to="/compose" search={{ kind: 'activity' }}>继续编辑</Link>}</div>)}
    <section className="business-section"><h2>活动介绍</h2><p className="business-description">{event.description}</p><ImageGroup images={attachmentImages(event.attachments)} /></section>
    {event.creator.id === session?.user.id && <section className="business-section"><h2>报名申请</h2>{event.applications.length ? event.applications.map((a) => <article className="candidate" key={a.id}><strong>{a.user.nickname || a.user.handle}</strong><span className="task-status">{applicationStatusLabel[a.status]}</span><p>{a.reason}</p><div className="button-row">{(['approve', 'reject', 'remove'] as const).filter((action) => a.allowed_actions.includes(action)).map((action) => <Button key={action} label={action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : event.fee_amount ? '移除并退款' : '移除报名'} variant={action === 'approve' ? 'primary' : 'secondary'} isDisabled={busy} clickAction={() => run(action, a.id)} />)}</div></article>) : <p>还没有申请。</p>}</section>}
    {!!event.history.length && <details className="business-section"><summary>查看进展</summary><ol className="business-history">{event.history.map((h) => <li key={h.id}><time>{formatTimestamp(h.inserted_at, true)}</time><p>{h.actor?.nickname || h.actor?.handle || '系统'} · {historyLabels[h.action] || (h.to_status in eventStatusLabel ? eventStatusLabel[h.to_status as keyof typeof eventStatusLabel] : '更新了活动进展')}</p></li>)}</ol></details>}
  </>}</div>
}
