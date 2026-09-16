import { Button } from '@astryxdesign/core/Button'
import { useEffect, useRef, useState } from 'react'
import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { getNodes, type CommunityNode } from '../nodes/api'
import { NodeDetail } from '../nodes/NodesPanel'
import { useStoredSession } from '../session/session'
import { getTaskPage, type TaskPage } from './api'
import { MyTasksPage } from './MyTasksPage'
import { TaskCard } from './TaskCard'
import { TaskDetailPage } from './TaskDetailPage'
import type { RiceTask } from './types'

export function TasksPage({ nodeId, embedded = false, initialPage, initialNodes }: { nodeId?: string; embedded?: boolean; initialPage?: TaskPage; initialNodes?: CommunityNode[] }) {
  const { session, isReady } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[]>(initialPage?.data ?? [])
  const [nodes, setNodes] = useState<CommunityNode[]>(initialNodes ?? [])
  const [filter, setFilter] = useState('all')
  const [myTasks, setMyTasks] = useState(false)
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.meta.next_cursor ?? null)
  const [loading, setLoading] = useState(!initialPage)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const request = useRef(0)
  const [selectedTask, setSelectedTask] = useState<{ id: string; load: (token?: string) => Promise<RiceTask> } | null>(null)
  const routePage = useRef(initialPage)
  const paginated = useRef(false)
  const usesRoutePage = Boolean(initialPage && !nodeId && filter === 'all')
  usePanelReady(isReady && (!loading || tasks.length > 0 || !!error))
  const input = { token: session?.token, nodeId: nodeId ?? (filter === 'all' || filter === 'available' ? undefined : filter), available: filter === 'available', limit: 12 }
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
  useEffect(() => { if (initialNodes) { setNodes(initialNodes); return }; let active = true; void getNodes({ data: {} }).then((rows) => { if (active) setNodes(rows) }).catch(() => undefined); return () => { active = false } }, [initialNodes])
  useEffect(() => {
    if (!isReady) return
    paginated.current = false
    if (initialPage && !nodeId && filter === 'all') { setTasks(initialPage.data); setNextCursor(initialPage.meta.next_cursor); setLoading(false); setError(''); return }
    let active = true; ++request.current
    setLoading(true); setError(''); setNextCursor(null)
    void getTaskPage({ data: input }).then((page) => { if (active) { setTasks(page.data); setNextCursor(page.meta.next_cursor) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; ++request.current }
  }, [isReady, session?.token, filter, nodeId, version])
  const more = async () => { if (!nextCursor || loading) return; const current = request.current; paginated.current = true; setLoading(true); try { const page = await getTaskPage({ data: { ...input, before: nextCursor } }); if (current === request.current) { setTasks((r) => [...new Map([...r, ...page.data].map((task) => [task.id, task])).values()]); setNextCursor(page.meta.next_cursor) } } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  return <div className="page task-page">
    {!embedded && <section className="task-hero"><span>TASKS · COMMUNITY COLLABORATION</span><h1>一起把事情<br />真正做完</h1><p>申请、交付、验收与稻米结算，任务进展都在这里。</p>{session ? <button type="button" className="hero-action" onClick={() => setMyTasks(true)}>我的任务</button> : null}</section>}
    <div className="business-heading"><h2>{embedded ? '社区任务' : '全部任务'}</h2>{!nodeId && <select aria-label="任务筛选" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部</option><option value="available">可申请</option>{nodes.map((n) => <option value={n.id} key={n.id}>{n.name}</option>)}</select>}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}{loading && <p className={tasks.length ? 'refresh-status' : 'loading-line'} role="status">正在加载任务…</p>}<section className="task-list" aria-busy={loading}>{tasks.map((task) => <TaskCard task={task} key={task.id} onOpen={(load) => setSelectedTask({ id: task.id, load })} onOpenCommunity={setSelectedCommunity} />)}</section>
    {!loading && !error && !tasks.length && <p className="search-hint">暂时没有任务。</p>}{nextCursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
    {myTasks && <DetailDialog title="我的任务" onClose={() => setMyTasks(false)}><MyTasksPage embedded /></DetailDialog>}
    {selectedCommunity && <DetailDialog title="社区详情" onClose={() => setSelectedCommunity(null)}><NodeDetail nodeId={selectedCommunity} /></DetailDialog>}
    {selectedTask && <DetailDialog key={selectedTask.id} title="任务详情" onClose={() => setSelectedTask(null)}><TaskDetailPage taskId={selectedTask.id} loadTask={selectedTask.load} embedded /></DetailDialog>}
  </div>
}
