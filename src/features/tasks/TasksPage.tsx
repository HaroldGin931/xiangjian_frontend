import { Button } from '@astryxdesign/core/Button'
import { useEffect, useRef, useState } from 'react'
import { DetailDialog } from '~/components/DetailDialog'
import { getNodes, type CommunityNode } from '../nodes/api'
import { NodeDetail } from '../nodes/NodesPanel'
import { useStoredSession } from '../session/session'
import { getTaskPage } from './api'
import { MyTasksPage } from './MyTasksPage'
import { TaskCard } from './TaskCard'
import { TaskDetailPage } from './TaskDetailPage'
import type { RiceTask } from './types'

export function TasksPage({ nodeId, embedded = false }: { nodeId?: string; embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [nodes, setNodes] = useState<CommunityNode[]>([])
  const [filter, setFilter] = useState('all')
  const [myTasks, setMyTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const request = useRef(0)
  const loadedScope = useRef('')
  const input = { token: session?.token, nodeId: nodeId ?? (filter === 'all' || filter === 'available' ? undefined : filter), available: filter === 'available', limit: 12 }
  useEffect(() => { const refresh = () => setVersion((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [])
  useEffect(() => { let active = true; void getNodes({ data: {} }).then((rows) => { if (active) setNodes(rows) }).catch(() => undefined); return () => { active = false } }, [])
  useEffect(() => {
    if (!isReady) return
    let active = true; ++request.current
    const scope = JSON.stringify([session?.token, filter, nodeId])
    setLoading(true); setError('')
    if (scope !== loadedScope.current) { setTasks([]); setNextCursor(null); loadedScope.current = scope }
    void getTaskPage({ data: input }).then((page) => { if (active) { setTasks(page.data); setNextCursor(page.meta.next_cursor) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isReady, session?.token, filter, nodeId, version])
  const more = async () => { if (!nextCursor || loading) return; const current = request.current; setLoading(true); try { const page = await getTaskPage({ data: { ...input, before: nextCursor } }); if (current === request.current) { setTasks((r) => [...r, ...page.data]); setNextCursor(page.meta.next_cursor) } } catch (e) { if (current === request.current) setError(e instanceof Error ? e.message : '加载失败') } finally { if (current === request.current) setLoading(false) } }
  return <div className="page task-page">
    {!embedded && <section className="task-hero"><span>TASKS · COMMUNITY COLLABORATION</span><h1>一起把事情<br />真正做完</h1><p>申请、交付、验收与稻米结算，任务进展都在这里。</p>{session ? <button type="button" className="hero-action" onClick={() => setMyTasks(true)}>我的任务</button> : null}</section>}
    <div className="business-heading"><h2>{embedded ? '社区任务' : '全部任务'}</h2>{!nodeId && <select aria-label="任务筛选" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部</option><option value="available">可申请</option>{nodes.map((n) => <option value={n.id} key={n.id}>{n.name}</option>)}</select>}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}{loading && !tasks.length && <p className="loading-line">正在加载任务…</p>}<section className="task-list">{tasks.map((task) => <TaskCard task={task} key={task.id} onOpen={() => setSelectedTask(task.id)} onOpenCommunity={setSelectedCommunity} />)}</section>
    {!loading && !error && !tasks.length && <p className="search-hint">暂时没有任务。</p>}{nextCursor && <Button label="加载更多" variant="secondary" isDisabled={loading} clickAction={more} />}
    {myTasks && <DetailDialog title="我的任务" onClose={() => setMyTasks(false)}><MyTasksPage embedded /></DetailDialog>}
    {selectedTask && <DetailDialog title="任务详情" onClose={() => setSelectedTask(null)}><TaskDetailPage taskId={selectedTask} embedded /></DetailDialog>}
    {selectedCommunity && <DetailDialog title="社区详情" onClose={() => setSelectedCommunity(null)}><NodeDetail nodeId={selectedCommunity} /></DetailDialog>}
  </div>
}
