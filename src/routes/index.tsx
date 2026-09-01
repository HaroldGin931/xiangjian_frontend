import { createFileRoute } from '@tanstack/react-router'

import { getPosts } from '~/features/feed/api'
import { PlazaPage } from '~/features/feed/PlazaPage'

export const Route = createFileRoute('/')({
  loader: () => getPosts({ data: {} }),
  component: PlazaRoute,
})

function PlazaRoute() {
  const initialFeed = Route.useLoaderData()
  return <PlazaPage initialFeed={initialFeed} />
}
