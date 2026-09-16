import { createFileRoute, Link } from '@tanstack/react-router'
import { ComposePanel, type ComposeKind } from '~/features/feed/ComposePanel'
import { useStoredSession } from '~/features/session/session'
export const Route = createFileRoute('/compose')({
  validateSearch: (search: Record<string, unknown>): { kind?: ComposeKind } => ({ kind: search.kind === 'task' || search.kind === 'activity' ? search.kind : undefined }),
  component: ComposePage,
})
function ComposePage() {
  const { kind } = Route.useSearch()
  const { session } = useStoredSession()
  return <><Link to={kind === 'task' ? '/tasks' : kind === 'activity' ? '/events' : '/'} className="back-link">取消</Link><ComposePanel key={session?.user.id ?? 'guest'} initialKind={kind} /></>
}
