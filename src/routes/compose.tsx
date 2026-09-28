import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ComposePanel, type ComposeInitialData, type ComposeKind } from '~/features/feed/ComposePanel'
import { readPostDraft } from '~/features/feed/post-draft'
import { getNodes } from '~/features/nodes/api'
import { getTasks } from '~/features/tasks/api'
import { getEvents } from '~/features/events/api'
import { readStoredSession, useStoredSession } from '~/features/session/session'

const errorMessage = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback
export const Route = createFileRoute('/compose')({
  ssr: false,
  staleTime: 0,
  preloadStaleTime: 0,
  validateSearch: (search: Record<string, unknown>): { kind?: ComposeKind } => ({ kind: search.kind === 'task' || search.kind === 'activity' ? search.kind : undefined }),
  loaderDeps: ({ search }) => {
    const session = readStoredSession()
    return { kind: search.kind ?? 'post', accountId: session?.user.id ?? null, token: session?.token ?? null, did: session?.pds.did ?? null }
  },
  loader: async ({ deps }): Promise<ComposeInitialData | null> => {
    if (!deps.token || !deps.did) return null
    const [nodesResult, postDraftResult, taskResult, eventResult] = await Promise.allSettled([
      getNodes({ data: { token: deps.token, mine: 'managed' } }),
      readPostDraft(deps.did),
      deps.kind === 'task' ? getTasks({ data: { token: deps.token, mine: 'created', status: 'draft', limit: 1 } }).then(([draft]) => draft ?? null) : Promise.resolve(undefined),
      deps.kind === 'activity' ? getEvents({ data: { token: deps.token, mine: 'created', status: 'draft' } }).then((page) => page.data[0] ?? null) : Promise.resolve(undefined),
    ])
    const current = readStoredSession()
    if (current?.token !== deps.token || current.pds.did !== deps.did || current.user.id !== deps.accountId) return null
    return {
      token: deps.token,
      kind: deps.kind,
      managedNodes: nodesResult.status === 'fulfilled' ? nodesResult.value : [],
      nodesError: nodesResult.status === 'rejected' ? errorMessage(nodesResult.reason, '暂时无法加载发布选项') : '',
      postDraft: postDraftResult.status === 'fulfilled' ? postDraftResult.value : null,
      postDraftError: postDraftResult.status === 'rejected' ? '无法读取帖子草稿，请检查浏览器存储权限。' : '',
      taskDraft: taskResult.status === 'fulfilled' ? taskResult.value ?? null : null,
      taskDraftError: taskResult.status === 'rejected' ? errorMessage(taskResult.reason, '任务草稿暂时无法加载') : '',
      eventDraft: eventResult.status === 'fulfilled' ? eventResult.value ?? null : null,
      eventDraftError: eventResult.status === 'rejected' ? errorMessage(eventResult.reason, '活动草稿暂时无法加载') : '',
    }
  },
  component: ComposePage,
})
function ComposePage() {
  const { kind } = Route.useSearch()
  const initialData = Route.useLoaderData()
  const { token: loaderToken } = Route.useLoaderDeps()
  const { session } = useStoredSession()
  const router = useRouter()
  useEffect(() => {
    if (session && loaderToken !== session.token) void router.invalidate({ filter: (match) => match.routeId === '/compose' })
  }, [loaderToken, router, session?.token])
  return <ComposePanel key={`${session?.user.id ?? 'guest'}:${initialData?.token ?? 'pending'}`} initialKind={kind} initialData={initialData} />
}
