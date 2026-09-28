import { createFileRoute } from '@tanstack/react-router'
import { EventDetail } from '~/features/events/EventDetail'

export const Route = createFileRoute('/events_/$eventId')({ component: EventRoute })

function EventRoute() {
  const { eventId } = Route.useParams()
  return <EventDetail eventId={eventId} />
}
