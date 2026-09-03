import { createFileRoute } from '@tanstack/react-router'

import { PeopleListPage } from '~/features/social/PeopleListPage'

export const Route = createFileRoute('/profile/$actor/followers')({
  component: FollowersRoute,
})

function FollowersRoute() {
  const { actor } = Route.useParams()
  return <PeopleListPage actor={actor} kind="followers" />
}
