import { LoginLink } from '../session/LoginLink'
import { ImageCover } from '~/components/ContentImages'
import { attachmentImages } from '~/lib/attachments'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { Sprout } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDetailPrefetch } from '~/components/useDetailPrefetch'
import { useTimeBoundary } from '~/components/useTimeBoundary'
import { ContentCardHeader } from '~/components/ContentCardHeader'
import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { formatTimestamp } from '~/lib/format'
import { useStoredSession } from '../session/session'
import { EventDetail } from './EventDetail'
import { NodeDetail } from '../nodes/NodesPanel'
import { eventDisplayStatus, getEvent, getEvents, type RiceEvent, type EventPage } from './api'

export function EventCard({ event, onOpen, onOpenCommunity }: { event: RiceEvent; onOpen?: (load: (token?: string) => Promise<RiceEvent>) => void; onOpenCommunity?: (nodeId: string) => void }) {
  const { session } = useStoredSession()
  const now = useTimeBoundary(['open', 'in_progress'].includes(event.status) ? [event.application_deadline, event.starts_at, event.ends_at] : [])
  const loadEvent = useDetailPrefetch(useCallback(() => getEvent({ data: { id: event.id, token: session?.token } }), [event.id, session?.token]))
  const prefetch = () => { void loadEvent().catch(() => undefined) }
  const [open, setOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  return <><article className="content-card task-card business-card">
    <ContentCardHeader name={event.node.name} avatarUrl={event.node.logo?.url} onAuthorClick={() => onOpenCommunity ? onOpenCommunity(event.node.id) : setCommunityOpen(true)} timestamp={`${formatTimestamp(event.published_at ?? event.inserted_at)} · 发布`} />
    <button className="business-card-body" type="button" onPointerEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch} onClick={() => { prefetch(); if (onOpen) onOpen((token) => token === session?.token ? loadEvent() : getEvent({ data: { id: event.id, token } })); else setOpen(true) }}>
    <h2>{event.title}</h2><p>{formatTimestamp(event.starts_at, true)} · {event.location}</p>
    <ImageCover images={attachmentImages(event.attachments)} />
    <footer className="content-card-actions task-card-actions"><span className={`task-status status-${event.status}`}>{eventDisplayStatus(event, now)}</span><strong className="rice-amount" aria-label={event.fee_amount ? `${event.fee_amount} 稻米每人` : '免费'}>{event.fee_amount ? <><Sprout size={21} />{event.fee_amount}<small>/ 人</small></> : '免费'}</strong></footer>
    </button></article>{open && <DetailDialog title="活动详情" onClose={() => setOpen(false)}><EventDetail eventId={event.id} loadEvent={(token) => token === session?.token ? loadEvent() : getEvent({ data: { id: event.id, token } })} /></DetailDialog>}{communityOpen && <DetailDialog title="社区详情" onClose={() => setCommunityOpen(false)}><NodeDetail nodeId={event.node.id} /></DetailDialog>}</>
}

type EventsPageProps = { nodeId?: string; embedded?: boolean; mine?: boolean; initialPage?: EventPage; refreshError?: string }
export function EventsPage(props: EventsPageProps) {
  const { session } = useStoredSession()
  return <EventList key={session?.token ?? 'guest'} {...props} />
}

function EventList({ nodeId, embedded = false, mine = false, initialPage, refreshError = '' }: EventsPageProps) {
  const { session, isReady } = useStoredSession()
  const [tab, setTab] = useState<'applied' | 'managed'>('applied')
  const [rows, setRows] = useState<RiceEvent[]>(initialPage?.data ?? [])
  const [cursor, setCursor] = useState<string | null>(initialPage?.meta?.next_cursor ?? null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!initialPage)
  const [reload, setReload] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; load: (token?: string) => Promise<RiceEvent> } | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const request = useRef(0)
  const routePage = useRef(initialPage)
  const paginated = useRef(false)
  const usesRoutePage = Boolean(initialPage && !nodeId && !mine)
  const visibleError = error || (usesRoutePage ? refreshError : '')
  usePanelReady(isReady && (!loading || rows.length > 0 || !!error))
  useEffect(() => { if (usesRoutePage) return; const refresh = () => setReload((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [usesRoutePage])
  useEffect(() => {
    if (routePage.current === initialPage) return
    routePage.current = initialPage
    if (!initialPage || !usesRoutePage) return
    setRows((current) => {
      if (!paginated.current) return initialPage.data
      const ids = new Set(initialPage.data.map((event) => event.id))
      return [...initialPage.data, ...current.filter((event) => !ids.has(event.id))]
    })
    if (!paginated.current) setCursor(initialPage.meta?.next_cursor ?? null)
  }, [initialPage, usesRoutePage])
  useEffect(() => {
    if (!isReady) return
    paginated.current = false
    if (initialPage && !nodeId && !mine) { setRows(initialPage.data); setCursor(initialPage.meta?.next_cursor ?? null); setLoading(false); setError(''); return }
    let active = true; ++request.current
    setLoading(true); setError(''); setCursor(null)
    if (mine && !session) { setLoading(false); return }
    void getEvents({ data: { token: session?.token, nodeId, mine: mine ? tab : undefined } }).then((page) => { if (active) { setRows(page.data); setCursor(page.meta?.next_cursor ?? null) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [isReady, session?.token, nodeId, mine, tab, reload])
  const more = async () => { if (!cursor || loading) return; const current = request.current; paginated.current = true; setLoading(true); try { const page = await getEvents({ data: { token: session?.token, nodeId, mine: mine ? tab : undefined, before: cursor } }); if (current === request.current) { setRows((r) => [...new Map([...r, ...page.data].map((event) => [event.id, event])).values()]); setCursor(page.meta?.next_cursor ?? null) } } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  return <div className={`page events-page${embedded ? ' business-panel list-panel' : ''}`}><div className="business-heading"><h1>{mine ? '我的活动' : '活动'}</h1>{session && !mine && !embedded && <Link to="/me/events">我的活动</Link>}</div>
    {mine && <div className="filter-buttons">{(['applied', 'managed'] as const).map((value) => <Button key={value} label={value === 'applied' ? '我申请的' : '我管理的'} variant="ghost" className={tab === value ? 'active' : undefined} aria-pressed={tab === value} onClick={() => setTab(value)} />)}</div>}
    {mine && !session && isReady && <LoginLink className="primary-link">登录后查看我的活动</LoginLink>}
    {visibleError && <p className="inline-error" role="alert">{visibleError}</p>}{loading && <p className={rows.length ? 'refresh-status' : 'loading-line'} role="status">正在加载活动…</p>}
    <section className="task-list" aria-busy={loading}>{rows.map((event) => <EventCard event={event} key={event.id} onOpen={(load) => setSelectedEvent({ id: event.id, load })} onOpenCommunity={setSelectedCommunity} />)}</section>
    {!loading && !visibleError && !rows.length && <p className="search-hint">暂时没有活动。</p>}{cursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
    {selectedEvent && <DetailDialog key={selectedEvent.id} title="活动详情" onClose={() => setSelectedEvent(null)}><EventDetail eventId={selectedEvent.id} loadEvent={selectedEvent.load} /></DetailDialog>}
    {selectedCommunity && <DetailDialog title="社区详情" onClose={() => setSelectedCommunity(null)}><NodeDetail nodeId={selectedCommunity} /></DetailDialog>}
  </div>
}
