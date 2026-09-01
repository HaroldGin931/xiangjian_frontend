import { createFileRoute } from '@tanstack/react-router'

import {
  getPosts,
  readCachedFeed,
  writeCachedFeed,
} from '~/features/feed/api'
import { PlazaPage } from '~/features/feed/PlazaPage'
import { readStoredSession } from '~/features/session/session'

export const Route = createFileRoute('/')({
  loader: {
    handler: async () => {
      const session = readStoredSession()
      const cachedFeed = readCachedFeed(session?.pds.did)
      if (cachedFeed) return cachedFeed

      const feed = await getPosts({
        data: {
          accessJwt: session?.pds.access_jwt,
          did: session?.pds.did,
        },
      })
      writeCachedFeed(feed, session?.pds.did)
      return feed
    },
    staleReloadMode: 'blocking',
  },
  component: PlazaRoute,
})

function PlazaRoute() {
  const initialFeed = Route.useLoaderData()
  return <PlazaPage initialFeed={initialFeed} />
}
