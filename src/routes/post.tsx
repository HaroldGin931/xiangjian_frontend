import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { PostThreadPanel } from '~/features/feed/PostThreadPanel'

export const Route = createFileRoute('/post')({
  validateSearch: (search: Record<string, unknown>) => ({
    uri: typeof search.uri === 'string' ? search.uri : '',
  }),
  component: PostPage,
})

function PostPage() {
  const { uri } = Route.useSearch()
  const focusReply = typeof window !== 'undefined' && window.location.hash === '#reply'

  return (
    <div className="page post-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={19} aria-hidden="true" /> 返回广场
      </Link>
      <PostThreadPanel uri={uri} focusReply={focusReply} />
    </div>
  )
}
