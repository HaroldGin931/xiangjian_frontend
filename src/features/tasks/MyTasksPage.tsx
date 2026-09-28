import { LoginLink } from '../session/LoginLink'
import { Button } from '@astryxdesign/core/Button'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LoadingState } from '~/components/LoadingState'
import { useStoredSession } from '../session/session'
import { TaskCard } from './TaskCard'
import { myTaskGroup, type TaskGroup as Group, type RiceTask } from './types'
import type { MyTasksInitialData } from '~/routes/me.tasks'

export function MyTasksPage({ initialData = null, initialError = '', loaderToken }: { initialData?: MyTasksInitialData | null; initialError?: string; loaderToken?: string | null }) {
  const { session, isReady } = useStoredSession()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  useEffect(() => { if (isReady && session && loaderToken === null) void router.invalidate({ filter: (match) => match.routeId === '/me/tasks' }) }, [isReady, session?.token, loaderToken, router])
  useEffect(() => { setGroup(null) }, [session?.user.id])
  const tasks = initialData && session && initialData.accountId === session.user.id && initialData.sessionToken === session.token ? initialData.tasks : null
  if (isReady && !session) return <div className="page"><LoginLink className="primary-link">登录后查看我的任务</LoginLink></div>
  if (!tasks) return <div className="page business-panel list-panel"><h1>我的任务</h1>{initialError ? <p className="inline-error" role="alert">{initialError}</p> : <LoadingState label="正在加载任务…" />}</div>
  const own = (task: RiceTask) => task.creator.id === session?.user.id || task.can_manage === true
  const groupOf = (task: RiceTask) => myTaskGroup(task, own(task))
  const publisher = tasks.some(own)
  const tabs: Array<[Group, string]> = [...(publisher ? [['pending', '待审批']] as Array<[Group, string]> : []), ...(!publisher || tasks.some((t) => groupOf(t) === 'applying') ? [['applying', '申请中']] as Array<[Group, string]> : []), ['in_progress', '进行中'], ['under_review', '审核中'], ['ended', '已结束'], ...(publisher ? [['open', '待分配'], ['draft', '草稿']] as Array<[Group, string]> : [])]
  const selected = group && tabs.some(([value]) => value === group) ? group : tabs[0][0]
  return <div className="page business-panel list-panel"><h1>我的任务</h1><div className="filter-buttons my-task-tabs">{tabs.map(([value, label]) => <Button key={value} label={`${label} ${tasks.filter((t) => groupOf(t) === value).length}`} variant="ghost" className={selected === value ? 'active' : undefined} aria-pressed={selected === value} onClick={() => setGroup(value)} />)}</div>
    {initialError && <p className="inline-error" role="alert">{initialError}</p>}<section className="task-list">{tasks.filter((t) => groupOf(t) === selected).map((task) => <TaskCard task={task} compact key={task.id} />)}</section>{!initialError && !tasks.some((t) => groupOf(t) === selected) && <p className="search-hint">这里还没有任务。</p>}
  </div>
}
