import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DetailDialog, usePanelReady } from '~/components/DetailDialog'
import { useStoredSession } from '../session/session'
import { getTaskPage } from './api'
import { TaskCard } from './TaskCard'
import { TaskDetailPage } from './TaskDetailPage'
import { myTaskGroup, type TaskGroup as Group, type RiceTask, type TaskMine } from './types'

export function MyTasksPage({ embedded = false }: { embedded?: boolean }) {
  const { session, isReady } = useStoredSession()
  const [data, setData] = useState<{ owner: string; tasks: RiceTask[] } | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [selectedTask, setSelectedTask] = useState<{ id: string; load: (token?: string) => Promise<RiceTask> } | null>(null)
  useEffect(() => { const refresh = () => setVersion((v) => v + 1); window.addEventListener('rice-changed', refresh); return () => window.removeEventListener('rice-changed', refresh) }, [])
  useEffect(() => {
    if (!isReady) return
    if (!session) { setData(null); setLoading(false); return }
    let active = true; setLoading(true); setError('')
    const load = async () => {
      const mine: TaskMine[] = ['created', 'applied', 'assigned']
      // ponytail: fetch the small personal history for accurate tabs; add server counts if history grows large.
      const groups = await Promise.all(mine.map(async (value) => {
        const rows: RiceTask[] = []; let before: string | undefined
        do { const page = await getTaskPage({ data: { token: session.token, mine: value, limit: 100, before } }); rows.push(...page.data); before = page.meta.next_cursor ?? undefined } while (before && active)
        return rows
      }))
      if (active) setData({ owner: session.user.id, tasks: [...new Map(groups.flat().map((t) => [t.id, t])).values()] })
    }
    void load().catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isReady, session?.token, session?.user.id, version])
  useEffect(() => { setGroup(null); setSelectedTask(null) }, [session?.user.id])
  const tasks = data && data.owner === session?.user.id ? data.tasks : null
  usePanelReady(isReady && (!session || tasks !== null || !!error))
  if (isReady && !session) return <div className="page"><Link to="/login" className="primary-link">登录后查看我的任务</Link></div>
  if (!tasks) return <div className="page business-panel list-panel">{!embedded && <Link to="/me" className="back-link">返回我的</Link>}<h1>我的任务</h1>{error ? <p className="inline-error" role="alert">{error}</p> : <p className="loading-line">正在加载任务…</p>}</div>
  const own = (task: RiceTask) => task.creator.id === session?.user.id
  const groupOf = (task: RiceTask) => myTaskGroup(task, own(task))
  const publisher = tasks.some(own)
  const tabs: Array<[Group, string]> = [...(publisher ? [['pending', '待审批']] as Array<[Group, string]> : []), ...(!publisher || tasks.some((t) => groupOf(t) === 'applying') ? [['applying', '申请中']] as Array<[Group, string]> : []), ['in_progress', '进行中'], ['under_review', '审核中'], ['ended', '已结束'], ...(publisher ? [['open', '招募中'], ['draft', '草稿']] as Array<[Group, string]> : [])]
  const selected = group && tabs.some(([value]) => value === group) ? group : tabs[0][0]
  return <div className="page business-panel list-panel" aria-busy={loading}>{!embedded && <Link to="/me" className="back-link">返回我的</Link>}<h1>我的任务</h1><div className="filter-buttons my-task-tabs">{tabs.map(([value, label]) => <Button key={value} label={`${label} ${tasks.filter((t) => groupOf(t) === value).length}`} variant="ghost" className={selected === value ? 'active' : undefined} aria-pressed={selected === value} onClick={() => setGroup(value)} />)}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}<section className="task-list">{tasks.filter((t) => groupOf(t) === selected).map((task) => <TaskCard task={task} compact key={task.id} onOpen={(load) => setSelectedTask({ id: task.id, load })} />)}</section>{!error && !tasks.some((t) => groupOf(t) === selected) && <p className="search-hint">这里还没有任务。</p>}
    {selectedTask && <DetailDialog key={selectedTask.id} title="任务详情" onClose={() => setSelectedTask(null)}><TaskDetailPage taskId={selectedTask.id} loadTask={selectedTask.load} embedded /></DetailDialog>}
  </div>
}
