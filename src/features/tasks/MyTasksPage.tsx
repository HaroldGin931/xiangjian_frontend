import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useStoredSession } from '../session/session'
import { getTasks } from './api'
import { TaskCard } from './TaskCard'
import type { RiceTask, TaskMine } from './types'

const tabs: Array<{ value: TaskMine; label: string }> = [
  { value: 'assigned', label: '我承作的' },
  { value: 'created', label: '我发布的' },
  { value: 'applied', label: '我申请中' },
]

export function MyTasksPage() {
  const { session } = useStoredSession()
  const [mine, setMine] = useState<TaskMine>('assigned')
  const [tasks, setTasks] = useState<RiceTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    setError('')
    void getTasks({ data: { token: session.token, mine } })
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
  }, [mine, session])

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
      <div className="task-filters" aria-label="我的任务分类">
        {tabs.map((tab) => (
          <button
            type="button"
            className={mine === tab.value ? 'active' : ''}
            onClick={() => setMine(tab.value)}
            key={tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading ? <div className="loading-line">正在加载任务…</div> : null}
      {!loading && tasks.length ? (
        <section className="task-list">
          {tasks.map((task) => <TaskCard task={task} key={task.id} />)}
        </section>
      ) : null}
      {!loading && !error && !tasks.length ? (
        <section className="task-empty-state">
          <strong>这里还没有任务</strong>
          <p>{mine === 'assigned' ? '完成后的任务也会一直保留在这里。' : '产生记录后会显示在这里。'}</p>
        </section>
      ) : null}
    </div>
  )
}
