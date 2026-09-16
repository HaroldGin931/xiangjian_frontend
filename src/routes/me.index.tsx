import { createFileRoute } from '@tanstack/react-router'

import { ProfilePage } from '~/features/profile/ProfilePage'
import { getCurrentUser } from '~/features/session/api'
import { readStoredSession } from '~/features/session/session'
import { getWallet } from '~/features/grains/api'

export const Route = createFileRoute('/me/')({
  ssr: false,
  preloadStaleTime: 0,
  loader: { staleReloadMode: 'blocking', handler: async () => {
    const session = readStoredSession()
    if (!session) return { initialData: null, error: '' }
    try {
      const [user, wallet] = await Promise.all([getCurrentUser({ data: session.token }), getWallet({ data: { token: session.token } })])
      return { initialData: { user, wallet, accountId: session.user.id }, error: '' }
    } catch (error) {
      return { initialData: null, error: error instanceof Error ? error.message : '个人资料暂时无法加载，请稍后重试。' }
    }
  } },
  component: () => { const { initialData, error } = Route.useLoaderData(); return <ProfilePage initialData={initialData} initialError={error} /> },
})
