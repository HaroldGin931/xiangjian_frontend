import { ImageCover } from '~/components/ContentImages'
import { attachmentImages } from '~/lib/attachments'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Sprout } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ContentCardHeader } from '~/components/ContentCardHeader'
import { DetailDialog } from '~/components/DetailDialog'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { EventDetail } from './EventDetail'
import { NodeDetail } from '../nodes/NodesPanel'
import { eventStatusLabel, getEvents, type RiceEvent } from './api'

export function EventCard({ event, onOpen, onOpenCommunity }: { event: RiceEvent; onOpen?: () => void; onOpenCommunity?: (nodeId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  return <><article className="content-card task-card business-card">
    <ContentCardHeader initial={event.node.name.slice(0, 1)} name={event.node.name} avatarUrl={event.node.logo?.url} onAuthorClick={() => onOpenCommunity ? onOpenCommunity(event.node.id) : setCommunityOpen(true)} timestamp={`${formatTimestamp(event.published_at ?? event.inserted_at)} · 发布`} />
    <button className="business-card-body" type="button" onClick={onOpen ?? (() => setOpen(true))}>
    <h2>{event.title}</h2><p>{formatTimestamp(event.starts_at, true)} · {event.location}</p>
    <ImageCover images={attachmentImages(event.attachments)} />
    <footer className="content-card-actions task-card-actions"><span className={`task-status status-${event.status}`}>{eventStatusLabel[event.status]}</span><strong className="rice-amount" aria-label={event.fee_amount ? `${event.fee_amount} 稻米每人` : '免费'}>{event.fee_amount ? <><Sprout size={21} />{event.fee_amount}<small>/ 人</small></> : '免费'}</strong></footer>
    </button></article>{open && <DetailDialog title="活动详情" onClose={() => setOpen(false)}><EventDetail eventId={event.id} /></DetailDialog>}{communityOpen && <DetailDialog title="社区详情" onClose={() => setCommunityOpen(false)}><NodeDetail nodeId={event.node.id} /></DetailDialog>}</>
}

export function EventsPage({ nodeId, embedded = false, mine = false }: { nodeId?: string; embedded?: boolean; mine?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [tab, setTab] = useState<'applied' | 'created'>('applied')
  const [rows, setRows] = useState<RiceEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const request = useRef(0)
  const loadedScope = useRef('')
  useEffect(() => { const refresh = () => setReload((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [])
  useEffect(() => {
    if (!isReady) return
    let active = true; ++request.current
    const scope = JSON.stringify([session?.token, nodeId, mine, tab])
    setLoading(true); setError('')
    if (scope !== loadedScope.current) { setRows([]); setCursor(null); loadedScope.current = scope }
    if (mine && !session) { setLoading(false); return }
    void getEvents({ data: { token: session?.token, nodeId, mine: mine ? tab : undefined } }).then((page) => { if (active) { setRows(page.data); setCursor(page.meta?.next_cursor ?? null) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [isReady, session?.token, nodeId, mine, tab, reload])
  const more = async () => { if (!cursor || loading) return; const current = request.current; setLoading(true); try { const page = await getEvents({ data: { token: session?.token, nodeId, mine: mine ? tab : undefined, before: cursor } }); if (current === request.current) { setRows((r) => [...r, ...page.data]); setCursor(page.meta?.next_cursor ?? null) } } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  return <div className="page events-page"><div className="business-heading"><h1>{mine ? '我的活动' : '活动'}</h1>{!mine && !embedded && <Link to="/me/events">我的活动</Link>}</div>
    {mine && <div className="filter-buttons">{(['applied', 'created'] as const).map((value) => <Button key={value} label={value === 'applied' ? '我申请的' : '我主办的'} variant="ghost" className={tab === value ? 'active' : undefined} aria-pressed={tab === value} onClick={() => setTab(value)} />)}</div>}
    {mine && !session && isReady && <Link to="/login" className="primary-link">登录后查看我的活动</Link>}
    {error && <p className="inline-error" role="alert">{error}</p>}{loading && !rows.length && <p className="loading-line">正在加载活动…</p>}
    <section className="task-list">{rows.map((event) => <EventCard event={event} key={event.id} onOpen={() => setSelectedEvent(event.id)} onOpenCommunity={setSelectedCommunity} />)}</section>
    {!loading && !error && !rows.length && <p className="search-hint">暂时没有活动。</p>}{cursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
    {selectedEvent && <DetailDialog title="活动详情" onClose={() => setSelectedEvent(null)}><EventDetail eventId={selectedEvent} /></DetailDialog>}
    {selectedCommunity && <DetailDialog title="社区详情" onClose={() => setSelectedCommunity(null)}><NodeDetail nodeId={selectedCommunity} /></DetailDialog>}
  </div>
}
