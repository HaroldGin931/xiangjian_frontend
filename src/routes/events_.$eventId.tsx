import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DetailDialog } from '~/components/DetailDialog'
import { EventDetail } from '~/features/events/EventDetail'

export const Route = createFileRoute('/events_/$eventId')({ component: EventRoute })

function EventRoute() {
  const { eventId } = Route.useParams()
  const navigate = useNavigate()
  return <DetailDialog title="活动详情" onClose={() => { void navigate({ to: '/events' }) }}><EventDetail eventId={eventId} /></DetailDialog>
}
