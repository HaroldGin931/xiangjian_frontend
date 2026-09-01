import { createFileRoute } from '@tanstack/react-router'

import { getPosts } from '~/features/feed/api'
import { PlazaPage } from '~/features/feed/PlazaPage'
import { readStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/')({
  shouldReload: true,
  preloadStaleTime: 0,
  loader: {
    handler: () => {
      const session = readStoredSession()
      return getPosts({
        data: {
          accessJwt: session?.pds.access_jwt,
          did: session?.pds.did,
        },
      })
    },
    staleReloadMode: 'blocking',
  },
  component: PlazaRoute,
})

function PlazaRoute() {
  const initialFeed = Route.useLoaderData()
  return <PlazaPage initialFeed={initialFeed} />
}
