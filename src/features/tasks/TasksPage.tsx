import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useStoredSession } from '../session/session'
import { getTasks } from './api'
import { TaskCard } from './TaskCard'
import type { RiceTask, TaskStatus } from './types'

const filters: Array<{ label: string; status?: TaskStatus; disabled?: boolean }> = [
  { label: '全部' },
  { label: '可领取', status: 'open' },
  { label: '进行中', status: 'in_progress' },
  { label: '我的社区', disabled: true },
]

export function TasksPage() {
  const { session } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [status, setStatus] = useState<TaskStatus | undefined>()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void getTasks({ data: { token: session?.token, status } })
      .then((result) => {
        if (active) setTasks(result)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '任务暂时无法加载')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.token, status])

  const visibleTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return tasks
    return tasks.filter((task) =>
      `${task.title}\n${task.description}`.toLowerCase().includes(keyword),
    )
  }, [query, tasks])

  return (
    <div className="page task-page">
      <section className="task-hero">
        <span>TASKS · COMMUNITY COLLABORATION</span>
        <h1>一起把事情<br />真正做完</h1>
        <p>从申请领取到提交与审核，任务进展都在同一条可追踪的链路中。</p>
        {session ? <Link to="/me/tasks">我的任务</Link> : <Link to="/login">登录后参与</Link>}
      </section>

      <label className="task-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">搜索任务</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索任务"
          placeholder="搜索任务标题或说明…"
        />
      </label>

      <div className="task-filters" aria-label="任务筛选">
        {filters.map((filter) => (
          <button
            type="button"
            disabled={filter.disabled}
            className={status === filter.status && !filter.disabled ? 'active' : ''}
            aria-label={filter.disabled ? `${filter.label}，社区关系尚未接入` : filter.label}
            onClick={() => setStatus(filter.status)}
            key={filter.label}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section className="task-summary" aria-label="当前列表统计">
        <article><strong>{tasks.filter((task) => task.status === 'open').length}</strong><span>可领取任务</span></article>
        <article><strong>{tasks.filter((task) => task.status === 'in_progress').length}</strong><span>进行中</span></article>
      </section>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading ? <div className="loading-line">正在加载任务…</div> : null}
      {!loading && !error && visibleTasks.length ? (
        <section className="task-list" aria-label="任务列表">
          {visibleTasks.map((task) => <TaskCard task={task} key={task.id} />)}
        </section>
      ) : null}
      {!loading && !error && !visibleTasks.length ? (
        <section className="task-empty-state" aria-live="polite">
          <strong>{query ? '没有符合条件的任务' : '暂时没有任务'}</strong>
          <p>{query ? '换一个关键词试试。' : '这里会显示 Rice 中真实发布的任务。'}</p>
        </section>
      ) : null}
    </div>
  )
}
