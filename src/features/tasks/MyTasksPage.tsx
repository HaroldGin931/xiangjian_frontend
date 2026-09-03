import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useStoredSession } from '../session/session'
import { getTaskPage } from './api'
import { TaskCard } from './TaskCard'
import type { RiceTask, TaskMine } from './types'

const tabs: Array<{ value: TaskMine; label: string }> = [
  { value: 'assigned', label: '我承作的' },
  { value: 'created', label: '我发布的' },
  { value: 'applied', label: '我的申请' },
]

export function MyTasksPage() {
  const { session } = useStoredSession()
  const [mine, setMine] = useState<TaskMine>('assigned')
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => {
    if (!session) return
    let active = true
    const version = ++requestVersion.current
    setLoading(true)
    setNextCursor(null)
    setError('')
    void getTaskPage({ data: { token: session.token, mine, limit: 12 } })
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
  }, [mine, session])

  const loadMore = async () => {
    if (!session || !nextCursor || loadingMore) return
    const version = requestVersion.current
    setLoadingMore(true)
    setError('')
    try {
      const page = await getTaskPage({
        data: { token: session.token, mine, limit: 12, before: nextCursor },
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

  if (!session) {
    return (
      <div className="page signed-out-state">
        <strong>登录后查看我的任务</strong>
        <Link to="/login" className="primary-link">前往登录</Link>
      </div>
    )
  }

  return (
    <div className="page my-tasks-page">
      <Link to="/me" className="back-link"><ArrowLeft size={16} /> 我的</Link>
      <h1>我的任务</h1>
      <div className="filter-buttons" role="group" aria-label="我的任务分类">
        {tabs.map((tab) => (
          <Button
            label={tab.label}
            variant="ghost"
            size="sm"
            className={mine === tab.value ? 'active' : undefined}
            aria-pressed={mine === tab.value}
            onClick={() => {
              setTasks([])
              setNextCursor(null)
              setMine(tab.value)
            }}
            key={tab.value}
          />
        ))}
      </div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading && tasks.length === 0 ? <div className="loading-line">正在加载任务…</div> : null}
      {tasks.length ? (
        <section className="task-list" aria-busy={loading}>
          {tasks.map((task) => <TaskCard task={task} key={task.id} />)}
        </section>
      ) : null}
      {!loading && !error && !tasks.length ? (
        <section className="task-empty-state">
          <strong>这里还没有任务</strong>
          <p>{mine === 'assigned' ? '完成后的任务也会一直保留在这里。' : '产生记录后会显示在这里。'}</p>
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
