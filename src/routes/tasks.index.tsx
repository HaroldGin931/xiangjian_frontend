import { createFileRoute } from '@tanstack/react-router'

import { TasksPage } from '~/features/tasks/TasksPage'
import { getTaskPage } from '~/features/tasks/api'
import { getNodes } from '~/features/nodes/api'

export const Route = createFileRoute('/tasks/')({
  loader: { staleReloadMode: 'blocking', handler: async () => {
    const [page, nodes] = await Promise.all([getTaskPage({ data: { limit: 12 } }), getNodes({ data: {} })])
    return { page, nodes }
  } },
  component: TasksRoute,
})

function TasksRoute() {
  const { page, nodes } = Route.useLoaderData()
  return <TasksPage initialPage={page} initialNodes={nodes} />
}
