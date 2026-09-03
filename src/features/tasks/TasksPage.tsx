import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { useStoredSession } from '../session/session'
import { getTaskPage } from './api'
import { TaskCard } from './TaskCard'
import type { RiceTask, TaskListStatus } from './types'

const filters: Array<{ label: string; status?: TaskListStatus }> = [
  { label: '全部' },
  { label: '可领取', status: 'open' },
  { label: '进行中', status: 'in_progress' },
  { label: '待验收', status: 'under_review' },
  { label: '已完成', status: 'completed' },
  { label: '已结束', status: 'closed' },
]

export function TasksPage() {
  const { session } = useStoredSession()
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [status, setStatus] = useState<TaskListStatus | undefined>()
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => {
    let active = true
    const version = ++requestVersion.current
    setLoading(true)
    setNextCursor(null)
    setError('')
    void getTaskPage({
      data: { token: session?.token, status, limit: 12 },
    })
      .then((page) => {
        if (!active || version !== requestVersion.current) return
        setTasks(page.data)
        setNextCursor(page.meta.next_cursor)
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

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    const version = requestVersion.current
    setLoadingMore(true)
    setError('')
    try {
      const page = await getTaskPage({
        data: {
          token: session?.token,
          status,
          limit: 12,
          before: nextCursor,
        },
      })
      if (version !== requestVersion.current) return
      setTasks((current) => [...current, ...page.data])
      setNextCursor(page.meta.next_cursor)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更多任务暂时无法加载')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="page task-page">
      <section className="task-hero">
        <span>TASKS · COMMUNITY COLLABORATION</span>
        <h1>一起把事情<br />真正做完</h1>
        <p>从申请领取到提交与验收，任务进展都在同一条可追踪的链路中。</p>
        {session ? <Link to="/me/tasks">我的任务</Link> : <Link to="/login">登录后参与</Link>}
      </section>

      <div className="task-filters filter-buttons" role="group" aria-label="任务筛选">
        {filters.map((filter) => (
          <Button
            label={filter.label}
            variant="ghost"
            size="sm"
            className={status === filter.status ? 'active' : undefined}
            aria-pressed={status === filter.status}
            onClick={() => setStatus(filter.status)}
            key={filter.label}
          />
        ))}
      </div>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading && tasks.length === 0 ? <div className="loading-line">正在加载任务…</div> : null}
      {tasks.length ? (
        <section className="task-list" aria-label="任务列表" aria-busy={loading}>
          {tasks.map((task) => <TaskCard task={task} key={task.id} />)}
        </section>
      ) : null}
      {!loading && !error && !tasks.length ? (
        <section className="task-empty-state" aria-live="polite">
          <strong>暂时没有任务</strong>
          <p>这里会显示 Rice 中真实发布的任务。</p>
        </section>
      ) : null}
      {nextCursor ? (
        <div className="task-load-more">
          <Button
            label={loadingMore ? '正在加载…' : '加载更多'}
            variant="secondary"
            isDisabled={loadingMore}
            clickAction={loadMore}
          />
        </div>
      ) : null}
    </div>
  )
}
