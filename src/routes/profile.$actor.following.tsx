import { createFileRoute } from '@tanstack/react-router'

import { PeopleListPage } from '~/features/social/PeopleListPage'

export const Route = createFileRoute('/profile/$actor/following')({
  component: FollowingRoute,
})

function FollowingRoute() {
  const { actor } = Route.useParams()
  return <PeopleListPage actor={actor} kind="following" />
}
