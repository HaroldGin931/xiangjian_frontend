import { Link } from '@tanstack/react-router'
import { ArrowRight, UsersRound } from 'lucide-react'

import { formatTimestamp } from '~/lib/format'

import { taskStatusLabel, type RiceTask } from './types'

export function TaskCard({ task }: { task: RiceTask }) {
  return (
    <Link to="/tasks/$taskId" params={{ taskId: task.id }} className="task-card">
      <header>
        <div className="task-owner-mark" aria-hidden="true">
          {(task.creator.nickname || task.creator.handle).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <strong>{task.creator.nickname || task.creator.handle}</strong>
          <span>{formatTimestamp(task.inserted_at)}</span>
        </div>
        <span className={`task-status status-${task.status}`}>{taskStatusLabel[task.status]}</span>
      </header>
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <footer>
        <span><UsersRound size={14} aria-hidden="true" /> {task.application_count} 人申请</span>
        {task.my_application_status === 'pending' ? <b>已申请</b> : null}
        <ArrowRight size={16} aria-hidden="true" />
      </footer>
    </Link>
  )
}
