import { createFileRoute } from '@tanstack/react-router'

import { TasksPage } from '~/features/tasks/TasksPage'

export const Route = createFileRoute('/tasks')({ component: TasksPage })
