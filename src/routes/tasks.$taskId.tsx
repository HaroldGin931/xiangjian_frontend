import { createFileRoute } from '@tanstack/react-router'

import { TaskDetailPage } from '~/features/tasks/TaskDetailPage'

export const Route = createFileRoute('/tasks/$taskId')({
  component: () => <TaskDetailPage taskId={Route.useParams().taskId} />,
})
