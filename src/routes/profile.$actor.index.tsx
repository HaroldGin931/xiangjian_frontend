import { createFileRoute } from '@tanstack/react-router'

import { UserProfilePage } from '~/features/social/UserProfilePage'

export const Route = createFileRoute('/profile/$actor/')({
  component: ProfileRoute,
})

function ProfileRoute() {
  const { actor } = Route.useParams()
  return <UserProfilePage actor={actor} />
}
