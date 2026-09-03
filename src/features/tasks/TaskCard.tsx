import { Link } from '@tanstack/react-router'
import { Sprout, UsersRound } from 'lucide-react'

import { ContentCardHeader } from '~/components/ContentCardHeader'
import { authorInitial, formatTimestamp } from '~/lib/format'

import { taskStatusLabel, type RiceTask } from './types'

export function TaskCard({ task }: { task: RiceTask }) {
  return (
    <Link to="/tasks/$taskId" params={{ taskId: task.id }} className="content-card task-card">
      <ContentCardHeader
        initial={authorInitial({
          handle: task.creator.handle,
          displayName: task.creator.nickname ?? undefined,
        })}
        name={task.creator.nickname || task.creator.handle}
        timestamp={formatTimestamp(task.published_at ?? task.inserted_at)}
        aside={(
          <span className={`task-status status-${task.status}`}>
            {taskStatusLabel[task.status]}
          </span>
        )}
      />
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <footer className="content-card-actions task-card-actions">
        <span><UsersRound size={14} aria-hidden="true" /> {task.application_count} 人申请</span>
        <span><Sprout size={14} aria-hidden="true" /> {task.reward_amount} 稻米</span>
      </footer>
    </Link>
  )
}
