import { createFileRoute } from '@tanstack/react-router'

import { MyTasksPage } from '~/features/tasks/MyTasksPage'

export const Route = createFileRoute('/me/tasks')({ component: MyTasksPage })
