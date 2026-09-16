import { createFileRoute } from '@tanstack/react-router'
import { EventsPage } from '~/features/events/EventsPage'
import { getEvents } from '~/features/events/api'
export const Route = createFileRoute('/events')({
  loader: { staleReloadMode: 'blocking', handler: () => getEvents({ data: {} }) },
  component: () => <EventsPage initialPage={Route.useLoaderData()} />,
})
