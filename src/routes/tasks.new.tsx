import { createFileRoute } from '@tanstack/react-router'

import { TaskCreatePage } from '~/features/tasks/TaskCreatePage'

export const Route = createFileRoute('/tasks/new')({ component: TaskCreatePage })
