import { createFileRoute } from '@tanstack/react-router'

import { ProfilePage, type ProfileInitialData } from '~/features/profile/ProfilePage'
import { getCurrentUser } from '~/features/session/api'
import { readStoredSession, writeStoredSession } from '~/features/session/session'
import { getWallet } from '~/features/grains/api'

export const Route = createFileRoute('/me/')({
  ssr: false,
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  loaderDeps: () => {
    const session = readStoredSession()
    // Client-only cache identity; never a search parameter or URL.
    return { accountId: session?.user.id ?? null, token: session?.token ?? null }
  },
  beforeLoad: ({ matches }): { previousData: ProfileInitialData | null } => {
    const previous = matches.find((match) => match.routeId === '/me/')?.loaderData as { initialData: ProfileInitialData | null } | undefined
    return { previousData: previous?.initialData ?? null }
  },
  loader: { staleReloadMode: 'background', handler: async ({ deps, context }) => {
    const empty = { initialData: null, error: '' }
    if (!deps.token || !deps.accountId) return empty
    const isCurrentSession = () => {
      const current = readStoredSession()
      return current?.user.id === deps.accountId && current.token === deps.token
    }
    if (!isCurrentSession()) return empty
    try {
      const userRequest = getCurrentUser({ data: deps.token }).then((user) => {
        if (user === null && isCurrentSession()) writeStoredSession(null)
        return user
      })
      const [user, wallet] = await Promise.all([userRequest, getWallet({ data: { token: deps.token } })])
      if (!isCurrentSession() || !user) return empty
      return { initialData: { user, wallet, accountId: deps.accountId, sessionToken: deps.token }, error: '' }
    } catch (error) {
      if (!isCurrentSession()) return empty
      const previous = context.previousData
      const initialData = previous?.accountId === deps.accountId && previous.sessionToken === deps.token ? previous : null
      return { initialData, error: error instanceof TypeError ? '网络连接失败，请检查网络后重试。' : error instanceof Error ? error.message : '个人资料暂时无法加载，请稍后重试。' }
    }
  } },
  component: () => { const { initialData, error } = Route.useLoaderData(); return <ProfilePage initialData={initialData} initialError={error} /> },
})
