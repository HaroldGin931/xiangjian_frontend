import { createFileRoute } from '@tanstack/react-router'
import { EventsPage } from '~/features/events/EventsPage'
import { getEvents } from '~/features/events/api'
export const Route = createFileRoute('/events')({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  loader: { staleReloadMode: 'background', handler: () => getEvents({ data: {} }) },
  component: () => <EventsPage initialPage={Route.useLoaderData()} />,
})
