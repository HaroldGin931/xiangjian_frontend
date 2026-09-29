import { Button } from '@astryxdesign/core/Button'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AutoLoadMore } from '~/components/AutoLoadMore'
import { LoadingState } from '~/components/LoadingState'
import { getNodes, type CommunityNode } from '../nodes/api'
import { useStoredSession } from '../session/session'
import { getTaskPage, type TaskPage } from './api'
import { TaskCard } from './TaskCard'
import type { RiceTask } from './types'

type TasksPageProps = { nodeId?: string; initialPage?: TaskPage; initialNodes?: CommunityNode[]; refreshError?: string }
export function TasksPage(props: TasksPageProps) {
  const { session } = useStoredSession()
  return <TaskList key={`${props.nodeId ?? 'all'}:${session?.token ?? 'guest'}`} {...props} />
}

function TaskList({ nodeId, initialPage, initialNodes, refreshError = '' }: TasksPageProps) {
  const navigate = useNavigate()
  const { session, isReady } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[]>(initialPage?.data ?? [])
  const [nodes, setNodes] = useState<CommunityNode[]>(initialNodes ?? [])
  const [filter, setFilter] = useState('all')
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.meta.next_cursor ?? null)
  const [loading, setLoading] = useState(!initialPage)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const request = useRef(0)
  const routePage = useRef(initialPage)
  const paginated = useRef(false)
  const usesRoutePage = Boolean(initialPage && !nodeId && filter === 'all')
  const visibleError = error || (usesRoutePage ? refreshError : '')
  const input = { token: session?.token, nodeId: nodeId ?? (filter === 'all' || filter === 'available' ? undefined : filter), available: filter === 'available', sort: 'published' as const, limit: 12 }
  useEffect(() => { if (usesRoutePage) return; const refresh = () => setVersion((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [usesRoutePage])
  useEffect(() => {
    if (routePage.current === initialPage) return
    routePage.current = initialPage
    if (!initialPage || !usesRoutePage) return
    setTasks((current) => {
      if (!paginated.current) return initialPage.data
      const ids = new Set(initialPage.data.map((task) => task.id))
      return [...initialPage.data, ...current.filter((task) => !ids.has(task.id))]
    })
    if (!paginated.current) setNextCursor(initialPage.meta.next_cursor)
  }, [initialPage, usesRoutePage])
  useEffect(() => { if (nodeId) return; if (initialNodes) { setNodes(initialNodes); return }; let active = true; void getNodes({ data: {} }).then((rows) => { if (active) setNodes(rows) }).catch(() => undefined); return () => { active = false } }, [initialNodes, nodeId])
  useEffect(() => {
    ++request.current
    if (!isReady) return
    paginated.current = false
    if (filter === 'available' && !session) { setTasks([]); setNextCursor(null); setLoading(false); setError(''); return () => { ++request.current } }
    if (initialPage && !nodeId && filter === 'all') { setTasks(initialPage.data); setNextCursor(initialPage.meta.next_cursor); setLoading(false); setError(''); return () => { ++request.current } }
    let active = true
    setLoading(true); setError(''); setNextCursor(null)
    void getTaskPage({ data: input }).then((page) => { if (active) { setTasks(page.data); setNextCursor(page.meta.next_cursor) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [isReady, session?.token, filter, nodeId, version])
  const more = async () => { if (!nextCursor || loading) return; const current = request.current; paginated.current = true; setLoading(true); setError(''); try { const page = await getTaskPage({ data: { ...input, before: nextCursor } }); if (current === request.current) { setTasks((r) => [...new Map([...r, ...page.data].map((task) => [task.id, task])).values()]); setNextCursor(page.meta.next_cursor) } } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  return <div className="page task-page">
    {!nodeId && <section className="task-hero"><span>TASKS · COMMUNITY COLLABORATION</span><h1>一起把事情<br />真正做完</h1><p>申请、交付、验收与稻米结算，任务进展都在这里。</p>{session ? <button type="button" className="hero-action" onClick={() => { void navigate({ to: '/me/tasks' }) }}>我的任务</button> : null}</section>}
    <div className="business-heading"><h2>{nodeId ? '社区任务' : '全部任务'}</h2>{!nodeId && <select aria-label="任务筛选" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部</option><option value="available">可申请</option>{nodes.map((n) => <option value={n.id} key={n.id}>{n.name}</option>)}</select>}</div>
    {visibleError && <p className="inline-error" role="alert">{visibleError}</p>}{loading && (tasks.length ? <p className="refresh-status" role="status">正在加载任务…</p> : <LoadingState label="正在加载任务…" />)}<section className="task-list" aria-busy={loading}>{tasks.map((task) => <TaskCard task={task} key={task.id} />)}</section>
    {!loading && !visibleError && !tasks.length && (filter === 'available' ? <div className="form-stack">
      <p className="search-hint">{session ? '当前账号暂无可申请的任务。已截止、已申请或由你发布的任务不会出现在这里。' : '登录后才能查看当前账号可申请的任务。你也可以继续浏览全部任务。'}</p>
      <div className="empty-state-actions"><Button label="查看全部任务" variant="secondary" onClick={() => setFilter('all')} /></div>
    </div> : <p className="search-hint">暂时没有任务。</p>)}{nextCursor && <AutoLoadMore key={`${nodeId}:${filter}:${session?.user.id}`} cursor={nextCursor} loading={loading || !isReady} failed={!!error} onLoadMore={more} />}
  </div>
}
