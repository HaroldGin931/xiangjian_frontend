import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { DetailDialog } from '~/components/DetailDialog'
import { NotificationsPage } from '~/features/notifications/NotificationsPage'

export const Route = createFileRoute('/notifications')({
  component: NotificationsRoute,
})

function NotificationsRoute() {
  const navigate = useNavigate()
  return <DetailDialog title="通知" onClose={() => void navigate({ to: '/', replace: true })}>
    <NotificationsPage embedded />
  </DetailDialog>
}
